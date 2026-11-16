import { db, restaurantTables } from "./db";
import type { MenuItem } from "./menu";
import type { CashMovementRow, CategoryRow, OrderRow, ShiftRecord, TableRow } from "../types/domain";

/**
 * Backup and import operate on the browser database only. They are unavailable in remote
 * mode, where the server is the system of record (the Settings page hides them there).
 */

export type BackupPayload = {
  app: "WAKRO Digital";
  version: 4;
  exportedAt: string;
  products: MenuItem[];
  orders: OrderRow[];
  tables: TableRow[];
  categories: CategoryRow[];
  cashMovements: CashMovementRow[];
  shifts: ShiftRecord[];
};

export async function readBackup(): Promise<BackupPayload> {
  const [products, orders, tables, shifts, categories, cashMovements] = await Promise.all([
    db.products.toArray(),
    db.orders.toArray(),
    restaurantTables.toArray(),
    db.shifts.toArray(),
    db.categories.toArray(),
    db.cash_movements.toArray(),
  ]);
  return {
    app: "WAKRO Digital",
    version: 4,
    exportedAt: new Date().toISOString(),
    products,
    orders,
    tables,
    categories,
    cashMovements,
    shifts,
  };
}

export type ImportCounts = {
  products: number;
  orders: number;
  tables: number;
  categories: number;
  cashMovements: number;
  shifts: number;
};

export type ImportRows = {
  products: MenuItem[];
  orders: OrderRow[];
  tables: TableRow[];
  categories: CategoryRow[];
  cashMovements: CashMovementRow[];
  shifts: ShiftRecord[];
};

/** Categories that imported products refer to but that do not exist yet, so no product points at a missing category. */
function missingCategories(products: readonly MenuItem[], known: readonly CategoryRow[]): CategoryRow[] {
  const names = new Set(known.map((c) => c.name.trim().toLowerCase()));
  let sortOrder = known.reduce((max, c) => Math.max(max, c.sortOrder), 0);
  const created: CategoryRow[] = [];
  for (const product of products) {
    const key = product.category.trim().toLowerCase();
    if (key === "" || names.has(key)) continue;
    names.add(key);
    sortOrder += 1;
    created.push({ id: `cat-import-${sortOrder}-${Date.now()}`, name: product.category.trim(), kind: product.kind, color: "accent", sortOrder, createdAt: Date.now() });
  }
  return created;
}

export async function writeImport(rows: ImportRows): Promise<ImportCounts> {
  await db.transaction("rw", [db.products, db.orders, restaurantTables, db.categories, db.cash_movements, db.shifts], async () => {
    const categories = [...rows.categories, ...missingCategories(rows.products, [...(await db.categories.toArray()), ...rows.categories])];
    if (rows.products.length > 0) await db.products.bulkPut(rows.products);
    if (rows.orders.length > 0) await db.orders.bulkPut(rows.orders);
    if (rows.tables.length > 0) await restaurantTables.bulkPut(rows.tables);
    if (categories.length > 0) await db.categories.bulkPut(categories);
    if (rows.cashMovements.length > 0) await db.cash_movements.bulkPut(rows.cashMovements);
    if (rows.shifts.length > 0) await db.shifts.bulkPut(rows.shifts);
  });
  return {
    products: rows.products.length,
    orders: rows.orders.length,
    tables: rows.tables.length,
    categories: rows.categories.length,
    cashMovements: rows.cashMovements.length,
    shifts: rows.shifts.length,
  };
}
