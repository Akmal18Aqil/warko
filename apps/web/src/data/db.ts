import Dexie, { type EntityTable } from "dexie";
import type { MenuItem } from "./menu";
import type { CashMovementRow, CategoryRow, OrderRow, ShiftRecord, TableRow } from "../types/domain";

/** Browser-only database for the local (demo) data source. The remote data source never opens it. */
export const db = new Dexie("kasa-kasir") as Dexie & {
  products: EntityTable<MenuItem, "id">;
  orders: EntityTable<OrderRow, "no">;
  tables: EntityTable<TableRow, "id">;
  shifts: EntityTable<ShiftRecord, "id">;
  cash_movements: EntityTable<CashMovementRow, "id">;
  categories: EntityTable<CategoryRow, "id">;
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
