import { CATALOG_WRITE_ROLES, IMAGE_PATTERN, MAX_IMAGE_LENGTH, MAX_MONEY, MAX_STOCK, READ_ROLES, STOCK_ROLES } from "@wakro/shared";
import type { Env } from "../env";
import { assertBodyId, changes, decodeId, isCheckViolation, isUniqueViolation, validId } from "../guards";
import { conflict, HttpError, invalid, json, Reader, readJsonObject } from "../http";
import { KINDS } from "../policy";
import { loadPricing, parsePricingInput, savePricing } from "../pricing";
import { get, send, type AuthedContext, type Route } from "../router";
import {
  CATEGORY_COLUMNS, CATEGORY_LIST_SQL, PRODUCT_LIST_SQL, PRODUCT_SELECT, serializeCategory, serializeProduct,
  serializeTable, TABLE_COLUMNS, TABLE_LIST_SQL, type CategoryRow, type ProductRow, type TableRow,
} from "../rows";
import { resourceRoutes } from "./resources";

const STOCK_MODES = ["set", "add"] as const;

// ---- products ------------------------------------------------------------

async function loadProduct(env: Env, barcode: string): Promise<ProductRow | null> {
  return env.DB.prepare(`${PRODUCT_SELECT} WHERE p.barcode = ?`).bind(barcode).first<ProductRow>();
}

async function listProducts({ env }: AuthedContext): Promise<Response> {
  const { results } = await env.DB.prepare(PRODUCT_LIST_SQL).all<ProductRow>();
  return json({ data: results.map(serializeProduct) });
}

/** GET /api/products?barcode=<code>: scanner lookup of one active product (`data: null` when unknown). */
async function findProductByBarcode({ env, url }: AuthedContext): Promise<Response> {
  const barcode = url.searchParams.get("barcode")?.trim();
  if (!barcode) throw invalid("barcode", "barcode wajib diisi.");
  const row = await env.DB.prepare(`${PRODUCT_SELECT} WHERE p.barcode = ? AND p.is_active = 1`).bind(barcode).first<ProductRow>();
  return json({ data: row ? serializeProduct(row) : null });
}

async function upsertProduct({ env }: AuthedContext, id: string, body: Record<string, unknown>): Promise<unknown> {
  const r = new Reader(body);
  const barcodeInput = r.string("barcode", { max: 100, optional: true, nonBlank: true });
  const name = r.string("name", { max: 150, nonBlank: true });
  const description = r.string("description", { max: 1000, optional: true });
  const price = r.integer("price", { min: 0, max: MAX_MONEY });
  const categoryName = r.string("category", { max: 100, nonBlank: true });
  const kind = r.oneOf("kind", KINDS);
  const prepMinutes = r.integer("prepMinutes", { min: 0, max: 1440, optional: true });
  const badgeInput = r.string("badge", { max: 60, optional: true, normalize: (value) => value.trim() });
  const image = r.string("image", {
    max: MAX_IMAGE_LENGTH,
    optional: true,
    pattern: IMAGE_PATTERN,
    patternMessage: "image harus berupa URL http(s), path relatif, atau data URI gambar.",
  });
  r.done();

  const barcode = validId("barcode", barcodeInput ?? id.trim());
  const badge = badgeInput || null;

  // Products are addressed by barcode (the id exposed in bootstrap). A client-side id that is not
  // a barcode yet (new product, or a retried create) resolves to the row owning the body barcode.
  let existing = await env.DB.prepare("SELECT id FROM products WHERE barcode = ?").bind(id).first<{ id: string }>();
  if (!existing && barcode !== id) {
    existing = await env.DB.prepare("SELECT id FROM products WHERE barcode = ?").bind(barcode).first<{ id: string }>();
  }

  const category = await env.DB.prepare("SELECT id FROM categories WHERE name = ? COLLATE NOCASE").bind(categoryName).first<{ id: string }>();
  if (!category) throw invalid("category", "category tidak ditemukan; buat kategori terlebih dahulu.");

  const now = Date.now();
  try {
    // The EXISTS guard keeps a concurrent category delete from leaving a dangling reference.
    const result = existing
      ? await env.DB.prepare(
          `UPDATE products SET barcode = ?, name = ?, description = ?, price = ?, category_id = ?, kind = ?,
             prep_minutes = ?, badge = ?, image = ?, is_active = 1, updated_at = ?
           WHERE id = ? AND EXISTS (SELECT 1 FROM categories WHERE id = ?)`,
        )
          .bind(barcode, name, description ?? "", price, category.id, kind, prepMinutes ?? 5, badge, image ?? "", now, existing.id, category.id)
          .run()
      : await env.DB.prepare(
          `INSERT INTO products (id, barcode, name, description, price, category_id, kind, prep_minutes, badge, image,
             is_active, created_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?
           WHERE EXISTS (SELECT 1 FROM categories WHERE id = ?)`,
        )
          .bind(crypto.randomUUID(), barcode, name, description ?? "", price, category.id, kind, prepMinutes ?? 5, badge, image ?? "", now, now, category.id)
          .run();
    if (changes(result) === 0) throw conflict("Produk atau kategori berubah saat disimpan; muat ulang lalu coba lagi.");
  } catch (error) {
    if (isUniqueViolation(error, "products.barcode")) throw invalid("barcode", "barcode sudah digunakan produk lain.");
    throw error;
  }

  const row = await loadProduct(env, barcode);
  if (!row) throw conflict("Produk tidak ditemukan setelah disimpan.");
  return serializeProduct(row);
}

async function removeProduct({ env }: AuthedContext, id: string): Promise<void> {
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

/** POST /api/products/{barcode}/stock: set or add ready stock; `qty: null` in set mode stops tracking. */
async function adjustStock({ request, env, params, staff }: AuthedContext): Promise<Response> {
  const barcode = decodeId(params.barcode);
  const body = await readJsonObject(request);
  const r = new Reader(body);
  const mode = r.oneOf("mode", STOCK_MODES);
  const qty = r.integer("qty", { min: mode === "add" ? -MAX_STOCK : 0, max: MAX_STOCK, optional: true });
  r.done();
  const untrack = mode === "set" && body.qty === null;
  if (!untrack && qty === undefined) throw invalid("qty", "qty wajib diisi.");

  const product = await env.DB.prepare("SELECT id, stock FROM products WHERE barcode = ? AND is_active = 1")
    .bind(barcode)
    .first<{ id: string; stock: number | null }>();
  if (!product) throw new HttpError(404, "Produk tidak ditemukan.");
  const now = Date.now();

  // The movement row is written first and derives delta/stock_after from the stock the update is about
  // to replace, so overlapping adjustments always log what they actually changed.
  const log = (select: string) =>
    env.DB.prepare(
      `INSERT INTO stock_movements (product_id, delta, stock_after, reason, order_no, staff_name, created_at)
       ${select}`,
    );
  let statements: D1PreparedStatement[];
  if (untrack) {
    statements = [
      log("VALUES (?, 0, NULL, 'adjust', NULL, ?, ?)").bind(product.id, staff.name, now),
      env.DB.prepare("UPDATE products SET stock = NULL, updated_at = ? WHERE id = ?").bind(now, product.id),
    ];
  } else if (mode === "set") {
    statements = [
      log("SELECT id, ?1 - COALESCE(stock, 0), ?1, 'adjust', NULL, ?2, ?3 FROM products WHERE id = ?4").bind(qty, staff.name, now, product.id),
      env.DB.prepare("UPDATE products SET stock = ?, updated_at = ? WHERE id = ?").bind(qty, now, product.id),
    ];
  } else {
    if (product.stock === null) throw conflict("Stok produk ini belum dilacak; atur jumlah stok terlebih dahulu.");
    statements = [
      log(
        "SELECT id, ?1, stock + ?1, CASE WHEN ?1 > 0 THEN 'restock' ELSE 'adjust' END, NULL, ?2, ?3 FROM products WHERE id = ?4 AND stock IS NOT NULL",
      ).bind(qty, staff.name, now, product.id),
      // Relative update so concurrent sales are not overwritten; the CHECK rejects a negative result.
      env.DB.prepare("UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ? AND stock IS NOT NULL").bind(qty, now, product.id),
    ];
  }
  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (isCheckViolation(error)) throw conflict("Stok tidak boleh kurang dari 0.");
    throw error;
  }
  return json({ data: serializeProduct((await loadProduct(env, barcode))!) });
}

// ---- tables --------------------------------------------------------------

async function listTables({ env }: AuthedContext): Promise<Response> {
  const { results } = await env.DB.prepare(TABLE_LIST_SQL).all<TableRow>();
  return json({ data: results.map(serializeTable) });
}

async function upsertTable({ env }: AuthedContext, id: string, body: Record<string, unknown>): Promise<unknown> {
  assertBodyId(body, id);
  const r = new Reader(body);
  const name = r.string("name", { max: 100, nonBlank: true });
  const seats = r.integer("seats", { min: 1, max: 1000 });
  const area = r.string("area", { max: 100, nonBlank: true });
  const active = r.boolean("active", { optional: true });
  r.allow("id");
  r.done();

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

async function removeTable({ env }: AuthedContext, id: string): Promise<void> {
  // A table with unpaid or still-cooking orders must stay so the cashier can settle it.
  const result = await env.DB.prepare(
    `DELETE FROM restaurant_tables WHERE id = ? AND NOT EXISTS (
       SELECT 1 FROM orders WHERE table_id = ? AND (payment_status = 'unpaid' OR kitchen_status IN ('queued', 'preparing', 'ready')))`,
  )
    .bind(id, id)
    .run();
  if (changes(result) === 0) {
    const exists = await env.DB.prepare("SELECT 1 AS found FROM restaurant_tables WHERE id = ?").bind(id).first();
    if (exists) throw conflict("Meja masih memiliki pesanan aktif atau belum dibayar.");
  }
}

// ---- categories ----------------------------------------------------------

function loadCategory(env: Env, id: string): Promise<CategoryRow | null> {
  return env.DB.prepare(`SELECT ${CATEGORY_COLUMNS} FROM categories WHERE id = ?`).bind(id).first<CategoryRow>();
}

async function listCategories({ env }: AuthedContext): Promise<Response> {
  const { results } = await env.DB.prepare(CATEGORY_LIST_SQL).all<CategoryRow>();
  return json({ data: results.map(serializeCategory) });
}

async function findCategory({ env }: AuthedContext, id: string): Promise<unknown | null> {
  const row = await loadCategory(env, id);
  return row ? serializeCategory(row) : null;
}

async function upsertCategory({ env }: AuthedContext, id: string, body: Record<string, unknown>): Promise<unknown> {
  assertBodyId(body, id);
  const r = new Reader(body);
  const name = r.string("name", { max: 60, nonBlank: true });
  const kind = r.oneOf("kind", KINDS);
  const colorInput = r.string("color", { max: 40, optional: true, normalize: (value) => value.trim() });
  const sortOrder = r.integer("sortOrder", { min: 0, max: 1_000_000, optional: true });
  const isDefault = r.boolean("isDefault", { optional: true });
  const createdAt = r.timestamp("createdAt", { optional: true });
  r.allow("id");
  r.done();

  const color = colorInput || null;
  const existing = await loadCategory(env, id);
  try {
    const result = existing
      ? await env.DB.prepare("UPDATE categories SET name = ?, kind = ?, color = ?, sort_order = ?, is_default = ? WHERE id = ?")
          .bind(name, kind, color, sortOrder ?? existing.sort_order, (isDefault ?? existing.is_default === 1) ? 1 : 0, id)
          .run()
      : await env.DB.prepare(
          `INSERT INTO categories (id, name, kind, color, sort_order, is_default, created_at)
           VALUES (?, ?, ?, ?, COALESCE(?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories)), ?, ?)`,
        )
          .bind(id, name, kind, color, sortOrder ?? null, isDefault ? 1 : 0, createdAt ?? Date.now())
          .run();
    if (changes(result) === 0) throw conflict("Kategori berubah saat disimpan; muat ulang lalu coba lagi.");
  } catch (error) {
    if (isUniqueViolation(error, "categories.name")) throw invalid("name", "Nama kategori sudah digunakan.");
    // Lost a race on the same id: report it as a conflict rather than a 500.
    if (isUniqueViolation(error, "categories.id")) throw conflict("Kategori berubah saat disimpan; muat ulang lalu coba lagi.");
    throw error;
  }

  const row = await loadCategory(env, id);
  if (!row) throw conflict("Kategori tidak ditemukan setelah disimpan.");
  return serializeCategory(row);
}

/** DELETE /api/resources/categories/{id}?reassignTo=<category name> moves products before deleting. */
async function removeCategory({ env, url }: AuthedContext, id: string): Promise<void> {
  const row = await env.DB.prepare("SELECT id, name FROM categories WHERE id = ?").bind(id).first<{ id: string; name: string }>();
  if (!row) return;

  const usage = await env.DB.prepare("SELECT COUNT(*) AS n FROM products WHERE category_id = ?").bind(id).first<{ n: number }>();
  const inUse = (usage?.n ?? 0) > 0;
  const reassignTo = url.searchParams.get("reassignTo")?.trim() || null;

  const statements: D1PreparedStatement[] = [];
  if (inUse) {
    if (reassignTo === null) {
      throw conflict(`Kategori masih dipakai ${usage?.n} produk; sertakan parameter reassignTo dengan nama kategori tujuan.`);
    }
    const target = await env.DB.prepare("SELECT id FROM categories WHERE name = ? COLLATE NOCASE").bind(reassignTo).first<{ id: string }>();
    if (!target) throw invalid("reassignTo", "Kategori tujuan tidak ditemukan.");
    if (target.id === id) throw invalid("reassignTo", "Kategori tujuan harus berbeda.");
    statements.push(
      env.DB.prepare(
        `UPDATE products SET category_id = ?, updated_at = ?
         WHERE category_id = ? AND EXISTS (SELECT 1 FROM categories WHERE id = ?)`,
      ).bind(target.id, Date.now(), id, target.id),
    );
  }
  statements.push(env.DB.prepare("DELETE FROM categories WHERE id = ? AND NOT EXISTS (SELECT 1 FROM products WHERE category_id = ?)").bind(id, id));

  const results = await env.DB.batch(statements);
  if (changes(results[results.length - 1]) === 0) {
    throw conflict("Kategori masih dipakai produk; muat ulang lalu coba lagi.");
  }
}

// ---- routes --------------------------------------------------------------

export const catalogRoutes: Route[] = [
  ...resourceRoutes({
    name: "products",
    readRoles: READ_ROLES,
    writeRoles: CATALOG_WRITE_ROLES,
    list: listProducts,
    upsert: upsertProduct,
    remove: removeProduct,
  }),
  ...resourceRoutes({
    name: "tables",
    readRoles: READ_ROLES,
    writeRoles: CATALOG_WRITE_ROLES,
    list: listTables,
    upsert: upsertTable,
    remove: removeTable,
  }),
  ...resourceRoutes({
    name: "categories",
    readRoles: READ_ROLES,
    writeRoles: CATALOG_WRITE_ROLES,
    list: listCategories,
    find: findCategory,
    upsert: upsertCategory,
    remove: removeCategory,
  }),
  get("/api/products", READ_ROLES, findProductByBarcode),
  send("POST", "/api/products/:barcode/stock", STOCK_ROLES, adjustStock),
  get("/api/pricing", READ_ROLES, async ({ env }) => json({ data: await loadPricing(env) })),
  send("PUT", "/api/pricing", CATALOG_WRITE_ROLES, async ({ request, env }) =>
    json({ data: await savePricing(env, parsePricingInput(await readJsonObject(request))) }),
  ),
];
