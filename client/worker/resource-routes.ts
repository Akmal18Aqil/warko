import { requireRole, requireSession } from "./auth";
import type { Env, SessionStaff, StaffRole } from "./env";
import { errorResponse, HttpError, json, readJsonObject, Reader } from "./http";
import { hashClientRef, loadPublicOrder, placeOrder } from "./orders";
import { parsePricing, pricingStatement, type PricingRow } from "./pricing";

// ---- policy --------------------------------------------------------------

/** Every signed-in role may read menu, tables and categories. */
const READ_ROLES: readonly StaffRole[] = ["admin", "kasir", "pelayan", "dapur", "manajer"];
/** Menu, table and category management. */
const CATALOG_WRITE_ROLES: readonly StaffRole[] = ["admin", "kasir"];
/** Cash drawer data is financial: readable and writable by these roles only. */
const FINANCE_ROLES: readonly StaffRole[] = ["admin", "kasir", "manajer"];

const KINDS = ["Makanan", "Minuman", "Camilan"] as const;
const SHIFT_STATUSES = ["OPEN", "CLOSED"] as const;
const MOVEMENT_TYPES = ["CASH_IN", "CASH_OUT"] as const;
const MOVEMENT_CATEGORIES = ["modal_awal", "operasional", "bahan_baku", "setoran", "tips", "lainnya"] as const;

const MAX_MONEY = 1_000_000_000;
const MAX_IMAGE_LENGTH = 200_000;
const MAX_DENOMINATIONS = 20;
const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/;
const IMAGE_PATTERN = /^(?:https?:\/\/\S+|\/(?!\/)\S*|data:image\/(?:png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+)$/i;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

// Public self-order limits and constants (server-owned; the client cannot change them).
const PUBLIC_MAX_LINES = 30;
const PUBLIC_MAX_QTY = 99;
const PUBLIC_TABLE_LIMIT_PER_MINUTE = 6;
const PUBLIC_GLOBAL_LIMIT_PER_MINUTE = 120;

// ---- row types and serializers (same JSON shape as /api/bootstrap) ---------

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

const PRODUCT_COLUMNS = "id, barcode, name, description, price, category, kind, prep_minutes, badge, image, stock";
const PRODUCT_LIST_SQL = `SELECT ${PRODUCT_COLUMNS} FROM products WHERE is_active = 1 ORDER BY name`;
const TABLE_COLUMNS = "id, name, seats, area, active";
const TABLE_LIST_SQL = `SELECT ${TABLE_COLUMNS} FROM restaurant_tables ORDER BY name`;
const CATEGORY_COLUMNS = "id, name, kind, color, sort_order, is_default, created_at";
const CATEGORY_LIST_SQL = `SELECT ${CATEGORY_COLUMNS} FROM categories ORDER BY sort_order`;
const SHIFT_COLUMNS = `id, opened_at, closed_at, cashier_name, starting_cash, actual_cash, expected_cash,
  cash_difference, cash_sales_total, cash_in_total, cash_out_total, denominations, status, notes`;
const SHIFT_LIST_SQL = `SELECT ${SHIFT_COLUMNS} FROM shifts ORDER BY opened_at DESC`;
const MOVEMENT_COLUMNS = "id, shift_id, type, category, amount, description, cashier_name, occurred_at";
const MOVEMENT_LIST_SQL = `SELECT ${MOVEMENT_COLUMNS} FROM cash_movements ORDER BY occurred_at DESC`;

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

// ---- guards and helpers --------------------------------------------------

/** Same-origin CSRF guard for state-changing requests (cookie-authenticated API). */
function assertSameOrigin(request: Request, url: URL): void {
  const origin = request.headers.get("Origin");
  if (origin !== null) {
    if (origin !== url.origin) throw new HttpError(403, "Permintaan lintas-origin ditolak.");
    return;
  }
  const site = request.headers.get("Sec-Fetch-Site");
  if (site === "same-origin" || site === "none") return;
  throw new HttpError(403, "Permintaan lintas-origin ditolak.");
}

function methodNotAllowed(...allowed: string[]): HttpError {
  return new HttpError(405, "Metode tidak diizinkan.", undefined, { Allow: allowed.join(", ") });
}

function invalid(field: string, message: string): HttpError {
  return new HttpError(422, "Data yang dikirim tidak valid.", { [field]: [message] });
}

function conflict(message: string): HttpError {
  return new HttpError(409, message);
}

/** Trims and requires non-blank text (Reader only checks raw length). */
function nonBlank(field: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") throw invalid(field, `${field} wajib diisi.`);
  return trimmed;
}

function assertBodyId(body: Record<string, unknown>, id: string): void {
  const bodyId = body.id;
  if (bodyId !== undefined && bodyId !== null && bodyId !== id) {
    throw invalid("id", "id pada body harus sama dengan id pada URL.");
  }
}

function validId(field: string, value: string): string {
  if (!ID_PATTERN.test(value)) throw invalid(field, `${field} hanya boleh berisi huruf, angka, titik, titik dua, garis bawah, dan strip (maks 100).`);
  return value;
}

function changes(result: D1Result): number {
  return result.meta.changes ?? 0;
}

// ---- products ------------------------------------------------------------

async function listProducts(env: Env): Promise<unknown[]> {
  const { results } = await env.DB.prepare(PRODUCT_LIST_SQL).all<ProductRow>();
  return results.map(serializeProduct);
}

async function upsertProduct(env: Env, _staff: SessionStaff, id: string, body: Record<string, unknown>): Promise<unknown> {
  const r = new Reader(body);
  const barcodeInput = r.string("barcode", { max: 100, optional: true });
  const nameInput = r.string("name", { max: 150, min: 1 });
  const description = r.string("description", { max: 1000, optional: true });
  const price = r.integer("price", { min: 0, max: MAX_MONEY });
  const categoryInput = r.string("category", { max: 100, min: 1 });
  const kind = r.oneOf("kind", KINDS);
  const prepMinutes = r.integer("prepMinutes", { min: 0, max: 1440, optional: true });
  const badgeInput = r.string("badge", { max: 60, optional: true });
  const image = r.string("image", { max: MAX_IMAGE_LENGTH, optional: true });
  r.done();

  const barcode = validId("barcode", (barcodeInput ?? id).trim());
  const name = nonBlank("name", nameInput);
  const category = nonBlank("category", categoryInput);
  const badge = badgeInput?.trim() ? badgeInput.trim() : null;
  if (image !== undefined && image !== "" && !IMAGE_PATTERN.test(image)) {
    throw invalid("image", "image harus berupa URL http(s), path relatif, atau data URI gambar.");
  }

  // Products are addressed by barcode (the id exposed in bootstrap). A client-side id that is not
  // a barcode yet (new product, or a retried create) resolves to the row owning the body barcode.
  let existing = await env.DB.prepare("SELECT id FROM products WHERE barcode = ?").bind(id).first<{ id: string }>();
  if (!existing && barcode !== id) {
    existing = await env.DB.prepare("SELECT id FROM products WHERE barcode = ?").bind(barcode).first<{ id: string }>();
  }

  const categoryExists = await env.DB.prepare("SELECT 1 AS found FROM categories WHERE name = ?").bind(category).first();
  if (!categoryExists) throw invalid("category", "category tidak ditemukan; buat kategori terlebih dahulu.");

  const now = Date.now();
  try {
    // The EXISTS guard keeps a concurrent category delete/rename from leaving a dangling category name.
    const result = existing
      ? await env.DB.prepare(
          `UPDATE products SET barcode = ?, name = ?, description = ?, price = ?, category = ?, kind = ?,
             prep_minutes = ?, badge = ?, image = ?, is_active = 1, updated_at = ?
           WHERE id = ? AND EXISTS (SELECT 1 FROM categories WHERE name = ?)`,
        )
          .bind(barcode, name, description ?? "", price, category, kind, prepMinutes ?? 5, badge, image ?? "", now, existing.id, category)
          .run()
      : await env.DB.prepare(
          `INSERT INTO products (id, barcode, name, description, price, category, kind, prep_minutes, badge, image,
             is_active, created_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?
           WHERE EXISTS (SELECT 1 FROM categories WHERE name = ?)`,
        )
          .bind(crypto.randomUUID(), barcode, name, description ?? "", price, category, kind, prepMinutes ?? 5, badge, image ?? "", now, now, category)
          .run();
    if (changes(result) === 0) throw conflict("Produk atau kategori berubah saat disimpan; muat ulang lalu coba lagi.");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const clash = await env.DB.prepare("SELECT 1 AS found FROM products WHERE barcode = ? AND id <> ?")
      .bind(barcode, existing?.id ?? "")
      .first();
    if (clash) throw invalid("barcode", "barcode sudah digunakan produk lain.");
    throw error;
  }

  const row = await env.DB.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE barcode = ?`).bind(barcode).first<ProductRow>();
  if (!row) throw conflict("Produk tidak ditemukan setelah disimpan.");
  return serializeProduct(row);
}

async function removeProduct(env: Env, _staff: SessionStaff, id: string): Promise<void> {
  const row = await env.DB.prepare("SELECT id FROM products WHERE barcode = ? OR id = ?").bind(id, id).first<{ id: string }>();
  if (!row) return;
  // Order history keeps pointing at the product id; deactivate instead of deleting when it is referenced.
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE products SET is_active = 0, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM order_items WHERE product_id = ?)",
    ).bind(Date.now(), row.id, row.id),
    env.DB.prepare(
      "DELETE FROM products WHERE id = ? AND NOT EXISTS (SELECT 1 FROM order_items WHERE product_id = ?)",
    ).bind(row.id, row.id),
  ]);
}

// ---- tables --------------------------------------------------------------

async function listTables(env: Env): Promise<unknown[]> {
  const { results } = await env.DB.prepare(TABLE_LIST_SQL).all<TableRow>();
  return results.map(serializeTable);
}

async function upsertTable(env: Env, _staff: SessionStaff, id: string, body: Record<string, unknown>): Promise<unknown> {
  assertBodyId(body, id);
  const r = new Reader(body);
  const nameInput = r.string("name", { max: 100, min: 1 });
  const seats = r.integer("seats", { min: 1, max: 1000 });
  const areaInput = r.string("area", { max: 100, min: 1 });
  const active = r.boolean("active", { optional: true });
  r.done();

  const name = nonBlank("name", nameInput);
  const area = nonBlank("area", areaInput);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO restaurant_tables (id, name, seats, area, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, seats = excluded.seats, area = excluded.area,
       active = excluded.active, updated_at = excluded.updated_at`,
  )
    .bind(id, name, seats, area, active === false ? 0 : 1, now, now)
    .run();

  const row = await env.DB.prepare(`SELECT ${TABLE_COLUMNS} FROM restaurant_tables WHERE id = ?`).bind(id).first<TableRow>();
  if (!row) throw conflict("Meja tidak ditemukan setelah disimpan.");
  return serializeTable(row);
}

async function removeTable(env: Env, _staff: SessionStaff, id: string): Promise<void> {
  // A table with unpaid or still-cooking orders must stay so the cashier can settle it.
  const result = await env.DB.prepare(
    `DELETE FROM restaurant_tables WHERE id = ? AND NOT EXISTS (
       SELECT 1 FROM orders WHERE table_id = ? AND (payment_status = 'unpaid' OR kitchen_status NOT IN ('served', 'draft')))`,
  )
    .bind(id, id)
    .run();
  if (changes(result) === 0) {
    const exists = await env.DB.prepare("SELECT 1 AS found FROM restaurant_tables WHERE id = ?").bind(id).first();
    if (exists) throw conflict("Meja masih memiliki pesanan aktif atau belum dibayar.");
  }
}

// ---- categories ----------------------------------------------------------

async function listCategories(env: Env): Promise<unknown[]> {
  const { results } = await env.DB.prepare(CATEGORY_LIST_SQL).all<CategoryRow>();
  return results.map(serializeCategory);
}

async function upsertCategory(env: Env, _staff: SessionStaff, id: string, body: Record<string, unknown>): Promise<unknown> {
  assertBodyId(body, id);
  const r = new Reader(body);
  const nameInput = r.string("name", { max: 60, min: 1 });
  const kind = r.oneOf("kind", KINDS);
  const colorInput = r.string("color", { max: 40, optional: true });
  const sortOrder = r.integer("sortOrder", { min: 0, max: 1_000_000, optional: true });
  const isDefault = r.boolean("isDefault", { optional: true });
  const createdAt = r.timestamp("createdAt", { optional: true });
  r.done();

  const name = nonBlank("name", nameInput);
  const color = colorInput?.trim() ? colorInput.trim() : null;
  const existing = await env.DB.prepare(`SELECT ${CATEGORY_COLUMNS} FROM categories WHERE id = ?`).bind(id).first<CategoryRow>();

  const duplicate = await env.DB.prepare("SELECT 1 AS found FROM categories WHERE lower(name) = lower(?) AND id <> ?")
    .bind(name, id)
    .first();
  if (duplicate) throw invalid("name", "Nama kategori sudah digunakan.");

  if (!existing) {
    const result = await env.DB.prepare(
      `INSERT INTO categories (id, name, kind, color, sort_order, is_default, created_at)
       SELECT ?, ?, ?, ?, COALESCE(?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories)), ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM categories WHERE lower(name) = lower(?))`,
    )
      .bind(id, name, kind, color, sortOrder ?? null, isDefault ? 1 : 0, createdAt ?? Date.now(), name)
      .run()
      .catch(async (error: unknown) => {
        // Lost a race on the same id: report it as a conflict rather than a 500.
        const taken = await env.DB.prepare("SELECT 1 AS found FROM categories WHERE id = ?").bind(id).first();
        if (taken) throw conflict("Kategori berubah saat disimpan; muat ulang lalu coba lagi.");
        throw error;
      });
    if (changes(result) === 0) throw invalid("name", "Nama kategori sudah digunakan.");
  } else {
    const statements = [
      env.DB.prepare(
        `UPDATE categories SET name = ?, kind = ?, color = ?, sort_order = ?, is_default = ?
         WHERE id = ? AND NOT EXISTS (SELECT 1 FROM categories WHERE lower(name) = lower(?) AND id <> ?)`,
      ).bind(name, kind, color, sortOrder ?? existing.sort_order, (isDefault ?? existing.is_default === 1) ? 1 : 0, id, name, id),
    ];
    if (name !== existing.name) {
      // Products reference their category by name: renaming cascades atomically in the same batch.
      statements.push(
        env.DB.prepare(
          `UPDATE products SET category = ?, updated_at = ?
           WHERE category = ? AND EXISTS (SELECT 1 FROM categories WHERE id = ? AND name = ?)`,
        ).bind(name, Date.now(), existing.name, id, name),
      );
    }
    const results = await env.DB.batch(statements);
    if (changes(results[0]) === 0) throw conflict("Kategori berubah saat disimpan; muat ulang lalu coba lagi.");
  }

  const row = await env.DB.prepare(`SELECT ${CATEGORY_COLUMNS} FROM categories WHERE id = ?`).bind(id).first<CategoryRow>();
  if (!row) throw conflict("Kategori tidak ditemukan setelah disimpan.");
  return serializeCategory(row);
}

/** DELETE /api/resources/categories/{id}?reassignTo=<category name> moves products before deleting. */
async function removeCategory(env: Env, _staff: SessionStaff, id: string, url: URL): Promise<void> {
  const row = await env.DB.prepare("SELECT id, name FROM categories WHERE id = ?").bind(id).first<{ id: string; name: string }>();
  if (!row) return;

  const usage = await env.DB.prepare("SELECT COUNT(*) AS n FROM products WHERE category = ?").bind(row.name).first<{ n: number }>();
  const inUse = (usage?.n ?? 0) > 0;
  const reassignTo = url.searchParams.get("reassignTo")?.trim() || null;

  const statements: D1PreparedStatement[] = [];
  if (inUse) {
    if (reassignTo === null) {
      throw conflict(`Kategori masih dipakai ${usage?.n} produk; sertakan parameter reassignTo dengan nama kategori tujuan.`);
    }
    if (reassignTo === row.name) throw invalid("reassignTo", "Kategori tujuan harus berbeda.");
    const target = await env.DB.prepare("SELECT 1 AS found FROM categories WHERE name = ? AND id <> ?").bind(reassignTo, id).first();
    if (!target) throw invalid("reassignTo", "Kategori tujuan tidak ditemukan.");
    statements.push(
      env.DB.prepare(
        `UPDATE products SET category = ?, updated_at = ?
         WHERE category = ? AND EXISTS (SELECT 1 FROM categories WHERE name = ? AND id <> ?)`,
      ).bind(reassignTo, Date.now(), row.name, reassignTo, id),
    );
  }
  statements.push(
    env.DB.prepare("DELETE FROM categories WHERE id = ? AND NOT EXISTS (SELECT 1 FROM products WHERE category = ?)").bind(id, row.name),
  );

  const results = await env.DB.batch(statements);
  if (changes(results[results.length - 1]) === 0) {
    throw conflict("Kategori masih dipakai produk; muat ulang lalu coba lagi.");
  }
}

// ---- shifts --------------------------------------------------------------

async function listShifts(env: Env): Promise<unknown[]> {
  const { results } = await env.DB.prepare(SHIFT_LIST_SQL).all<ShiftRow>();
  return results.map(serializeShift);
}

function parseDenominationsInput(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw invalid("denominations", "denominations harus berupa objek.");
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_DENOMINATIONS) throw invalid("denominations", `denominations maksimal ${MAX_DENOMINATIONS} pecahan.`);
  const clean: Record<string, number> = {};
  for (const [key, count] of entries) {
    if (!/^\d{1,9}$/.test(key)) throw invalid("denominations", "Kunci pecahan harus berupa angka.");
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || count > 1_000_000) {
      throw invalid("denominations", "Jumlah lembar harus bilangan bulat 0-1000000.");
    }
    clean[key] = count;
  }
  return JSON.stringify(clean);
}

async function upsertShift(env: Env, staff: SessionStaff, id: string, body: Record<string, unknown>): Promise<unknown> {
  assertBodyId(body, id);
  const r = new Reader(body);
  const openedAt = r.timestamp("openedAt");
  const closedAt = r.timestamp("closedAt", { optional: true });
  const cashierNameInput = r.string("cashierName", { max: 120, min: 1 });
  const startingCash = r.integer("startingCash", { min: 0, max: MAX_MONEY, optional: true });
  const actualCash = r.integer("actualCash", { min: 0, max: MAX_MONEY, optional: true });
  const expectedCash = r.integer("expectedCash", { min: -MAX_MONEY, max: MAX_MONEY, optional: true });
  const cashDifference = r.integer("cashDifference", { min: -MAX_MONEY, max: MAX_MONEY, optional: true });
  const cashSalesTotal = r.integer("cashSalesTotal", { min: 0, max: MAX_MONEY, optional: true });
  const cashInTotal = r.integer("cashInTotal", { min: 0, max: MAX_MONEY, optional: true });
  const cashOutTotal = r.integer("cashOutTotal", { min: 0, max: MAX_MONEY, optional: true });
  const status = r.oneOf("status", SHIFT_STATUSES);
  const notes = r.string("notes", { max: 1000, optional: true });
  r.done();

  const cashierName = nonBlank("cashierName", cashierNameInput);
  const denominations = parseDenominationsInput(body.denominations);
  if (status === "CLOSED" && closedAt === undefined) throw invalid("closedAt", "closedAt wajib diisi untuk shift yang ditutup.");
  if (status === "OPEN" && closedAt !== undefined) throw invalid("closedAt", "Shift yang masih buka tidak boleh memiliki closedAt.");
  if (closedAt !== undefined && closedAt < openedAt) throw invalid("closedAt", "closedAt tidak boleh sebelum openedAt.");

  const isAdmin = staff.role === "admin" ? 1 : 0;
  const existing = await env.DB.prepare("SELECT status FROM shifts WHERE id = ?").bind(id).first<{ status: string }>();
  if (existing?.status === "CLOSED" && !isAdmin) throw new HttpError(403, "Shift yang sudah ditutup hanya dapat diubah oleh admin.");
  if (status === "OPEN") {
    const other = await env.DB.prepare("SELECT 1 AS found FROM shifts WHERE status = 'OPEN' AND id <> ?").bind(id).first();
    if (other) throw conflict("Masih ada shift lain yang terbuka; tutup shift tersebut terlebih dahulu.");
  }

  const now = Date.now();
  // Both guards are repeated inside the statement so concurrent writes cannot bypass them.
  const result = await env.DB.prepare(
    `INSERT INTO shifts (id, opened_at, closed_at, cashier_name, starting_cash, actual_cash, expected_cash,
       cash_difference, cash_sales_total, cash_in_total, cash_out_total, denominations, status, notes,
       created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE (? = 'CLOSED' OR NOT EXISTS (SELECT 1 FROM shifts WHERE status = 'OPEN' AND id <> ?))
     ON CONFLICT(id) DO UPDATE SET opened_at = excluded.opened_at, closed_at = excluded.closed_at,
       cashier_name = excluded.cashier_name, starting_cash = excluded.starting_cash,
       actual_cash = excluded.actual_cash, expected_cash = excluded.expected_cash,
       cash_difference = excluded.cash_difference, cash_sales_total = excluded.cash_sales_total,
       cash_in_total = excluded.cash_in_total, cash_out_total = excluded.cash_out_total,
       denominations = excluded.denominations, status = excluded.status, notes = excluded.notes,
       updated_at = excluded.updated_at
     WHERE (? = 1 OR shifts.status = 'OPEN')`,
  )
    .bind(
      id,
      openedAt,
      closedAt ?? null,
      cashierName,
      startingCash ?? 0,
      actualCash ?? null,
      expectedCash ?? null,
      cashDifference ?? null,
      cashSalesTotal ?? null,
      cashInTotal ?? null,
      cashOutTotal ?? null,
      denominations,
      status,
      notes ?? null,
      now,
      now,
      status,
      id,
      isAdmin,
    )
    .run();
  if (changes(result) === 0) throw conflict("Shift berubah saat disimpan; muat ulang lalu coba lagi.");

  const row = await env.DB.prepare(`SELECT ${SHIFT_COLUMNS} FROM shifts WHERE id = ?`).bind(id).first<ShiftRow>();
  if (!row) throw conflict("Shift tidak ditemukan setelah disimpan.");
  return serializeShift(row);
}

async function removeShift(env: Env, staff: SessionStaff, id: string): Promise<void> {
  const isAdmin = staff.role === "admin" ? 1 : 0;
  if (!isAdmin) {
    const row = await env.DB.prepare("SELECT status FROM shifts WHERE id = ?").bind(id).first<{ status: string }>();
    if (row?.status === "CLOSED") throw new HttpError(403, "Shift yang sudah ditutup hanya dapat dihapus oleh admin.");
  }
  await env.DB.prepare("DELETE FROM shifts WHERE id = ? AND (? = 1 OR status = 'OPEN')").bind(id, isAdmin).run();
}

// ---- cash movements ------------------------------------------------------

async function listMovements(env: Env): Promise<unknown[]> {
  const { results } = await env.DB.prepare(MOVEMENT_LIST_SQL).all<CashMovementRow>();
  return results.map(serializeCashMovement);
}

async function upsertMovement(env: Env, _staff: SessionStaff, id: string, body: Record<string, unknown>): Promise<unknown> {
  assertBodyId(body, id);
  const r = new Reader(body);
  const shiftIdInput = r.string("shiftId", { max: 100, optional: true });
  const type = r.oneOf("type", MOVEMENT_TYPES);
  const category = r.oneOf("category", MOVEMENT_CATEGORIES);
  const amount = r.integer("amount", { min: 0, max: MAX_MONEY });
  const description = r.string("description", { max: 500, optional: true });
  const cashierNameInput = r.string("cashierName", { max: 120, min: 1 });
  const createdAt = r.timestamp("createdAt", { optional: true });
  r.done();

  const shiftId = shiftIdInput === undefined || shiftIdInput === "" ? null : validId("shiftId", shiftIdInput);
  const cashierName = nonBlank("cashierName", cashierNameInput);
  await env.DB.prepare(
    `INSERT INTO cash_movements (id, shift_id, type, category, amount, description, cashier_name, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET shift_id = excluded.shift_id, type = excluded.type,
       category = excluded.category, amount = excluded.amount, description = excluded.description,
       cashier_name = excluded.cashier_name, occurred_at = excluded.occurred_at`,
  )
    .bind(id, shiftId, type, category, amount, description ?? "", cashierName, createdAt ?? Date.now())
    .run();

  const row = await env.DB.prepare(`SELECT ${MOVEMENT_COLUMNS} FROM cash_movements WHERE id = ?`).bind(id).first<CashMovementRow>();
  if (!row) throw conflict("Mutasi kas tidak ditemukan setelah disimpan.");
  return serializeCashMovement(row);
}

async function removeMovement(env: Env, _staff: SessionStaff, id: string): Promise<void> {
  await env.DB.prepare("DELETE FROM cash_movements WHERE id = ?").bind(id).run();
}

// ---- resource registry ---------------------------------------------------

type Resource = {
  readRoles: readonly StaffRole[];
  writeRoles: readonly StaffRole[];
  list(env: Env): Promise<unknown[]>;
  upsert(env: Env, staff: SessionStaff, id: string, body: Record<string, unknown>): Promise<unknown>;
  remove(env: Env, staff: SessionStaff, id: string, url: URL): Promise<void>;
};

const RESOURCES: Record<string, Resource> = {
  products: { readRoles: READ_ROLES, writeRoles: CATALOG_WRITE_ROLES, list: listProducts, upsert: upsertProduct, remove: removeProduct },
  tables: { readRoles: READ_ROLES, writeRoles: CATALOG_WRITE_ROLES, list: listTables, upsert: upsertTable, remove: removeTable },
  categories: { readRoles: READ_ROLES, writeRoles: CATALOG_WRITE_ROLES, list: listCategories, upsert: upsertCategory, remove: removeCategory },
  shifts: { readRoles: FINANCE_ROLES, writeRoles: FINANCE_ROLES, list: listShifts, upsert: upsertShift, remove: removeShift },
  cashMovements: { readRoles: FINANCE_ROLES, writeRoles: FINANCE_ROLES, list: listMovements, upsert: upsertMovement, remove: removeMovement },
};

const RESOURCE_PATH = /^\/api\/resources\/([A-Za-z]+)(?:\/([^/]+))?$/;

function decodeId(segment: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    throw new HttpError(400, "Id pada URL tidak valid.");
  }
  if (!ID_PATTERN.test(decoded)) throw new HttpError(400, "Id pada URL tidak valid.");
  return decoded;
}

async function handleResource(request: Request, env: Env, url: URL, resource: Resource, rawId: string | undefined): Promise<Response> {
  const method = request.method;

  if (rawId === undefined) {
    if (method !== "GET") throw methodNotAllowed("GET");
    const staff = await requireSession(env, request, url);
    requireRole(staff, ...resource.readRoles);
    return json({ data: await resource.list(env) });
  }

  if (method !== "PUT" && method !== "DELETE") throw methodNotAllowed("PUT", "DELETE");
  assertSameOrigin(request, url);
  const staff = await requireSession(env, request, url);
  requireRole(staff, ...resource.writeRoles);
  const id = decodeId(rawId);

  if (method === "DELETE") {
    await resource.remove(env, staff, id, url);
    return json({ data: true });
  }
  const body = await readJsonObject(request);
  return json({ data: await resource.upsert(env, staff, id, body) });
}

// ---- public (anonymous) endpoints -----------------------------------------

async function publicMenu(env: Env): Promise<Response> {
  const [products, tables, pricing] = await env.DB.batch<ProductRow | TableRow | PricingRow>([
    env.DB.prepare(PRODUCT_LIST_SQL),
    env.DB.prepare(`SELECT ${TABLE_COLUMNS} FROM restaurant_tables WHERE active = 1 ORDER BY name`),
    pricingStatement(env),
  ]);
  return json({
    data: {
      products: (products.results as ProductRow[]).map(serializeProduct),
      tables: (tables.results as TableRow[]).map(serializeTable),
      pricing: parsePricing(pricing.results as PricingRow[]),
    },
  });
}

function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, " ").trim();
}

type PublicLine = { barcode: string; qty: number; note: string | null };

/**
 * Anonymous self-order. The client only chooses a table, items, quantities and notes plus a random
 * `clientRef` key (idempotency + the customer's secret for status lookups). The server assigns the
 * order number, prices every line from the database, decrements stock and stores it unpaid / pay-later.
 */
async function createPublicOrder(env: Env, request: Request): Promise<Response> {
  const body = await readJsonObject(request);
  const r = new Reader(body);
  const tableId = r.string("tableId", { max: 100, min: 1 });
  const customerNameInput = r.string("customerName", { max: 120, optional: true });
  const guests = r.integer("guests", { min: 1, max: 100, optional: true });
  const paymentChoice = r.oneOf("paymentChoice", ["paid-now", "pay-later"] as const, { optional: true });
  const expectedTotal = r.integer("expectedTotal", { min: 0, max: 1_000_000_000 });
  const clientRef = r.string("clientRef", { max: 100, min: 1 });

  const lines: PublicLine[] = [];
  r.array("items", { min: 1, max: PUBLIC_MAX_LINES }).forEach((entry, i) => {
    // `itemId` is the product id exposed by the menu API, i.e. the barcode.
    const normalized = { ...entry, barcode: entry.barcode ?? entry.itemId };
    const lr = r.child(normalized, `items.${i}`);
    const barcode = lr.string("barcode", { max: 100, min: 1 });
    const qty = lr.integer("qty", { min: 1, max: PUBLIC_MAX_QTY });
    const note = lr.string("note", { max: 200, optional: true });
    lines.push({ barcode, qty, note: note !== undefined && cleanText(note) !== "" ? cleanText(note) : null });
  });
  r.done();

  if (paymentChoice === "paid-now") {
    throw invalid("paymentChoice", "Bayar langsung dilakukan lewat QRIS setelah pesanan dibuat; kirim pesanan sebagai pay-later.");
  }
  const clientRefHash = await hashClientRef("clientRef", clientRef);
  const customerName = (customerNameInput !== undefined ? cleanText(customerNameInput) : "") || "Pelanggan Meja";

  // Retries of an already-stored order are answered before rate limiting (they create nothing).
  const since = Date.now() - 60_000;
  const [replay, tableRecent, globalRecent] = await env.DB.batch<{ n: number }>([
    env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE client_ref = ?").bind(clientRefHash),
    env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE source = 'self-order' AND table_id = ? AND created_at > ?").bind(tableId, since),
    env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE source = 'self-order' AND created_at > ?").bind(since),
  ]);
  if (
    (replay.results[0]?.n ?? 0) === 0 &&
    ((tableRecent.results[0]?.n ?? 0) >= PUBLIC_TABLE_LIMIT_PER_MINUTE ||
      (globalRecent.results[0]?.n ?? 0) >= PUBLIC_GLOBAL_LIMIT_PER_MINUTE)
  ) {
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

const PUBLIC_ORDER_PATH = /^\/api\/public\/orders\/(\d{1,15})$/;

// ---- entry point ---------------------------------------------------------

export async function handleResources(request: Request, env: Env, url: URL): Promise<Response | null> {
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  const match = RESOURCE_PATH.exec(path);
  const resource = match && Object.hasOwn(RESOURCES, match[1]) ? RESOURCES[match[1]] : undefined;
  const isMenu = path === "/api/public/menu";
  const isPublicOrders = path === "/api/public/orders";
  const publicOrderMatch = PUBLIC_ORDER_PATH.exec(path);
  if (!resource && !isMenu && !isPublicOrders && !publicOrderMatch) return null;

  try {
    if (resource) return await handleResource(request, env, url, resource, match![2]);
    if (isMenu) {
      if (request.method !== "GET") throw methodNotAllowed("GET");
      return await publicMenu(env);
    }
    if (publicOrderMatch) {
      // GET /api/public/orders/{no}?key=<clientRef>: live status and e-receipt for the customer.
      if (request.method !== "GET") throw methodNotAllowed("GET");
      const key = url.searchParams.get("key") ?? "";
      return json({ data: await loadPublicOrder(env, Number(publicOrderMatch[1]), key) });
    }
    if (request.method !== "POST") throw methodNotAllowed("POST");
    assertSameOrigin(request, url);
    return await createPublicOrder(env, request);
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error);
    throw error;
  }
}
