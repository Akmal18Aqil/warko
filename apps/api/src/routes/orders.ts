import { KITCHEN_STATUSES, MAX_MONEY, PAYMENT_METHODS } from "@wakro/shared";
import { batchTyped } from "../db";
import { HttpError, invalid, json, Reader, readJsonObject } from "../http";
import { parseOrderNo, requireRole } from "../guards";
import {
  hashClientRef, loadOrder, operationalOrderStatements, placeOrder, reportOrderStatements, serializeOrders,
  setKitchenStatus, settleOrder, type OrderDbRow, type OrderItemDbRow,
} from "../orders";
import { readCursor, readLimit, toPage } from "../pagination";
import {
  CREATE_ORDER_ROLES, CREATE_PAID_ROLES, DISCOUNT_ROLES, READ_ROLES, REPORT_ROLES, SETTLE_ROLES, UPDATE_STATUS_ROLES,
} from "../policy";
import { get, send, type AuthedContext, type Route } from "../router";

const ORDER_TYPES = ["bawa-pulang", "meja"] as const;
const ORDER_SOURCES = ["pos", "waiter", "self-order"] as const;
const PAYMENT_CHOICES = ["paid-now", "pay-later"] as const;

const MAX_ORDER_LINES = 40;
const MAX_QTY = 999;
/** Reports cover at most a little over a year per request. */
const MAX_REPORT_RANGE_MS = 400 * 24 * 60 * 60 * 1000;
const REPORT_DEFAULT_PAGE = 500;
const REPORT_MAX_PAGE = 1000;

async function listOrders({ env }: AuthedContext): Promise<Response> {
  const [orders, items] = await batchTyped<[OrderDbRow, OrderItemDbRow]>(env.DB, operationalOrderStatements(env));
  return json({ data: serializeOrders(orders, items) });
}

async function getOrder({ env, params }: AuthedContext): Promise<Response> {
  const order = await loadOrder(env, parseOrderNo(params.no));
  if (!order) throw new HttpError(404, "Pesanan tidak ditemukan.");
  return json({ data: order });
}

async function createOrder({ request, env, staff }: AuthedContext): Promise<Response> {
  const r = new Reader(await readJsonObject(request));

  const kitchenStatus = r.oneOf("kitchenStatus", KITCHEN_STATUSES, { optional: true });
  const orderType = r.oneOf("orderType", ORDER_TYPES);
  const tableId = r.string("tableId", { max: 100, optional: true });
  const tableName = r.string("tableName", { max: 100, optional: true });
  const guests = r.integer("guests", { min: 1, max: 1_000, optional: true });
  const customerName = r.string("customerName", { max: 120, optional: true });
  const source = r.oneOf("source", ORDER_SOURCES, { optional: true });
  const paymentChoice = r.oneOf("paymentChoice", PAYMENT_CHOICES, { optional: true });
  const discount = r.integer("discount", { min: 0, max: MAX_MONEY, optional: true });
  const expectedTotal = r.integer("expectedTotal", { min: 0, max: MAX_MONEY });
  const method = r.oneOf("method", PAYMENT_METHODS, { optional: true });
  const cashReceived = r.integer("cashReceived", { min: 0, max: MAX_MONEY, optional: true });
  const clientRef = r.string("clientRef", { max: 100, optional: true });

  const lines: { barcode: string; qty: number; note: string | null }[] = [];
  r.array("items", { min: 1, max: MAX_ORDER_LINES }).forEach((entry, i) => {
    const lr = r.child(entry, `items.${i}`);
    const barcode = lr.string("barcode", { max: 100, min: 1 });
    const qty = lr.integer("qty", { min: 1, max: MAX_QTY });
    const note = lr.string("note", { max: 500, optional: true });
    lines.push({ barcode, qty, note: note?.trim() ? note.trim() : null });
  });
  if (orderType === "meja" && !tableId && !tableName?.trim()) r.addError("tableId", "Pilih meja untuk pesanan dine-in.");
  r.done();

  if (method !== undefined && !CREATE_PAID_ROLES.includes(staff.role)) {
    throw new HttpError(403, "Peran Anda tidak diizinkan menerima pembayaran.");
  }
  // A waiter must not be able to hand out arbitrary discounts.
  if ((discount ?? 0) > 0) requireRole(staff, ...DISCOUNT_ROLES);

  const result = await placeOrder(env, {
    lines,
    discount: discount ?? 0,
    orderType,
    tableId: orderType === "meja" ? (tableId ?? null) : null,
    tableName: tableName?.trim() || null,
    guests: guests ?? null,
    customerName: customerName?.trim() || null,
    // The waiter identity is the signed-in staff member, never a client-supplied value.
    waiterId: source === "waiter" ? staff.id : null,
    waiterName: source === "waiter" ? staff.name : null,
    source: source ?? "pos",
    paymentChoice: paymentChoice ?? (method ? "paid-now" : "pay-later"),
    kitchenStatus: kitchenStatus ?? "queued",
    payment: method ? { method, cashReceived: cashReceived ?? null, paidBy: staff.name } : null,
    expectedTotal,
    clientRefHash: clientRef === undefined ? null : await hashClientRef("clientRef", clientRef),
    staffName: staff.name,
  });
  return json({ data: result.order, replayed: result.replayed }, result.replayed ? 200 : 201);
}

async function updateOrderStatus({ request, env, params }: AuthedContext): Promise<Response> {
  const no = parseOrderNo(params.no);
  const r = new Reader(await readJsonObject(request));
  const kitchenStatus = r.oneOf("kitchenStatus", KITCHEN_STATUSES);
  r.done();
  return json({ data: await setKitchenStatus(env, no, kitchenStatus) });
}

async function payExistingOrder({ request, env, params, staff }: AuthedContext): Promise<Response> {
  const no = parseOrderNo(params.no);
  const r = new Reader(await readJsonObject(request));
  const method = r.oneOf("method", PAYMENT_METHODS);
  const cashReceived = r.integer("cashReceived", { min: 0, max: MAX_MONEY, optional: true });
  r.done();
  const result = await settleOrder(env, no, {
    method,
    cashReceived: method === "tunai" ? (cashReceived ?? null) : null,
    paidBy: staff.name,
    paymentRef: null,
  });
  return json({ data: result.order, alreadyPaid: result.alreadyPaid });
}

/** GET /api/reports/orders?from&to[&cursor][&limit] — pages of orders ordered by (created_at, no). */
async function reportOrders({ env, url }: AuthedContext): Promise<Response> {
  const from = Number(url.searchParams.get("from"));
  const to = Number(url.searchParams.get("to"));
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to <= from || to - from > MAX_REPORT_RANGE_MS) {
    throw invalid("range", "from/to harus epoch milidetik dengan rentang maksimal 400 hari.");
  }
  const limit = readLimit(url, REPORT_DEFAULT_PAGE, REPORT_MAX_PAGE);
  const [orders, items] = await batchTyped<[OrderDbRow, OrderItemDbRow]>(
    env.DB,
    reportOrderStatements(env, from, to, readCursor(url), limit + 1),
  );
  const page = toPage(orders, limit, (row) => [row.created_at, row.no]);
  return json({ data: serializeOrders(page.rows, items), nextCursor: page.nextCursor });
}

export const orderRoutes: Route[] = [
  get("/api/orders", READ_ROLES, listOrders),
  send("POST", "/api/orders", CREATE_ORDER_ROLES, createOrder),
  get("/api/orders/:no(\\d{1,15})", READ_ROLES, getOrder),
  send("PATCH", "/api/orders/:no(\\d{1,15})/status", UPDATE_STATUS_ROLES, updateOrderStatus),
  send("POST", "/api/orders/:no(\\d{1,15})/payment", SETTLE_ROLES, payExistingOrder),
  get("/api/reports/orders", REPORT_ROLES, reportOrders),
];
