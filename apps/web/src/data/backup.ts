import { db, restaurantTables } from "./db";
import { MENU_SEED, type MenuItem } from "./menu";
import { DEFAULT_CATEGORIES, DEFAULT_TABLES } from "./seed";
import type { CashMovementRow, CategoryRow, OrderRow, ShiftRecord, TableRow } from "../types/domain";

/**
 * Backup, import and demo reset operate on the browser database only. They are unavailable in remote
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
};

export type ImportRows = {
  products: MenuItem[];
  orders: OrderRow[];
  tables: TableRow[];
  categories: CategoryRow[];
  cashMovements: CashMovementRow[];
};

export async function writeImport(rows: ImportRows): Promise<ImportCounts> {
  await db.transaction("rw", [db.products, db.orders, restaurantTables, db.categories, db.cash_movements], async () => {
    if (rows.products.length > 0) await db.products.bulkPut(rows.products);
    if (rows.orders.length > 0) await db.orders.bulkPut(rows.orders);
    if (rows.tables.length > 0) await restaurantTables.bulkPut(rows.tables);
    if (rows.categories.length > 0) await db.categories.bulkPut(rows.categories);
    if (rows.cashMovements.length > 0) await db.cash_movements.bulkPut(rows.cashMovements);
  });
  return {
    products: rows.products.length,
    orders: rows.orders.length,
    tables: rows.tables.length,
    categories: rows.categories.length,
    cashMovements: rows.cashMovements.length,
  };
}

/** Restores the demo menu, tables and categories. Orders, shifts and cash movements are kept. */
export async function resetToDemoSeed(): Promise<{ products: number; tables: number }> {
  await db.transaction("rw", [db.products, restaurantTables, db.categories], async () => {
    await db.products.clear();
    await db.products.bulkPut(MENU_SEED);
    await restaurantTables.clear();
    await restaurantTables.bulkPut(DEFAULT_TABLES);
    await db.categories.clear();
    await db.categories.bulkPut(DEFAULT_CATEGORIES);
  });
  return { products: MENU_SEED.length, tables: DEFAULT_TABLES.length };
}
