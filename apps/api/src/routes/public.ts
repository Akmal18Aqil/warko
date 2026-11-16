import { MAX_MONEY } from "@wakro/shared";
import { consumeAttempt } from "../auth";
import { sha256Hex } from "../crypto";
import { batchTyped } from "../db";
import { HttpError, json, Reader, readJsonObject } from "../http";
import { hashClientRef, loadPublicOrder, placeOrder } from "../orders";
import { type PricingRow, parsePricing, pricingStatement } from "../pricing";
import { publicGet, publicPost, type Route, type RouteContext } from "../router";
import { ACTIVE_TABLE_LIST_SQL, PRODUCT_LIST_SQL, type ProductRow, serializeProduct, serializeTable, type TableRow } from "../rows";

// Self-order limits (server-owned; the client cannot change them). Counters are atomic upserts in
// `auth_throttle`, so parallel requests cannot all pass the check.
const PUBLIC_MAX_LINES = 30;
const PUBLIC_MAX_QTY = 99;
const RATE_WINDOW_MS = 60_000;
const PUBLIC_TABLE_LIMIT_PER_MINUTE = 6;
/** One restaurant Wi-Fi shares an address, so the per-IP budget is far above the per-table one. */
const PUBLIC_IP_LIMIT_PER_MINUTE = 60;
const PUBLIC_GLOBAL_LIMIT_PER_MINUTE = 120;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

async function publicMenu({ env }: RouteContext): Promise<Response> {
  const [products, tables, pricing] = await batchTyped<[ProductRow, TableRow, PricingRow]>(env.DB, [
    env.DB.prepare(PRODUCT_LIST_SQL),
    env.DB.prepare(ACTIVE_TABLE_LIST_SQL),
    pricingStatement(env),
  ]);
  return json({
    data: {
      products: products.map(serializeProduct),
      tables: tables.map(serializeTable),
      pricing: parsePricing(pricing),
    },
  });
}

function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, " ").trim();
}

async function withinRateLimits(context: RouteContext, tableId: string): Promise<boolean> {
  const { env, request } = context;
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const [ipKey, tableKey, globalKey] = await Promise.all([
    sha256Hex(`public-order-ip:${ip}`),
    sha256Hex(`public-order-table:${tableId}`),
    sha256Hex("public-order-global"),
  ]);
  // Sequential on purpose: an address that is already over its budget must not burn table/global quota.
  return (
    (await consumeAttempt(env, ipKey, PUBLIC_IP_LIMIT_PER_MINUTE, RATE_WINDOW_MS)) &&
    (await consumeAttempt(env, tableKey, PUBLIC_TABLE_LIMIT_PER_MINUTE, RATE_WINDOW_MS)) &&
    (await consumeAttempt(env, globalKey, PUBLIC_GLOBAL_LIMIT_PER_MINUTE, RATE_WINDOW_MS))
  );
}

/**
 * Anonymous self-order. The client only chooses a table, items, quantities and notes plus a random
 * `clientRef` key (idempotency + the customer's secret for status lookups). The server assigns the
 * order number, prices every line from the database, decrements stock and stores it unpaid / pay-later.
 */
async function createPublicOrder(context: RouteContext): Promise<Response> {
  const { env, request } = context;
  const r = new Reader(await readJsonObject(request));
  const tableId = r.string("tableId", { max: 100, min: 1 });
  const customerNameInput = r.string("customerName", { max: 120, optional: true });
  const guests = r.integer("guests", { min: 1, max: 100, optional: true });
  const paymentChoice = r.oneOf("paymentChoice", ["paid-now", "pay-later"] as const, { optional: true });
  const expectedTotal = r.integer("expectedTotal", { min: 0, max: MAX_MONEY });
  const clientRef = r.string("clientRef", { max: 100, min: 1 });

  const lines: { barcode: string; qty: number; note: string | null }[] = [];
  r.array("items", { min: 1, max: PUBLIC_MAX_LINES }).forEach((entry, i) => {
    // `itemId` is the product id exposed by the menu API, i.e. the barcode.
    const lr = r.child({ ...entry, barcode: entry.barcode ?? entry.itemId }, `items.${i}`);
    const barcode = lr.string("barcode", { max: 100, min: 1 });
    const qty = lr.integer("qty", { min: 1, max: PUBLIC_MAX_QTY });
    const note = lr.string("note", { max: 200, optional: true });
    lines.push({ barcode, qty, note: note !== undefined && cleanText(note) !== "" ? cleanText(note) : null });
  });
  if (paymentChoice === "paid-now") {
    r.addError("paymentChoice", "Bayar langsung dilakukan lewat QRIS setelah pesanan dibuat; kirim pesanan sebagai pay-later.");
  }
  r.done();

  const clientRefHash = await hashClientRef("clientRef", clientRef);
  const customerName = (customerNameInput !== undefined ? cleanText(customerNameInput) : "") || "Pelanggan Meja";

  // Retries of an already-stored order are answered before rate limiting (they create nothing).
  const replay = await env.DB.prepare("SELECT 1 AS found FROM orders WHERE client_ref = ?").bind(clientRefHash).first();
  if (!replay && !(await withinRateLimits(context, tableId))) {
    throw new HttpError(429, "Terlalu banyak pesanan; coba lagi sebentar.", undefined, { "Retry-After": "30" });
  }

  const result = await placeOrder(env, {
    lines,
    discount: 0,
    orderType: "meja",
    tableId,
    tableName: null,
    guests: guests ?? null,
    customerName,
    waiterId: null,
    waiterName: null,
    source: "self-order",
    paymentChoice: "pay-later",
    kitchenStatus: "queued",
    payment: null,
    expectedTotal,
    clientRefHash,
    staffName: null,
  });
  const order = await loadPublicOrder(env, result.order.no, clientRef);
  return json({ data: order, replayed: result.replayed }, result.replayed ? 200 : 201);
}

/** GET /api/public/orders/{no}?key=<clientRef>: live status and e-receipt for the customer. */
async function getPublicOrder({ env, url, params }: RouteContext): Promise<Response> {
  const key = url.searchParams.get("key") ?? "";
  return json({ data: await loadPublicOrder(env, Number(params.no), key) });
}

export const publicRoutes: Route[] = [
  publicGet("/api/public/menu", publicMenu),
  publicPost("/api/public/orders", createPublicOrder),
  publicGet("/api/public/orders/:no(\\d{1,15})", getPublicOrder),
];
