import { sha256Hex } from "./crypto";
import type { Env } from "./env";
import { HttpError } from "./http";
import { calculateCharges, MAX_MONEY, type KitchenStatus, type OrderSource, type PayMethod } from "@wakro/shared";
import { assertExpectedTotal, parsePricing, pricingStatement, type PricingRow } from "./pricing";

/**
 * Order lifecycle shared by staff (POS / waiter) and public (self-order) endpoints.
 *
 * Two independent lifecycles:
 *   payment_status: unpaid -> paid (-> refunded)
 *   kitchen_status: queued -> preparing -> ready -> served
 * The legacy `status` column is derived from kitchen_status and is never used to decide payment.
 */

export { KITCHEN_STATUSES, MAX_MONEY, PAYMENT_METHODS, type KitchenStatus, type OrderSource } from "@wakro/shared";
export type PaymentMethod = PayMethod;
const PLACE_ATTEMPTS = 4;
/** Operational views (POS, KDS, tables) only need recent or still-open orders. */
const OPERATIONAL_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Client idempotency keys: random, URL-safe, at least 128 bits. */
const CLIENT_REF_PATTERN = /^[A-Za-z0-9_-]{22,100}$/;

export function legacyStatus(kitchen: KitchenStatus): "disimpan" | "memasak" | "siap" | "sudah-dibayar" {
  switch (kitchen) {
    case "draft":
      return "disimpan";
    case "queued":
    case "preparing":
      return "memasak";
    case "ready":
      return "siap";
    case "served":
      return "sudah-dibayar";
  }
}

export async function hashClientRef(field: string, value: string): Promise<string> {
  if (!CLIENT_REF_PATTERN.test(value)) {
    throw new HttpError(422, "Data yang dikirim tidak valid.", {
      [field]: [`${field} harus berupa kunci acak 22-100 karakter (huruf, angka, - atau _).`],
    });
  }
  return sha256Hex(`order-ref:${value}`);
}

// ---- rows and serialization ------------------------------------------------

type OrderDbRow = {
  no: number;
  status: string;
  payment_status: string;
  kitchen_status: string;
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  service_charge: number;
  item_count: number;
  method: string | null;
  order_type: string;
  table_id: string | null;
  table_number: number | null;
  table_name: string | null;
  table_area: string | null;
  guests: number | null;
  customer_name: string | null;
  waiter_id: string | null;
  waiter_name: string | null;
  source: string | null;
  payment_choice: string | null;
  cash_received: number | null;
  paid_by: string | null;
  paid_at: number | null;
  created_at: number;
};

type OrderItemDbRow = {
  order_no: number;
  barcode: string | null;
  product_id: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
  note: string | null;
};

const ORDER_SELECT = `SELECT o.no, o.status, o.payment_status, o.kitchen_status, o.total, o.subtotal, o.tax, o.discount,
  o.service_charge, o.item_count, o.method, o.order_type, o.table_id, o.table_number, o.table_name,
  t.area AS table_area, o.guests, o.customer_name, o.waiter_id, o.waiter_name, o.source, o.payment_choice,
  o.cash_received, o.paid_by, o.paid_at, o.created_at
  FROM orders o LEFT JOIN restaurant_tables t ON t.id = o.table_id`;

const ITEM_SELECT = `SELECT oi.order_no, p.barcode, oi.product_id, oi.product_name, oi.qty, oi.unit_price, oi.note
  FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id`;

/** Orders the operational screens need: recent, still open, or inside the open cash shift. */
function operationalWindowStart(now: number): string {
  return `MIN(${now - OPERATIONAL_WINDOW_MS}, COALESCE((SELECT MIN(opened_at) FROM shifts WHERE status = 'OPEN'), ${now}))`;
}

export function operationalOrderStatements(env: Env): [D1PreparedStatement, D1PreparedStatement] {
  const since = operationalWindowStart(Date.now());
  const where = `o.created_at >= ${since} OR o.paid_at >= ${since} OR o.payment_status = 'unpaid' OR o.kitchen_status NOT IN ('served', 'draft')`;
  return [
    env.DB.prepare(`${ORDER_SELECT} WHERE ${where} ORDER BY o.no DESC`),
    env.DB.prepare(`${ITEM_SELECT} WHERE oi.order_no IN (SELECT o.no FROM orders o WHERE ${where}) ORDER BY oi.order_no DESC, oi.id ASC`),
  ];
}

/** Orders created or paid inside [from, to) for reports and exports. */
export function rangeOrderStatements(env: Env, from: number, to: number): [D1PreparedStatement, D1PreparedStatement] {
  const where = "(o.created_at >= ?1 AND o.created_at < ?2) OR (o.paid_at >= ?1 AND o.paid_at < ?2)";
  return [
    env.DB.prepare(`${ORDER_SELECT} WHERE ${where} ORDER BY o.no DESC`).bind(from, to),
    env.DB.prepare(`${ITEM_SELECT} WHERE oi.order_no IN (SELECT o.no FROM orders o WHERE ${where}) ORDER BY oi.order_no DESC, oi.id ASC`).bind(from, to),
  ];
}

type OrderItemJson = { itemId: string; name: string; qty: number; price: number; note: string | null };

function serializeItem(i: OrderItemDbRow): OrderItemJson {
  return { itemId: i.barcode ?? String(i.product_id ?? ""), name: i.product_name, qty: i.qty, price: i.unit_price, note: i.note };
}

/** JSON shape of an order returned by every order endpoint (same keys as the client `OrderRow`). */
export interface OrderJson {
  no: number;
  status: string;
  paymentStatus: string;
  kitchenStatus: string;
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  serviceCharge: number;
  itemCount: number;
  items: OrderItemJson[];
  method: string | null;
  orderType: string;
  tableId: string | null;
  tableNumber: number | null;
  tableName: string | null;
  tableArea: string | null;
  guests: number | null;
  customerName: string | null;
  waiterId: string | null;
  waiterName: string | null;
  source: string | null;
  paymentChoice: string | null;
  cashReceived: number | null;
  paidBy: string | null;
  paidAt: number | null;
  createdAt: number;
}

function serializeOrder(o: OrderDbRow, items: OrderItemJson[]): OrderJson {
  return {
    no: o.no,
    status: o.status,
    paymentStatus: o.payment_status,
    kitchenStatus: o.kitchen_status,
    total: o.total,
    subtotal: o.subtotal,
    tax: o.tax,
    discount: o.discount,
    serviceCharge: o.service_charge,
    itemCount: o.item_count,
    items,
    method: o.method,
    orderType: o.order_type,
    tableId: o.table_id,
    tableNumber: o.table_number,
    tableName: o.table_name,
    tableArea: o.table_area,
    guests: o.guests,
    customerName: o.customer_name,
    waiterId: o.waiter_id,
    waiterName: o.waiter_name,
    source: o.source,
    paymentChoice: o.payment_choice,
    cashReceived: o.cash_received,
    paidBy: o.paid_by,
    paidAt: o.paid_at,
    createdAt: o.created_at,
  };
}

export function serializeOrders(orders: unknown[], items: unknown[]): OrderJson[] {
  const byOrder = new Map<number, OrderItemJson[]>();
  for (const item of items as OrderItemDbRow[]) {
    const list = byOrder.get(item.order_no);
    if (list) list.push(serializeItem(item));
    else byOrder.set(item.order_no, [serializeItem(item)]);
  }
  return (orders as OrderDbRow[]).map((o) => serializeOrder(o, byOrder.get(o.no) ?? []));
}

export async function loadOrder(env: Env, no: number): Promise<OrderJson | null> {
  const [orders, items] = await env.DB.batch([
    env.DB.prepare(`${ORDER_SELECT} WHERE o.no = ?`).bind(no),
    env.DB.prepare(`${ITEM_SELECT} WHERE oi.order_no = ? ORDER BY oi.id ASC`).bind(no),
  ]);
  return serializeOrders(orders.results, items.results)[0] ?? null;
}

async function orderNoByClientRef(env: Env, clientRefHash: string): Promise<number | null> {
  const row = await env.DB.prepare("SELECT no FROM orders WHERE client_ref = ?").bind(clientRefHash).first<{ no: number }>();
  return row?.no ?? null;
}

// ---- placing orders --------------------------------------------------------

export type OrderLineInput = { barcode: string; qty: number; note: string | null };

export type PlaceOrderInput = {
  lines: OrderLineInput[];
  discount: number;
  orderType: "bawa-pulang" | "meja";
  tableId: string | null;
  /** Free-text table label, only used when no tableId is given (legacy clients). */
  tableName: string | null;
  guests: number | null;
  customerName: string | null;
  waiterId: string | null;
  waiterName: string | null;
  source: OrderSource;
  paymentChoice: "paid-now" | "pay-later" | null;
  kitchenStatus: KitchenStatus;
  /** Present when the order is paid at creation (cashier / waiter collected the money). */
  payment: { method: PaymentMethod; cashReceived: number | null; paidBy: string } | null;
  expectedTotal: number;
  clientRefHash: string | null;
  staffName: string | null;
};

export type PlaceOrderResult = { order: OrderJson; replayed: boolean };

type ProductStockRow = { id: string; barcode: string; name: string; price: number; stock: number | null };

function stockError(shortages: { name: string; stock: number }[]): HttpError {
  const errors: Record<string, string[]> = {};
  for (const s of shortages) {
    errors[`stock.${s.name}`] = [s.stock === 0 ? `${s.name} sudah HABIS.` : `Stok ${s.name} tinggal ${s.stock}.`];
  }
  const list = shortages.map((s) => (s.stock === 0 ? `${s.name} habis` : `${s.name} sisa ${s.stock}`)).join(", ");
  return new HttpError(409, `Stok tidak mencukupi: ${list}.`, errors);
}

/**
 * Prices every line from the database, checks and decrements ready stock, and stores the order with
 * all of its items in one atomic D1 batch. A stock CHECK constraint aborts the batch if a concurrent
 * order took the last portions, so stock can never go negative.
 */
export async function placeOrder(env: Env, input: PlaceOrderInput): Promise<PlaceOrderResult> {
  if (input.clientRefHash) {
    const existing = await orderNoByClientRef(env, input.clientRefHash);
    if (existing !== null) return { order: (await loadOrder(env, existing))!, replayed: true };
  }

  const barcodes = [...new Set(input.lines.map((l) => l.barcode))];
  const placeholders = barcodes.map(() => "?").join(", ");
  let lastError: unknown;

  for (let attempt = 0; attempt < PLACE_ATTEMPTS; attempt++) {
    const reads: D1PreparedStatement[] = [
      env.DB.prepare(`SELECT id, barcode, name, price, stock FROM products WHERE is_active = 1 AND barcode IN (${placeholders})`).bind(...barcodes),
      pricingStatement(env),
      env.DB.prepare("SELECT COALESCE(MAX(no), 1048) + 1 AS no FROM orders"),
    ];
    if (input.tableId) reads.push(env.DB.prepare("SELECT id, name FROM restaurant_tables WHERE id = ? AND active = 1").bind(input.tableId));
    // One batch = one consistent snapshot of products, pricing, the next number and the table.
    const snapshot = await env.DB.batch(reads);
    const products = new Map((snapshot[0].results as ProductStockRow[]).map((p) => [p.barcode, p]));
    const pricing = parsePricing(snapshot[1].results as PricingRow[]);
    // Rows come from the SELECTs above; D1 batch results are untyped across mixed statements.
    const nextNoRows = snapshot[2].results as { no: number }[];
    const tableRows = (input.tableId ? snapshot[3].results : []) as { id: string; name: string }[];
    const no = nextNoRows[0].no;
    const table = tableRows[0];
    if (input.tableId && !table) {
      throw new HttpError(422, "Data yang dikirim tidak valid.", { tableId: ["Meja tidak ditemukan atau tidak aktif."] });
    }

    const missing: Record<string, string[]> = {};
    const resolved = input.lines.map((line, i) => {
      const product = products.get(line.barcode);
      if (!product) missing[`items.${i}.barcode`] = [`Menu pada baris ${i + 1} tidak ditemukan atau tidak tersedia.`];
      return { product: product!, line };
    });
    if (Object.keys(missing).length > 0) throw new HttpError(422, "Data yang dikirim tidak valid.", missing);

    const qtyByProduct = new Map<string, { product: ProductStockRow; qty: number }>();
    let rawSubtotal = 0;
    let itemCount = 0;
    for (const { product, line } of resolved) {
      rawSubtotal += product.price * line.qty;
      itemCount += line.qty;
      const entry = qtyByProduct.get(product.id);
      if (entry) entry.qty += line.qty;
      else qtyByProduct.set(product.id, { product, qty: line.qty });
    }
    const shortages = [...qtyByProduct.values()]
      .filter(({ product, qty }) => product.stock !== null && qty > product.stock)
      .map(({ product }) => ({ name: product.name, stock: product.stock ?? 0 }));
    if (shortages.length > 0) throw stockError(shortages);

    const discount = Math.min(rawSubtotal, input.discount);
    const subtotal = rawSubtotal - discount;
    const { serviceCharge, tax, total } = calculateCharges(subtotal, pricing);
    if (total > MAX_MONEY) throw new HttpError(422, "Data yang dikirim tidak valid.", { items: ["Total pesanan terlalu besar."] });
    // The customer/cashier confirmed `expectedTotal`; never store a different amount silently.
    assertExpectedTotal(input.expectedTotal, total);
    if (input.payment?.method === "tunai" && (input.payment.cashReceived ?? -1) < total) {
      throw new HttpError(422, "Data yang dikirim tidak valid.", { cashReceived: ["Uang diterima kurang dari total."] });
    }

    const now = Date.now();
    const tableName = table?.name ?? (input.orderType === "meja" ? input.tableName : null);
    const tableDigits = tableName ? /\d+/.exec(tableName)?.[0] : undefined;
    const tableNumber = tableDigits !== undefined && Number(tableDigits) >= 1 && Number.isSafeInteger(Number(tableDigits)) ? Number(tableDigits) : null;
    const paid = input.payment !== null;

    const orderValues = [
      no,
      legacyStatus(input.kitchenStatus),
      paid ? "paid" : "unpaid",
      input.kitchenStatus,
      input.orderType,
      tableNumber,
      tableName,
      input.guests,
      input.customerName,
      input.waiterId,
      input.waiterName,
      input.source,
      input.paymentChoice,
      itemCount,
      subtotal,
      discount,
      serviceCharge,
      tax,
      total,
      input.payment?.method ?? null,
      paid ? now : null,
      input.payment?.cashReceived ?? null,
      input.payment?.paidBy ?? null,
      table?.id ?? null,
      input.clientRefHash,
      now,
      now,
    ];
    const orderColumns = `no, status, payment_status, kitchen_status, order_type, table_number, table_name, guests,
      customer_name, waiter_id, waiter_name, source, payment_choice, item_count, subtotal, discount, service_charge,
      tax, total, method, paid_at, cash_received, paid_by, table_id, client_ref, created_at, updated_at`;
    const valueSlots = orderValues.map(() => "?").join(", ");

    const statements: D1PreparedStatement[] = [
      table
        ? // Zero rows (and a failing item insert below) if the table was deactivated meanwhile.
          env.DB.prepare(`INSERT INTO orders (${orderColumns}) SELECT ${valueSlots} FROM restaurant_tables WHERE id = ? AND active = 1`).bind(
            ...orderValues,
            table.id,
          )
        : env.DB.prepare(`INSERT INTO orders (${orderColumns}) VALUES (${valueSlots})`).bind(...orderValues),
      // NULL subselects (order missing, product deactivated or repriced since the read) violate NOT NULL
      // and roll the whole batch back.
      ...resolved.map(({ product, line }) =>
        env.DB.prepare(
          `INSERT INTO order_items (order_no, product_id, product_name, unit_price, qty, note)
           VALUES ((SELECT no FROM orders WHERE no = ?), ?,
             (SELECT name FROM products WHERE id = ? AND is_active = 1 AND price = ?),
             (SELECT price FROM products WHERE id = ? AND is_active = 1 AND price = ?), ?, ?)`,
        ).bind(no, product.id, product.id, product.price, product.id, product.price, line.qty, line.note),
      ),
    ];
    for (const { product, qty } of qtyByProduct.values()) {
      if (product.stock === null) continue;
      // `stock >= 0` CHECK aborts the batch on oversell.
      statements.push(
        env.DB.prepare("UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock IS NOT NULL").bind(qty, now, product.id),
        env.DB.prepare(
          `INSERT INTO stock_movements (product_id, delta, stock_after, reason, order_no, staff_name, created_at)
           VALUES (?, ?, (SELECT stock FROM products WHERE id = ?), 'sale', ?, ?, ?)`,
        ).bind(product.id, -qty, product.id, no, input.staffName, now),
      );
    }

    try {
      await env.DB.batch(statements); // atomic: all rows or none
      return { order: (await loadOrder(env, no))!, replayed: false };
    } catch (error) {
      lastError = error;
      // A concurrent retry with the same key won: return that order instead of a duplicate.
      if (input.clientRefHash) {
        const existing = await orderNoByClientRef(env, input.clientRefHash);
        if (existing !== null) return { order: (await loadOrder(env, existing))!, replayed: true };
      }
      // Otherwise the number was taken, stock ran out or the menu changed: re-read and retry.
    }
  }
  throw lastError;
}

// ---- settlement and kitchen ---------------------------------------------------

export type SettleInput = { method: PaymentMethod; cashReceived: number | null; paidBy: string; paymentRef: string | null };

/**
 * Marks an existing unpaid order as paid. Idempotent: settling an order that is already paid returns
 * it with `alreadyPaid: true` and changes nothing (no double cash entry on retries or double clicks).
 */
export async function settleOrder(env: Env, no: number, input: SettleInput): Promise<{ order: OrderJson; alreadyPaid: boolean }> {
  const current = await env.DB.prepare("SELECT payment_status, total FROM orders WHERE no = ?").bind(no).first<{ payment_status: string; total: number }>();
  if (!current) throw new HttpError(404, "Pesanan tidak ditemukan.");
  if (current.payment_status === "paid") return { order: (await loadOrder(env, no))!, alreadyPaid: true };
  if (current.payment_status !== "unpaid") throw new HttpError(409, "Pesanan sudah direfund dan tidak dapat dibayar.");
  if (input.method === "tunai" && (input.cashReceived ?? -1) < current.total) {
    throw new HttpError(422, "Data yang dikirim tidak valid.", { cashReceived: ["Uang diterima kurang dari total."] });
  }

  const result = await env.DB.prepare(
    `UPDATE orders SET payment_status = 'paid', method = ?, paid_at = ?, cash_received = ?, paid_by = ?,
       payment_ref = COALESCE(?, payment_ref), updated_at = ?
     WHERE no = ? AND payment_status = 'unpaid' AND total = ?`,
  )
    .bind(input.method, Date.now(), input.cashReceived, input.paidBy, input.paymentRef, Date.now(), no, current.total)
    .run();
  const order = (await loadOrder(env, no))!;
  if ((result.meta.changes ?? 0) === 0) {
    if (order.paymentStatus === "paid") return { order, alreadyPaid: true };
    throw new HttpError(409, "Pesanan berubah saat diproses; muat ulang lalu coba lagi.");
  }
  return { order, alreadyPaid: false };
}

export async function setKitchenStatus(env: Env, no: number, kitchen: KitchenStatus): Promise<OrderJson> {
  const result = await env.DB.prepare("UPDATE orders SET kitchen_status = ?, status = ?, updated_at = ? WHERE no = ?")
    .bind(kitchen, legacyStatus(kitchen), Date.now(), no)
    .run();
  if (!result.meta.changes) throw new HttpError(404, "Pesanan tidak ditemukan.");
  return (await loadOrder(env, no))!;
}

/** Self-order customers read their own order with the secret key they generated when ordering. */
export async function loadPublicOrder(env: Env, no: number, key: string): Promise<OrderJson> {
  const hash = await hashClientRef("key", key);
  const row = await env.DB.prepare("SELECT no FROM orders WHERE no = ? AND client_ref = ? AND source = 'self-order'").bind(no, hash).first();
  if (!row) throw new HttpError(404, "Pesanan tidak ditemukan.");
  const order = (await loadOrder(env, no))!;
  // Staff-only details are not part of the customer view.
  return { ...order, waiterId: null, waiterName: null, paidBy: null };
}
