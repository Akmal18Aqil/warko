import Dexie, { type EntityTable } from "dexie";
import { writeDemoData } from "./demoData";
import type { MenuItem } from "./menu";
import type { MetaRow } from "./meta";
import type { CashMovementRow, CategoryRow, OrderRow, ShiftRecord, TableRow } from "../types/domain";

/** Browser-only database for the local (demo) data source. The remote data source never opens it. */
export const db = new Dexie("kasa-kasir") as Dexie & {
  products: EntityTable<MenuItem, "id">;
  orders: EntityTable<OrderRow, "no">;
  shifts: EntityTable<ShiftRecord, "id">;
  cash_movements: EntityTable<CashMovementRow, "id">;
  categories: EntityTable<CategoryRow, "id">;
  meta: EntityTable<MetaRow, "key">;
};

db.version(1).stores({
  products: "id, barcode, name, category",
  orders: "no, status, paidAt, createdAt",
});

db.version(2).stores({
  products: "id, barcode, name, category",
  orders: "no, status, paidAt, createdAt",
  tables: "id, name, area",
});

db.version(3).stores({
  products: "id, barcode, name, category",
  orders: "no, status, paidAt, createdAt",
  tables: "id, name, area",
  shifts: "id, openedAt, status",
});

db.version(4).stores({
  products: "id, barcode, name, category",
  orders: "no, status, paidAt, createdAt",
  tables: "id, name, area",
  shifts: "id, openedAt, status",
  cash_movements: "id, shiftId, type, category, createdAt",
});

db.version(5).stores({
  products: "id, barcode, name, category",
  orders: "no, status, paidAt, createdAt",
  tables: "id, name, area",
  shifts: "id, openedAt, status",
  cash_movements: "id, shiftId, type, category, createdAt",
  categories: "id, name, kind, sortOrder, createdAt",
});

/** `&clientRef` makes the idempotency lookup in `saveOrder` an index hit instead of a table scan. */
db.version(6).stores({
  products: "id, barcode, name, category",
  orders: "no, status, paidAt, createdAt, &clientRef",
  tables: "id, name, area",
  shifts: "id, openedAt, status",
  cash_movements: "id, shiftId, type, category, createdAt",
  categories: "id, name, kind, sortOrder, createdAt",
});

/**
 * v7 replaces the thin, ever-ageing seed: stored demo data is wiped and reseeded with the dated demo
 * history (see `demoData.ts`), `orders.cashShiftId` is indexed for shift reconciliation, and `meta` records
 * the day the data is aligned to so it can be moved forward when the app is opened on a later day.
 */
db.version(7)
  .stores({
    products: "id, barcode, name, category",
    orders: "no, status, paidAt, createdAt, &clientRef, cashShiftId",
    tables: "id, name, area",
    shifts: "id, openedAt, status",
    cash_movements: "id, shiftId, type, category, createdAt",
    categories: "id, name, kind, sortOrder, createdAt",
    meta: "key",
  })
  .upgrade(async (tx) => {
    for (const name of ["products", "orders", "tables", "shifts", "cash_movements", "categories"]) await tx.table(name).clear();
    await writeDemoData(tx, Date.now());
  });

db.on("populate", (tx) => writeDemoData(tx, Date.now()));

export const restaurantTables = db.table<TableRow, string>("tables");
