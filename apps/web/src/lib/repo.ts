import {
  db,
  tablesTable,
  cashMovementsTable,
  categoriesTable,
  type OrderRow,
  type PayMethod,
  type KitchenStatus,
  type ShiftRecord,
  type TableRow,
  type CashMovementRow,
  type CashMovementType,
  type CashMovementCategory,
  type CategoryRow,
} from "./db";
import type { MenuItem } from "../data/menu";
import { legacyStatusFor } from "./orderStatus";
import {
  adjustRemoteStock,
  isRemoteDataSource,
  loadRemoteOrders,
  loadRemoteProducts,
  loadRemoteReportOrders,
  saveRemoteOrder,
  settleRemoteOrder,
  updateRemoteKitchenStatus,
  loadRemoteResource,
  saveRemoteResource,
  deleteRemoteResource,
  type OrderSubmitOptions,
} from "./remote";

export type {
  OrderRow,
  TableRow,
  ShiftRecord,
  CashMovementRow,
  CashMovementType,
  CashMovementCategory,
  CategoryRow,
};
export { tablesTable, cashMovementsTable, categoriesTable };

export async function loadProducts(): Promise<MenuItem[]> {
  if (isRemoteDataSource) return loadRemoteProducts();
  const rows = await db.products.toArray();
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveProduct(item: MenuItem): Promise<void> {
  if (isRemoteDataSource) await saveRemoteResource("products", item.id, item);
  await db.products.put(item);
}

export async function deleteProduct(id: string): Promise<void> {
  if (isRemoteDataSource) await deleteRemoteResource("products", id);
  await db.products.delete(id);
}

export async function loadTables(): Promise<TableRow[]> {
  if (isRemoteDataSource) return loadRemoteResource<TableRow>("tables");
  const rows = await tablesTable.toArray();
  return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export async function saveTable(table: TableRow): Promise<void> {
  if (isRemoteDataSource) await saveRemoteResource("tables", table.id, table);
  await tablesTable.put(table);
}

export async function deleteTable(id: string): Promise<void> {
  if (isRemoteDataSource) await deleteRemoteResource("tables", id);
  await tablesTable.delete(id);
}

export async function loadOrders(): Promise<OrderRow[]> {
  if (isRemoteDataSource) return loadRemoteOrders();
  const rows = await db.orders.toArray();
  return rows.sort((a, b) => b.no - a.no);
}

/** Orders created or paid inside [from, to), for reports and exports. */
export async function loadOrdersInRange(from: number, to: number): Promise<OrderRow[]> {
  if (isRemoteDataSource) return loadRemoteReportOrders(from, to);
  const rows = await db.orders
    .filter((o) => (o.createdAt >= from && o.createdAt < to) || (o.paidAt !== undefined && o.paidAt >= from && o.paidAt < to))
    .toArray();
  return rows.sort((a, b) => b.no - a.no);
}

function stockShortageMessage(shortages: { name: string; stock: number }[]): string {
  return `Stok tidak mencukupi: ${shortages.map((s) => (s.stock === 0 ? `${s.name} habis` : `${s.name} sisa ${s.stock}`)).join(", ")}.`;
}

/**
 * Stores a new order. The number is assigned by the data source; ready stock is checked and
 * decremented atomically with the order. Submitting the same `clientRef` twice returns the first
 * order instead of creating a duplicate.
 */
export async function saveOrder(row: OrderRow, options: OrderSubmitOptions): Promise<OrderRow> {
  if (isRemoteDataSource) return saveRemoteOrder(row, options);

  return db.transaction("rw", db.orders, db.products, async () => {
    const existing = await db.orders.filter((o) => o.clientRef === options.clientRef).first();
    if (existing) return existing;

    const qtyByProduct = new Map<string, number>();
    for (const item of row.items ?? []) qtyByProduct.set(item.itemId, (qtyByProduct.get(item.itemId) ?? 0) + item.qty);
    const products = await db.products.bulkGet([...qtyByProduct.keys()]);
    const shortages: { name: string; stock: number }[] = [];
    for (const product of products) {
      if (!product || product.stock === undefined || product.stock === null) continue;
      if ((qtyByProduct.get(product.id) ?? 0) > product.stock) shortages.push({ name: product.name, stock: product.stock });
    }
    if (shortages.length > 0) throw new Error(stockShortageMessage(shortages));
    for (const product of products) {
      if (!product || product.stock === undefined || product.stock === null) continue;
      await db.products.update(product.id, { stock: product.stock - (qtyByProduct.get(product.id) ?? 0) });
    }

    const last = await db.orders.orderBy(":id").last();
    const now = Date.now();
    const saved: OrderRow = {
      ...row,
      no: (last?.no ?? 1048) + 1,
      status: legacyStatusFor(row.kitchenStatus ?? "queued"),
      cashReceived: row.paymentStatus === "paid" && row.method === "tunai" ? options.cashReceived : undefined,
      paidAt: row.paymentStatus === "paid" ? now : undefined,
      createdAt: now,
      clientRef: options.clientRef,
    };
    await db.orders.add(saved);
    return saved;
  });
}

/**
 * Settles an existing unpaid order (e.g. a self-order paid in cash at the register).
 * Idempotent: an already-paid order is returned unchanged with `alreadyPaid: true`.
 */
export async function settleOrder(
  no: number,
  method: PayMethod,
  paidBy: string,
  cashReceived?: number,
): Promise<{ order: OrderRow; alreadyPaid: boolean }> {
  if (isRemoteDataSource) {
    const result = await settleRemoteOrder(no, method, cashReceived);
    await db.orders.put(result.order);
    return result;
  }
  return db.transaction("rw", db.orders, async () => {
    const order = await db.orders.get(no);
    if (!order) throw new Error("Pesanan tidak ditemukan.");
    if (order.paymentStatus === "paid") return { order, alreadyPaid: true };
    if (order.paymentStatus === "refunded") throw new Error("Pesanan sudah direfund dan tidak dapat dibayar.");
    if (method === "tunai" && (cashReceived ?? -1) < order.total) throw new Error("Uang diterima kurang dari total.");
    const paid: OrderRow = {
      ...order,
      paymentStatus: "paid",
      method,
      paidAt: Date.now(),
      paidBy,
      cashReceived: method === "tunai" ? cashReceived : undefined,
    };
    await db.orders.put(paid);
    return { order: paid, alreadyPaid: false };
  });
}

export async function updateKitchenStatus(no: number, kitchenStatus: KitchenStatus): Promise<OrderRow> {
  if (isRemoteDataSource) return updateRemoteKitchenStatus(no, kitchenStatus);
  const order = await db.orders.get(no);
  if (!order) throw new Error("Pesanan tidak ditemukan.");
  const updated: OrderRow = { ...order, kitchenStatus, status: legacyStatusFor(kitchenStatus) };
  await db.orders.put(updated);
  return updated;
}

/** Sets (`mode: "set"`) or adds (`mode: "add"`) ready stock. `set` with `null` stops tracking. */
export async function adjustStock(item: MenuItem, mode: "set" | "add", qty: number | null): Promise<MenuItem> {
  if (isRemoteDataSource) return adjustRemoteStock(item.barcode, mode, qty);
  return db.transaction("rw", db.products, async () => {
    const current = await db.products.get(item.id);
    if (!current) throw new Error("Produk tidak ditemukan.");
    let stock: number | null;
    if (mode === "set") {
      stock = qty;
    } else {
      if (current.stock === undefined || current.stock === null) throw new Error("Stok produk ini belum dilacak; atur jumlah stok terlebih dahulu.");
      stock = current.stock + (qty ?? 0);
    }
    if (stock !== null && stock < 0) throw new Error("Stok tidak boleh kurang dari 0.");
    const updated: MenuItem = { ...current, stock };
    await db.products.put(updated);
    return updated;
  });
}

export async function loadActiveShift(): Promise<ShiftRecord | undefined> {
  if (isRemoteDataSource) return (await loadRemoteResource<ShiftRecord>("shifts")).find((shift) => shift.status === "OPEN");
  return db.shifts.where("status").equals("OPEN").first();
}

export async function saveShift(shift: ShiftRecord): Promise<void> {
  if (isRemoteDataSource) await saveRemoteResource("shifts", shift.id, shift);
  await db.shifts.put(shift);
}

export async function loadShiftHistory(): Promise<ShiftRecord[]> {
  if (isRemoteDataSource) return loadRemoteResource<ShiftRecord>("shifts");
  const list = await db.shifts.toArray();
  return list.sort((a, b) => b.openedAt - a.openedAt);
}

export async function loadCashMovements(shiftId?: string): Promise<CashMovementRow[]> {
  if (isRemoteDataSource) {
    const rows = await loadRemoteResource<CashMovementRow>("cashMovements");
    return shiftId ? rows.filter((row) => row.shiftId === shiftId) : rows;
  }
  if (shiftId) {
    const list = await cashMovementsTable.where("shiftId").equals(shiftId).toArray();
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }
  const list = await cashMovementsTable.toArray();
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveCashMovement(item: CashMovementRow): Promise<void> {
  if (isRemoteDataSource) await saveRemoteResource("cashMovements", item.id, item);
  await cashMovementsTable.put(item);
}

export async function deleteCashMovement(id: string): Promise<void> {
  if (isRemoteDataSource) await deleteRemoteResource("cashMovements", id);
  await cashMovementsTable.delete(id);
}

export async function loadCategories(): Promise<CategoryRow[]> {
  if (isRemoteDataSource) return loadRemoteResource<CategoryRow>("categories");
  const rows = await categoriesTable.toArray();
  return rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function saveCategory(category: CategoryRow): Promise<void> {
  if (isRemoteDataSource) await saveRemoteResource("categories", category.id, category);
  await categoriesTable.put(category);
}

export async function updateCategory(
  id: string,
  updates: Partial<CategoryRow>,
  oldName?: string
): Promise<void> {
  if (isRemoteDataSource) {
    const category = (await loadRemoteResource<CategoryRow>("categories")).find((row) => row.id === id);
    if (!category) throw new Error("Kategori tidak ditemukan.");
    await saveRemoteResource("categories", id, { ...category, ...updates });
  }
  await categoriesTable.update(id, updates);
  // If category name was renamed, cascade update all products under old category name
  if (updates.name && oldName && updates.name !== oldName) {
    const affectedProducts = await db.products.where("category").equals(oldName).toArray();
    for (const prod of affectedProducts) {
      await db.products.update(prod.id, { category: updates.name as any });
    }
  }
}

export async function deleteCategory(
  id: string,
  categoryName: string,
  reassignToCategoryName?: string
): Promise<void> {
  if (isRemoteDataSource) await deleteRemoteResource("categories", id, reassignToCategoryName);
  await categoriesTable.delete(id);
  if (reassignToCategoryName) {
    const affectedProducts = await db.products.where("category").equals(categoryName).toArray();
    for (const prod of affectedProducts) {
      await db.products.update(prod.id, { category: reassignToCategoryName as any });
    }
  }
}

export async function findProductByBarcode(
  code: string,
): Promise<MenuItem | undefined> {
  if (isRemoteDataSource) return (await loadRemoteProducts()).find((item) => item.barcode === code);
  return db.products.where("barcode").equals(code).first();
}

export async function upsertProducts(items: MenuItem[]): Promise<number> {
  if (isRemoteDataSource) {
    for (const item of items) await saveRemoteResource("products", item.id, item);
  }
  await db.products.bulkPut(items);
  return items.length;
}

export function toOrderRow(input: {
  no: number;
  status: OrderRow["status"];
  total: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  serviceCharge?: number;
  itemCount: number;
  method?: PayMethod;
  orderType: OrderRow["orderType"];
  tableNumber?: number;
  tableName?: string;
  guests?: number;
  paidAt?: number;
}): OrderRow {
  return { ...input, createdAt: Date.now() };
}
