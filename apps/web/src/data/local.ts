import { DEFAULT_PRICING, KITCHEN_STATUSES, MAX_RATE, type PricingSettings } from "@wakro/shared";
import { legacyStatusFor } from "../lib/orderStatus";
import { expectedDrawerCash } from "../lib/cash";
import { STORAGE_KEYS } from "../lib/storageKeys";
import type { CashMovementRow, OrderRow, ShiftRecord, Snapshot } from "../types/domain";
import { db, restaurantTables } from "./db";
import { MENU_SEED, type MenuItem } from "./menu";
import { DEFAULT_CATEGORIES, DEFAULT_TABLES, demoMovements, demoOrders } from "./seed";
import type { DataSource } from "./source";

function stockShortageMessage(shortages: { name: string; stock: number }[]): string {
  return `Stok tidak mencukupi: ${shortages.map((s) => (s.stock === 0 ? `${s.name} habis` : `${s.name} sisa ${s.stock}`)).join(", ")}.`;
}

function rate(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_RATE ? value : fallback;
}

/** Pricing is one JSON object under one key; anything missing or malformed falls back to the defaults. */
function readStoredPricing(): PricingSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.pricing);
    if (!raw) return { ...DEFAULT_PRICING };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_PRICING };
    const value = parsed as Record<string, unknown>;
    return {
      taxEnabled: typeof value.taxEnabled === "boolean" ? value.taxEnabled : DEFAULT_PRICING.taxEnabled,
      taxRate: rate(value.taxRate, DEFAULT_PRICING.taxRate),
      serviceChargeEnabled: typeof value.serviceChargeEnabled === "boolean" ? value.serviceChargeEnabled : DEFAULT_PRICING.serviceChargeEnabled,
      serviceChargeRate: rate(value.serviceChargeRate, DEFAULT_PRICING.serviceChargeRate),
    };
  } catch {
    return { ...DEFAULT_PRICING };
  }
}

async function ensureSeeded(): Promise<void> {
  await db.open();
  const now = Date.now();
  if ((await db.products.count()) === 0) await db.products.bulkPut(MENU_SEED);
  if ((await db.orders.count()) === 0) await db.orders.bulkAdd(demoOrders(now));
  if ((await restaurantTables.count()) === 0) await restaurantTables.bulkPut(DEFAULT_TABLES);
  if ((await db.cash_movements.count()) === 0) await db.cash_movements.bulkPut(demoMovements(now));
  if ((await db.categories.count()) === 0) await db.categories.bulkPut(DEFAULT_CATEGORIES);
}

export const localSource: DataSource = {
  kind: "local",

  init: ensureSeeded,

  async loadSnapshot(): Promise<Snapshot> {
    const [products, orders, tables, categories, activeShift, cashMovements, pricing] = await Promise.all([
      this.loadProducts(),
      this.loadOrders(),
      this.loadTables(),
      this.loadCategories(),
      this.loadActiveShift(),
      this.loadCashMovements(),
      this.loadPricing(),
    ]);
    return { products, orders, tables, categories, activeShift: activeShift ?? null, cashMovements, pricing };
  },

  async loadPricing() {
    return readStoredPricing();
  },

  async savePricing(pricing) {
    localStorage.setItem(STORAGE_KEYS.pricing, JSON.stringify(pricing));
    return pricing;
  },

  async loadProducts() {
    const rows = await db.products.toArray();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },

  async saveProduct(item) {
    await db.products.put(item);
  },

  async deleteProduct(id) {
    await db.products.delete(id);
  },

  adjustStock(item, mode, qty) {
    return db.transaction("rw", db.products, async () => {
      const current = await db.products.get(item.id);
      if (!current) throw new Error("Produk tidak ditemukan.");
      let stock: number | null;
      if (mode === "set") {
        stock = qty;
      } else {
        if (current.stock === undefined || current.stock === null) {
          throw new Error("Stok produk ini belum dilacak; atur jumlah stok terlebih dahulu.");
        }
        stock = current.stock + (qty ?? 0);
      }
      if (stock !== null && stock < 0) throw new Error("Stok tidak boleh kurang dari 0.");
      const updated: MenuItem = { ...current, stock };
      await db.products.put(updated);
      return updated;
    });
  },

  findProductByBarcode(code) {
    return db.products.where("barcode").equals(code).first();
  },

  async loadTables() {
    const rows = await restaurantTables.toArray();
    return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  },

  async saveTable(table) {
    await restaurantTables.put(table);
  },

  async deleteTable(id) {
    await restaurantTables.delete(id);
  },

  async loadCategories() {
    const rows = await db.categories.toArray();
    return rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },

  async saveCategory(category) {
    await db.categories.put(category);
  },

  updateCategory(id, updates, oldName) {
    return db.transaction("rw", db.categories, db.products, async () => {
      await db.categories.update(id, updates);
      if (updates.name && oldName && updates.name !== oldName) {
        await db.products.where("category").equals(oldName).modify({ category: updates.name });
      }
    });
  },

  deleteCategory(id, categoryName, reassignToCategoryName) {
    return db.transaction("rw", db.categories, db.products, async () => {
      await db.categories.delete(id);
      if (reassignToCategoryName) {
        await db.products.where("category").equals(categoryName).modify({ category: reassignToCategoryName });
      }
    });
  },

  async loadOrders() {
    const rows = await db.orders.toArray();
    return rows.sort((a, b) => b.no - a.no);
  },

  async loadOrdersInRange(from, to) {
    const [created, paid] = await Promise.all([
      db.orders.where("createdAt").between(from, to, true, false).toArray(),
      db.orders.where("paidAt").between(from, to, true, false).toArray(),
    ]);
    const byNo = new Map<number, OrderRow>();
    for (const order of [...created, ...paid]) byNo.set(order.no, order);
    return [...byNo.values()].sort((a, b) => b.no - a.no);
  },

  saveOrder(row, options) {
    return db.transaction("rw", db.orders, db.products, async () => {
      const existing = await db.orders.where("clientRef").equals(options.clientRef).first();
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
        no: (last?.no ?? 0) + 1,
        status: legacyStatusFor(row.kitchenStatus ?? "queued"),
        cashReceived: row.paymentStatus === "paid" && row.method === "tunai" ? options.cashReceived : undefined,
        paidAt: row.paymentStatus === "paid" ? now : undefined,
        createdAt: now,
        clientRef: options.clientRef,
      };
      await db.orders.add(saved);
      return saved;
    });
  },

  settleOrder(no, method, paidBy, cashReceived) {
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
  },

  updateKitchenStatus(no, kitchenStatus) {
    return db.transaction("rw", db.orders, async () => {
      const order = await db.orders.get(no);
      if (!order) throw new Error("Pesanan tidak ditemukan.");
      const current = order.kitchenStatus ?? "queued";
      if (KITCHEN_STATUSES.indexOf(kitchenStatus) < KITCHEN_STATUSES.indexOf(current)) {
        throw new Error("Status dapur hanya bisa maju, tidak bisa mundur.");
      }
      const updated: OrderRow = { ...order, kitchenStatus, status: legacyStatusFor(kitchenStatus) };
      await db.orders.put(updated);
      return updated;
    });
  },

  loadActiveShift() {
    return db.shifts.where("status").equals("OPEN").first();
  },

  loadShiftHistory() {
    return db.shifts.orderBy("openedAt").reverse().toArray();
  },

  saveShift(shift) {
    return db.transaction("rw", db.shifts, db.orders, db.cash_movements, async () => {
      const existing = await db.shifts.get(shift.id);
      const base: ShiftRecord = {
        id: shift.id,
        openedAt: existing?.openedAt ?? shift.openedAt,
        cashierName: existing?.cashierName ?? shift.cashierName,
        startingCash: shift.startingCash,
        status: shift.status,
        notes: shift.notes,
      };
      if (shift.status !== "CLOSED") {
        await db.shifts.put(base);
        return base;
      }
      if (shift.closedAt === undefined) throw new Error("Waktu tutup shift wajib diisi.");
      if (shift.actualCash === undefined) throw new Error("Uang fisik di laci wajib diisi.");
      const [orders, movements] = await Promise.all([
        db.orders.where("paidAt").between(base.openedAt, shift.closedAt, true, true).toArray(),
        db.cash_movements.where("shiftId").equals(base.id).toArray(),
      ]);
      const breakdown = expectedDrawerCash({ ...base, closedAt: shift.closedAt }, orders, movements);
      const closed: ShiftRecord = {
        ...base,
        closedAt: shift.closedAt,
        actualCash: shift.actualCash,
        denominations: shift.denominations,
        cashSalesTotal: breakdown.cashSales,
        cashInTotal: breakdown.cashIn,
        cashOutTotal: breakdown.cashOut,
        expectedCash: breakdown.expected,
        cashDifference: shift.actualCash - breakdown.expected,
      };
      await db.shifts.put(closed);
      return closed;
    });
  },

  async loadCashMovements(shiftId) {
    const list: CashMovementRow[] = shiftId
      ? await db.cash_movements.where("shiftId").equals(shiftId).toArray()
      : await db.cash_movements.toArray();
    return list.sort((a, b) => b.createdAt - a.createdAt);
  },

  async saveCashMovement(item) {
    await db.cash_movements.put(item);
    return item;
  },

  async deleteCashMovement(id) {
    await db.cash_movements.delete(id);
  },
};
