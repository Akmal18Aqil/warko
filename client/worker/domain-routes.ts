import { requireRole, requireSession } from "./auth";
import type { Env, SessionStaff, StaffRole } from "./env";
import { errorResponse, HttpError, json, readJsonObject, Reader } from "./http";
import {
  hashClientRef,
  KITCHEN_STATUSES,
  loadOrder,
  MAX_MONEY,
  operationalOrderStatements,
  PAYMENT_METHODS,
  placeOrder,
  rangeOrderStatements,
  serializeOrders,
  setKitchenStatus,
  settleOrder,
} from "./orders";
import { loadPricing, parsePricing, parsePricingInput, pricingStatement, savePricing, type PricingRow } from "./pricing";

const ORDER_TYPES = ["bawa-pulang", "meja"] as const;
const ORDER_SOURCES = ["pos", "waiter", "self-order"] as const;
const PAYMENT_CHOICES = ["paid-now", "pay-later"] as const;
const STOCK_MODES = ["set", "add"] as const;

/** Every signed-in role may read menu, orders, tables and categories. */
const READ_ROLES: readonly StaffRole[] = ["admin", "kasir", "pelayan", "dapur", "manajer"];
/** Roles allowed to create orders (POS, waiter app). */
const CREATE_ORDER_ROLES: readonly StaffRole[] = ["admin", "kasir", "pelayan"];
/** Roles allowed to move an order through its kitchen lifecycle. */
const UPDATE_STATUS_ROLES: readonly StaffRole[] = ["admin", "kasir", "pelayan", "dapur"];
/** Roles allowed to record a payment when creating an order (cashier, waiter collecting at the table). */
const CREATE_PAID_ROLES: readonly StaffRole[] = ["admin", "kasir", "pelayan"];
/** Roles allowed to settle an existing unpaid order at the cash register. */
const SETTLE_ROLES: readonly StaffRole[] = ["admin", "kasir"];
/** Owner dashboard, reports and exports. */
const REPORT_ROLES: readonly StaffRole[] = ["admin", "kasir", "manajer"];
/** Ready-stock adjustments (owner / manager and cashier). */
const STOCK_ROLES: readonly StaffRole[] = ["admin", "kasir", "manajer"];
/** Cash-drawer data (shifts, cash movements) is financial; hide it from floor/kitchen staff. */
const FINANCE_ROLES: readonly StaffRole[] = ["admin", "kasir", "manajer"];
/** Pricing (tax / service charge) settings are managed by the roles that manage menu and tables. */
const PRICING_WRITE_ROLES: readonly StaffRole[] = ["admin", "kasir"];

const MAX_ORDER_LINES = 40;
const MAX_QTY = 999;
const MAX_STOCK = 1_000_000;
/** Reports cover at most a little over a year per request. */
const MAX_REPORT_RANGE_MS = 400 * 24 * 60 * 60 * 1000;

const ORDER_ACTION_PATH = /^\/api\/orders\/(\d{1,15})\/(status|payment)$/;
const STOCK_PATH = /^\/api\/products\/([A-Za-z0-9_.:-]{1,100})\/stock$/;

// ---- row types -----------------------------------------------------------

type ProductRow = {
  id: string;
  barcode: string;
  name: string;
  description: string;
  price: number;
  category: string;
  kind: string;
  prep_minutes: number;
  badge: string | null;
  image: string;
  stock: number | null;
};

type TableRow = { id: string; name: string; seats: number; area: string; active: number };

type CategoryRow = {
  id: string;
  name: string;
  kind: string;
  color: string | null;
  sort_order: number;
  is_default: number;
  created_at: number;
};

type ShiftRow = {
  id: string;
  opened_at: number;
  closed_at: number | null;
  cashier_name: string;
  starting_cash: number;
  actual_cash: number | null;
  expected_cash: number | null;
  cash_difference: number | null;
  cash_sales_total: number | null;
  cash_in_total: number | null;
  cash_out_total: number | null;
  denominations: string | null;
  status: string;
  notes: string | null;
};

type CashMovementRow = {
  id: string;
  shift_id: string | null;
  type: string;
  category: string;
  amount: number;
  description: string;
  cashier_name: string;
  occurred_at: number;
};

// ---- serializers ---------------------------------------------------------

const PRODUCT_SQL = `SELECT id, barcode, name, description, price, category, kind, prep_minutes, badge, image, stock
  FROM products WHERE is_active = 1 ORDER BY name`;

const TABLE_SQL = "SELECT id, name, seats, area, active FROM restaurant_tables ORDER BY name";
const CATEGORY_SQL = "SELECT id, name, kind, color, sort_order, is_default, created_at FROM categories ORDER BY sort_order";
const SHIFT_SQL = `SELECT id, opened_at, closed_at, cashier_name, starting_cash, actual_cash, expected_cash,
  cash_difference, cash_sales_total, cash_in_total, cash_out_total, denominations, status, notes
  FROM shifts ORDER BY opened_at DESC`;
const CASH_MOVEMENT_SQL = `SELECT id, shift_id, type, category, amount, description, cashier_name, occurred_at
  FROM cash_movements ORDER BY occurred_at DESC`;

function serializeProduct(p: ProductRow) {
  return {
    id: p.barcode,
    barcode: p.barcode,
    name: p.name,
    description: p.description,
    price: p.price,
    category: p.category,
    kind: p.kind,
    prepMinutes: p.prep_minutes,
    badge: p.badge,
    image: p.image,
    stock: p.stock,
  };
}

function serializeTable(t: TableRow) {
  return { id: t.id, name: t.name, seats: t.seats, area: t.area, active: t.active === 1 };
}

function serializeCategory(c: CategoryRow) {
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    color: c.color,
    sortOrder: c.sort_order,
    isDefault: c.is_default === 1,
    createdAt: c.created_at,
  };
}

function parseDenominations(raw: string | null): Record<string, unknown> | null {
  if (raw === null || raw === "") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function serializeShift(s: ShiftRow) {
  return {
    id: s.id,
    openedAt: s.opened_at,
    closedAt: s.closed_at,
    cashierName: s.cashier_name,
    startingCash: s.starting_cash,
    actualCash: s.actual_cash,
    expectedCash: s.expected_cash,
    cashDifference: s.cash_difference,
    cashSalesTotal: s.cash_sales_total,
    cashInTotal: s.cash_in_total,
    cashOutTotal: s.cash_out_total,
    denominations: parseDenominations(s.denominations),
    status: s.status,
    notes: s.notes,
  };
}

function serializeCashMovement(m: CashMovementRow) {
  return {
    id: m.id,
    shiftId: m.shift_id,
    type: m.type,
    category: m.category,
    amount: m.amount,
    description: m.description,
    cashierName: m.cashier_name,
    createdAt: m.occurred_at,
  };
}

// ---- guards --------------------------------------------------------------

/** Same-origin CSRF guard for state-changing requests (cookie-authenticated API). */
function assertSameOrigin(request: Request, url: URL): void {
  const origin = request.headers.get("Origin");
  if (origin !== null) {
    if (origin !== url.origin) throw new HttpError(403, "Permintaan lintas-origin ditolak.");
    return;
  }
  // No Origin header: only accept browsers that vouch for same-origin / user-initiated requests.
  const site = request.headers.get("Sec-Fetch-Site");
  if (site === "same-origin" || site === "none") return;
  throw new HttpError(403, "Permintaan lintas-origin ditolak.");
}

function methodNotAllowed(...allowed: string[]): HttpError {
  return new HttpError(405, "Metode tidak diizinkan.", undefined, { Allow: allowed.join(", ") });
}

// ---- handlers ------------------------------------------------------------

async function listProducts(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(PRODUCT_SQL).all<ProductRow>();
  return json({ data: results.map(serializeProduct) });
}

async function listOrders(env: Env): Promise<Response> {
  const [orders, items] = await env.DB.batch(operationalOrderStatements(env));
  return json({ data: serializeOrders(orders.results, items.results) });
}

async function bootstrap(env: Env, staff: SessionStaff): Promise<Response> {
  const finance = FINANCE_ROLES.includes(staff.role);
  const statements = [
    env.DB.prepare(PRODUCT_SQL),
    ...operationalOrderStatements(env),
    env.DB.prepare(TABLE_SQL),
    env.DB.prepare(CATEGORY_SQL),
    pricingStatement(env),
  ];
  if (finance) statements.push(env.DB.prepare(SHIFT_SQL), env.DB.prepare(CASH_MOVEMENT_SQL));

  // One D1 batch = one consistent snapshot.
  const r = await env.DB.batch(statements);
  return json({
    data: {
      products: (r[0].results as ProductRow[]).map(serializeProduct),
      orders: serializeOrders(r[1].results, r[2].results),
      tables: (r[3].results as TableRow[]).map(serializeTable),
      categories: (r[4].results as CategoryRow[]).map(serializeCategory),
      pricing: parsePricing(r[5].results as PricingRow[]),
      shifts: finance ? (r[6].results as ShiftRow[]).map(serializeShift) : [],
      cashMovements: finance ? (r[7].results as CashMovementRow[]).map(serializeCashMovement) : [],
    },
  });
}

async function createOrder(env: Env, request: Request, staff: SessionStaff): Promise<Response> {
  const body = await readJsonObject(request);
  const r = new Reader(body);

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
  r.done();
  if (method !== undefined && !CREATE_PAID_ROLES.includes(staff.role)) {
    throw new HttpError(403, "Peran Anda tidak diizinkan menerima pembayaran.");
  }
  if (orderType === "meja" && !tableId && !tableName?.trim()) {
    throw new HttpError(422, "Data yang dikirim tidak valid.", { tableId: ["Pilih meja untuk pesanan dine-in."] });
  }

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

async function updateOrderStatus(env: Env, request: Request, no: number): Promise<Response> {
  const r = new Reader(await readJsonObject(request));
  const kitchenStatus = r.oneOf("kitchenStatus", KITCHEN_STATUSES);
  r.done();
  return json({ data: await setKitchenStatus(env, no, kitchenStatus) });
}

async function payExistingOrder(env: Env, request: Request, no: number, staff: SessionStaff): Promise<Response> {
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

async function reportOrders(env: Env, url: URL): Promise<Response> {
  const from = Number(url.searchParams.get("from"));
  const to = Number(url.searchParams.get("to"));
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to <= from || to - from > MAX_REPORT_RANGE_MS) {
    throw new HttpError(422, "Data yang dikirim tidak valid.", {
      range: ["from/to harus epoch milidetik dengan rentang maksimal 400 hari."],
    });
  }
  const [orders, items] = await env.DB.batch(rangeOrderStatements(env, from, to));
  return json({ data: serializeOrders(orders.results, items.results) });
}

/** POST /api/products/{barcode}/stock — set or add ready stock; `stock: null` stops tracking. */
async function adjustStock(env: Env, request: Request, barcode: string, staff: SessionStaff): Promise<Response> {
  const body = await readJsonObject(request);
  const r = new Reader(body);
  const mode = r.oneOf("mode", STOCK_MODES);
  const qty = r.integer("qty", { min: mode === "add" ? -MAX_STOCK : 0, max: MAX_STOCK, optional: true });
  r.done();
  const untrack = mode === "set" && body.qty === null;
  if (!untrack && qty === undefined) throw new HttpError(422, "Data yang dikirim tidak valid.", { qty: ["qty wajib diisi."] });

  const product = await env.DB.prepare("SELECT id, stock FROM products WHERE barcode = ? AND is_active = 1")
    .bind(barcode)
    .first<{ id: string; stock: number | null }>();
  if (!product) throw new HttpError(404, "Produk tidak ditemukan.");
  const now = Date.now();

  let update: D1PreparedStatement;
  let delta: number;
  if (untrack) {
    update = env.DB.prepare("UPDATE products SET stock = NULL, updated_at = ? WHERE id = ?").bind(now, product.id);
    delta = 0;
  } else if (mode === "set") {
    update = env.DB.prepare("UPDATE products SET stock = ?, updated_at = ? WHERE id = ?").bind(qty, now, product.id);
    delta = qty! - (product.stock ?? 0);
  } else {
    if (product.stock === null) throw new HttpError(409, "Stok produk ini belum dilacak; atur jumlah stok terlebih dahulu.");
    // Relative update so concurrent sales are not overwritten; the CHECK rejects a negative result.
    update = env.DB.prepare("UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ? AND stock IS NOT NULL").bind(qty, now, product.id);
    delta = qty!;
  }
  try {
    await env.DB.batch([
      update,
      env.DB.prepare(
        `INSERT INTO stock_movements (product_id, delta, stock_after, reason, order_no, staff_name, created_at)
         VALUES (?, ?, (SELECT stock FROM products WHERE id = ?), ?, NULL, ?, ?)`,
      ).bind(product.id, delta, product.id, mode === "add" && delta > 0 ? "restock" : "adjust", staff.name, now),
    ]);
  } catch (error) {
    if (mode === "add") throw new HttpError(409, "Stok tidak boleh kurang dari 0.");
    throw error;
  }
  const row = await env.DB.prepare(`${PRODUCT_SQL.replace(" ORDER BY name", "")} AND id = ?`).bind(product.id).first<ProductRow>();
  return json({ data: serializeProduct(row!) });
}

function parseOrderNo(raw: string): number {
  const no = Number(raw);
  if (!Number.isSafeInteger(no) || no < 1) throw new HttpError(404, "Pesanan tidak ditemukan.");
  return no;
}

// ---- entry point ---------------------------------------------------------

export async function handleDomain(request: Request, env: Env, url: URL): Promise<Response | null> {
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  const actionMatch = ORDER_ACTION_PATH.exec(path);
  const stockMatch = STOCK_PATH.exec(path);
  const orderMatch = /^\/api\/orders\/(\d{1,15})$/.exec(path);
  const known =
    path === "/api/products" ||
    path === "/api/bootstrap" ||
    path === "/api/orders" ||
    path === "/api/pricing" ||
    path === "/api/reports/orders" ||
    actionMatch !== null ||
    stockMatch !== null ||
    orderMatch !== null;
  if (!known) return null;

  try {
    const method = request.method;

    if (path === "/api/products" || path === "/api/bootstrap") {
      if (method !== "GET") throw methodNotAllowed("GET");
      const staff = await requireSession(env, request, url);
      requireRole(staff, ...READ_ROLES);
      return path === "/api/products" ? await listProducts(env) : await bootstrap(env, staff);
    }

    if (path === "/api/orders") {
      if (method === "GET") {
        const staff = await requireSession(env, request, url);
        requireRole(staff, ...READ_ROLES);
        return await listOrders(env);
      }
      if (method === "POST") {
        assertSameOrigin(request, url);
        const staff = await requireSession(env, request, url);
        requireRole(staff, ...CREATE_ORDER_ROLES);
        return await createOrder(env, request, staff);
      }
      throw methodNotAllowed("GET", "POST");
    }

    if (orderMatch) {
      if (method !== "GET") throw methodNotAllowed("GET");
      const staff = await requireSession(env, request, url);
      requireRole(staff, ...READ_ROLES);
      const order = await loadOrder(env, parseOrderNo(orderMatch[1]));
      if (!order) throw new HttpError(404, "Pesanan tidak ditemukan.");
      return json({ data: order });
    }

    if (path === "/api/reports/orders") {
      if (method !== "GET") throw methodNotAllowed("GET");
      const staff = await requireSession(env, request, url);
      requireRole(staff, ...REPORT_ROLES);
      return await reportOrders(env, url);
    }

    if (path === "/api/pricing") {
      if (method === "GET") {
        const staff = await requireSession(env, request, url);
        requireRole(staff, ...READ_ROLES);
        return json({ data: await loadPricing(env) });
      }
      if (method === "PUT") {
        assertSameOrigin(request, url);
        const staff = await requireSession(env, request, url);
        requireRole(staff, ...PRICING_WRITE_ROLES);
        const pricing = parsePricingInput(await readJsonObject(request));
        return json({ data: await savePricing(env, pricing) });
      }
      throw methodNotAllowed("GET", "PUT");
    }

    if (stockMatch) {
      if (method !== "POST") throw methodNotAllowed("POST");
      assertSameOrigin(request, url);
      const staff = await requireSession(env, request, url);
      requireRole(staff, ...STOCK_ROLES);
      return await adjustStock(env, request, stockMatch[1], staff);
    }

    // PATCH /api/orders/{no}/status | POST /api/orders/{no}/payment
    const [, rawNo, action] = actionMatch!;
    const expected = action === "status" ? "PATCH" : "POST";
    if (method !== expected) throw methodNotAllowed(expected);
    assertSameOrigin(request, url);
    const staff = await requireSession(env, request, url);
    const no = parseOrderNo(rawNo);
    if (action === "status") {
      requireRole(staff, ...UPDATE_STATUS_ROLES);
      return await updateOrderStatus(env, request, no);
    }
    requireRole(staff, ...SETTLE_ROLES);
    return await payExistingOrder(env, request, no, staff);
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error);
    throw error;
  }
}
