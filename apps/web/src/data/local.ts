import {
  ACCESS_DENIED_MESSAGE,
  ADMIN_ROLES,
  CASH_MOVEMENT_CATEGORIES,
  CASH_MOVEMENT_TYPES,
  CATALOG_WRITE_ROLES,
  CREATE_ORDER_ROLES,
  CREATE_PAID_ROLES,
  DEFAULT_PRICING,
  DISCOUNT_ROLES,
  EXPECTED_TOTAL_MISMATCH_MESSAGE,
  FINANCE_ROLES,
  IMAGE_PATTERN,
  KITCHEN_STATUSES,
  MAX_IMAGE_LENGTH,
  MAX_MONEY,
  MAX_RATE,
  MAX_STOCK,
  type PricingSettings,
  REPORT_ROLES,
  SETTLE_ROLES,
  STOCK_ROLES,
  type StaffRole,
  UPDATE_STATUS_ROLES,
} from "@wakro/shared";
import { expectedDrawerCash } from "../lib/cash";
import { isKitchenActive, legacyStatusFor, paymentStatusOf } from "../lib/orderStatus";
import { STORAGE_KEYS } from "../lib/storageKeys";
import type { CashMovementRow, OrderRow, ShiftRecord, Snapshot } from "../types/domain";
import { db, restaurantTables } from "./db";
import { priceOrder } from "./localOrder";
import type { MenuItem } from "./menu";
import { redateToToday } from "./redate";
import type { DataSource } from "./source";

/** The operational views only need orders from the last two days, open orders and the open shift's orders. */
const OPERATIONAL_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Reports cover at most a little over a year per request. */
const MAX_REPORT_RANGE_MS = 400 * 24 * 60 * 60 * 1000;

// ---- acting staff -------------------------------------------------------------------------------

/** The signed-in demo staff member. The browser has no server session, so the auth state tells us. */
export type LocalActor = { id: string; name: string; role: StaffRole };

let actor: LocalActor | null = null;

/**
 * Sets who performs the following writes. With an actor, writes are checked against the same role
 * policy as the API and stamped with the actor's name. `null` (nobody signed in yet, tests) skips the checks.
 */
export function setLocalActor(next: LocalActor | null): void {
  actor = next;
}

function requireRole(roles: readonly StaffRole[], message = ACCESS_DENIED_MESSAGE): void {
  if (actor && !roles.includes(actor.role)) throw new Error(message);
}

/** Admins (or no actor at all) may correct a closed shift. */
const canEditClosedShift = (): boolean => actor === null || ADMIN_ROLES.includes(actor.role);

// ---- helpers ------------------------------------------------------------------------------------

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
      serviceChargeEnabled:
        typeof value.serviceChargeEnabled === "boolean" ? value.serviceChargeEnabled : DEFAULT_PRICING.serviceChargeEnabled,
      serviceChargeRate: rate(value.serviceChargeRate, DEFAULT_PRICING.serviceChargeRate),
    };
  } catch {
    return { ...DEFAULT_PRICING };
  }
}

function isValidRate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_RATE;
}

/** Same rule as the API: cash is only accepted while a shift is open, so every cash sale belongs to a shift. */
async function openShiftForCash(): Promise<ShiftRecord> {
  const open = await db.shifts.where("status").equals("OPEN").first();
  if (!open) throw new Error("Buka shift sebelum menerima pembayaran tunai.");
  return open;
}

/** Orders the cashier still has to act on: unpaid, or still in the kitchen. */
const isOpenOrder = (order: OrderRow): boolean => paymentStatusOf(order) === "unpaid" || isKitchenActive(order);

function assertProduct(item: MenuItem): void {
  if (item.name.trim() === "") throw new Error("Nama produk wajib diisi.");
  if (!Number.isSafeInteger(item.price) || item.price < 0 || item.price > MAX_MONEY)
    throw new Error("Harga harus bilangan bulat rupiah yang valid.");
  if (item.image.length > MAX_IMAGE_LENGTH || !IMAGE_PATTERN.test(item.image)) {
    throw new Error("image harus berupa URL http(s), path relatif, atau data URI gambar.");
  }
}

function assertStockQuantity(mode: "set" | "add", qty: number | null): void {
  if (qty === null) {
    if (mode === "add") throw new Error("qty wajib diisi.");
    return;
  }
  const min = mode === "add" ? -MAX_STOCK : 0;
  if (!Number.isSafeInteger(qty) || qty < min || qty > MAX_STOCK) {
    throw new Error(`Jumlah stok harus bilangan bulat ${min.toLocaleString("id-ID")} sampai ${MAX_STOCK.toLocaleString("id-ID")}.`);
  }
}

const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

export const localSource: DataSource = {
  kind: "local",

  async init() {
    await db.open();
    await redateToToday();
  },

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
    return {
      products,
      orders,
      tables,
      categories,
      activeShift: activeShift ?? null,
      cashShiftOpen: activeShift !== undefined,
      cashMovements,
      pricing,
    };
  },

  async loadPricing() {
    return readStoredPricing();
  },

  async savePricing(pricing) {
    requireRole(CATALOG_WRITE_ROLES);
    if (!isValidRate(pricing.taxRate) || !isValidRate(pricing.serviceChargeRate)) {
      throw new Error(`Tarif pajak dan layanan harus antara 0 dan ${MAX_RATE}.`);
    }
    localStorage.setItem(STORAGE_KEYS.pricing, JSON.stringify(pricing));
    return pricing;
  },

  async loadProducts() {
    const rows = await db.products.toArray();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },

  async saveProduct(item) {
    requireRole(CATALOG_WRITE_ROLES);
    assertProduct(item);
    return db.transaction("rw", db.products, db.categories, async () => {
      const category = (await db.categories.toArray()).find((c) => sameName(c.name, item.category));
      if (!category) throw new Error("category tidak ditemukan; buat kategori terlebih dahulu.");
      const duplicate = await db.products
        .where("barcode")
        .equals(item.barcode)
        .and((p) => p.id !== item.id)
        .first();
      if (duplicate) throw new Error("barcode sudah digunakan produk lain.");
      await db.products.put({ ...item, category: category.name });
    });
  },

  async deleteProduct(id) {
    requireRole(CATALOG_WRITE_ROLES);
    await db.products.delete(id);
  },

  async adjustStock(item, mode, qty) {
    requireRole(STOCK_ROLES);
    assertStockQuantity(mode, qty);
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
    requireRole(CATALOG_WRITE_ROLES);
    if (table.name.trim() === "" || table.area.trim() === "") throw new Error("Nama dan area meja wajib diisi.");
    if (!Number.isSafeInteger(table.seats) || table.seats < 1 || table.seats > 1000)
      throw new Error("Jumlah kursi harus bilangan bulat 1-1000.");
    await restaurantTables.put(table);
  },

  async deleteTable(id) {
    requireRole(CATALOG_WRITE_ROLES);
    // A table with unpaid or still-cooking orders must stay so the cashier can settle it.
    return db.transaction("rw", restaurantTables, db.orders, async () => {
      if (await db.orders.filter((o) => o.tableId === id && isOpenOrder(o)).first()) {
        throw new Error("Meja masih memiliki pesanan aktif atau belum dibayar.");
      }
      await restaurantTables.delete(id);
    });
  },

  async loadCategories() {
    const rows = await db.categories.toArray();
    return rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },

  async saveCategory(category) {
    requireRole(CATALOG_WRITE_ROLES);
    return db.transaction("rw", db.categories, async () => {
      await assertCategoryNameFree(category.id, category.name);
      await db.categories.put(category);
    });
  },

  async updateCategory(id, updates, oldName) {
    requireRole(CATALOG_WRITE_ROLES);
    return db.transaction("rw", db.categories, db.products, async () => {
      if (updates.name !== undefined) await assertCategoryNameFree(id, updates.name);
      await db.categories.update(id, updates);
      if (updates.name && oldName && updates.name !== oldName) {
        await db.products.where("category").equals(oldName).modify({ category: updates.name });
      }
    });
  },

  async deleteCategory(id, _categoryName, reassignToCategoryName) {
    requireRole(CATALOG_WRITE_ROLES);
    return db.transaction("rw", db.categories, db.products, async () => {
      const category = await db.categories.get(id);
      if (!category) return;
      const used = await db.products.where("category").equals(category.name).count();
      if (used > 0) {
        const targetName = reassignToCategoryName?.trim();
        if (!targetName) throw new Error(`Kategori masih dipakai ${used} produk; pilih kategori tujuan untuk memindahkan produk.`);
        const target = (await db.categories.toArray()).find((c) => sameName(c.name, targetName));
        if (!target) throw new Error("Kategori tujuan tidak ditemukan.");
        if (target.id === id) throw new Error("Kategori tujuan harus berbeda.");
        await db.products.where("category").equals(category.name).modify({ category: target.name });
      }
      await db.categories.delete(id);
    });
  },

  async loadOrders() {
    const now = Date.now();
    const openShift = await db.shifts.where("status").equals("OPEN").first();
    const since = Math.min(now - OPERATIONAL_WINDOW_MS, openShift?.openedAt ?? Number.POSITIVE_INFINITY);
    const rows = await db.orders
      .filter((o) => o.createdAt >= since || (o.paidAt !== undefined && o.paidAt >= since) || isOpenOrder(o))
      .toArray();
    return rows.sort((a, b) => b.no - a.no);
  },

  async loadOrdersInRange(from, to) {
    requireRole(REPORT_ROLES);
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to <= from || to - from > MAX_REPORT_RANGE_MS) {
      throw new Error("from/to harus epoch milidetik dengan rentang maksimal 400 hari.");
    }
    const [created, paid] = await Promise.all([
      db.orders.where("createdAt").between(from, to, true, false).toArray(),
      db.orders.where("paidAt").between(from, to, true, false).toArray(),
    ]);
    const byNo = new Map<number, OrderRow>();
    for (const order of [...created, ...paid]) byNo.set(order.no, order);
    return [...byNo.values()].sort((a, b) => a.createdAt - b.createdAt || a.no - b.no);
  },

  async saveOrder(row, options) {
    // Customers ordering from the table QR are not staff, so the staff role checks do not apply to them.
    const selfOrder = row.source === "self-order";
    const paid = row.paymentStatus === "paid";
    if (!selfOrder) {
      requireRole(CREATE_ORDER_ROLES);
      if (paid) requireRole(CREATE_PAID_ROLES, "Peran Anda tidak diizinkan menerima pembayaran.");
      if ((row.discount ?? 0) > 0) requireRole(DISCOUNT_ROLES);
    }

    return db.transaction("rw", db.orders, db.products, db.shifts, restaurantTables, async () => {
      const existing = await db.orders.where("clientRef").equals(options.clientRef).first();
      if (existing) return existing;

      const dineIn = row.orderType === "meja";
      if (dineIn && !row.tableId) throw new Error("Pilih meja untuk pesanan dine-in.");
      const table = dineIn ? await restaurantTables.get(row.tableId ?? "") : undefined;
      if (dineIn && (!table || table.active === false)) throw new Error("Meja tidak ditemukan atau tidak aktif.");

      const productIds = [...new Set((row.items ?? []).map((item) => item.itemId))];
      const products = new Map((await db.products.bulkGet(productIds)).flatMap((p) => (p ? [[p.id, p] as const] : [])));
      const priced = priceOrder(row, products, readStoredPricing());
      // The cashier/customer confirmed `row.total`; never store a different amount silently.
      if (row.total !== priced.total) throw new Error(EXPECTED_TOTAL_MISMATCH_MESSAGE);

      let cashShiftId: string | undefined;
      if (paid) {
        if (!row.method) throw new Error("Metode pembayaran wajib diisi.");
        if (row.method === "tunai") {
          if ((options.cashReceived ?? -1) < priced.total) throw new Error("Uang diterima kurang dari total.");
          cashShiftId = (await openShiftForCash()).id;
        }
      }

      const qtyByProduct = new Map<string, number>();
      for (const item of priced.items) qtyByProduct.set(item.itemId, (qtyByProduct.get(item.itemId) ?? 0) + item.qty);
      const shortages: { name: string; stock: number }[] = [];
      for (const product of products.values()) {
        if (product.stock === undefined || product.stock === null) continue;
        if ((qtyByProduct.get(product.id) ?? 0) > product.stock) shortages.push({ name: product.name, stock: product.stock });
      }
      if (shortages.length > 0) throw new Error(stockShortageMessage(shortages));
      for (const product of products.values()) {
        if (product.stock === undefined || product.stock === null) continue;
        await db.products.update(product.id, { stock: product.stock - (qtyByProduct.get(product.id) ?? 0) });
      }

      const last = await db.orders.orderBy(":id").last();
      const now = Date.now();
      const kitchenStatus = row.kitchenStatus ?? "queued";
      const byWaiter = row.source === "waiter";
      const saved: OrderRow = {
        no: (last?.no ?? 0) + 1,
        status: legacyStatusFor(kitchenStatus),
        paymentStatus: paid ? "paid" : "unpaid",
        kitchenStatus,
        total: priced.total,
        subtotal: priced.subtotal,
        tax: priced.tax,
        discount: priced.discount,
        serviceCharge: priced.serviceCharge,
        itemCount: priced.itemCount,
        items: priced.items,
        method: paid ? row.method : undefined,
        orderType: row.orderType,
        tableId: table?.id,
        tableName: table?.name,
        tableArea: table?.area,
        guests: dineIn ? row.guests : undefined,
        customerName: row.customerName?.trim() || undefined,
        waiterId: byWaiter ? (actor?.id ?? row.waiterId) : undefined,
        waiterName: byWaiter ? (actor?.name ?? row.waiterName) : undefined,
        source: row.source ?? "pos",
        paymentChoice: row.paymentChoice ?? (paid ? "paid-now" : "pay-later"),
        cashReceived: paid && row.method === "tunai" ? options.cashReceived : undefined,
        paidBy: paid && !selfOrder ? actor?.name : undefined,
        paidAt: paid ? now : undefined,
        cashShiftId,
        createdAt: now,
        clientRef: options.clientRef,
      };
      await db.orders.add(saved);
      return saved;
    });
  },

  async settleOrder(no, method, paidBy, cashReceived) {
    return db.transaction("rw", db.orders, db.shifts, async () => {
      const order = await db.orders.get(no);
      if (!order) throw new Error("Pesanan tidak ditemukan.");
      // The demo QRIS screen stands in for the payment gateway: the customer, not staff, settles a self-order.
      const customerQris = order.source === "self-order" && method === "qris";
      if (!customerQris) requireRole(SETTLE_ROLES);
      if (order.paymentStatus === "paid") return { order, alreadyPaid: true };
      if (order.paymentStatus === "refunded") throw new Error("Pesanan sudah direfund dan tidak dapat dibayar.");
      let cashShiftId: string | undefined;
      if (method === "tunai") {
        if ((cashReceived ?? -1) < order.total) throw new Error("Uang diterima kurang dari total.");
        cashShiftId = (await openShiftForCash()).id;
      }
      const paid: OrderRow = {
        ...order,
        paymentStatus: "paid",
        method,
        paidAt: Date.now(),
        paidBy: customerQris ? paidBy : (actor?.name ?? paidBy),
        cashReceived: method === "tunai" ? cashReceived : undefined,
        cashShiftId,
      };
      await db.orders.put(paid);
      return { order: paid, alreadyPaid: false };
    });
  },

  async updateKitchenStatus(no, kitchenStatus) {
    requireRole(UPDATE_STATUS_ROLES);
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

  async saveShift(shift) {
    requireRole(FINANCE_ROLES);
    if (shift.status === "OPEN" && shift.closedAt !== undefined) throw new Error("Shift yang masih buka tidak boleh memiliki closedAt.");
    if (shift.closedAt !== undefined && shift.closedAt < shift.openedAt) throw new Error("closedAt tidak boleh sebelum openedAt.");
    if (!Number.isSafeInteger(shift.startingCash) || shift.startingCash < 0 || shift.startingCash > MAX_MONEY) {
      throw new Error("Modal awal harus bilangan bulat rupiah yang valid.");
    }
    return db.transaction("rw", db.shifts, db.orders, db.cash_movements, async () => {
      const existing = await db.shifts.get(shift.id);
      if (existing?.status === "CLOSED" && !canEditClosedShift()) {
        throw new Error("Shift yang sudah ditutup hanya dapat diubah oleh admin.");
      }
      if (shift.status === "OPEN") {
        const other = await db.shifts
          .where("status")
          .equals("OPEN")
          .and((s) => s.id !== shift.id)
          .first();
        if (other) throw new Error("Masih ada shift lain yang terbuka; tutup shift tersebut terlebih dahulu.");
      }
      const base: ShiftRecord = {
        id: shift.id,
        openedAt: existing?.openedAt ?? shift.openedAt,
        // Set once, from whoever opened the shift.
        cashierName: existing?.cashierName ?? actor?.name ?? shift.cashierName,
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
      if (!Number.isSafeInteger(shift.actualCash) || shift.actualCash < 0 || shift.actualCash > MAX_MONEY) {
        throw new Error("Uang fisik di laci harus bilangan bulat rupiah yang valid.");
      }
      const [orders, movements] = await Promise.all([
        db.orders.where("cashShiftId").equals(base.id).toArray(),
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
    requireRole(FINANCE_ROLES);
    if (!CASH_MOVEMENT_TYPES.includes(item.type)) throw new Error("Jenis mutasi kas tidak valid.");
    if (!CASH_MOVEMENT_CATEGORIES.includes(item.category)) throw new Error("Kategori mutasi kas tidak valid.");
    if (!Number.isSafeInteger(item.amount) || item.amount < 0 || item.amount > MAX_MONEY) {
      throw new Error("Nominal harus bilangan bulat rupiah yang valid.");
    }
    return db.transaction("rw", db.cash_movements, db.shifts, async () => {
      const existing = await db.cash_movements.get(item.id);
      await assertShiftsOpenForEdit([existing?.shiftId, item.shiftId]);
      const saved: CashMovementRow = { ...item, cashierName: existing?.cashierName ?? actor?.name ?? item.cashierName };
      await db.cash_movements.put(saved);
      return saved;
    });
  },

  async deleteCashMovement(id) {
    requireRole(FINANCE_ROLES);
    return db.transaction("rw", db.cash_movements, db.shifts, async () => {
      const existing = await db.cash_movements.get(id);
      if (!existing) return;
      await assertShiftsOpenForEdit([existing.shiftId]);
      await db.cash_movements.delete(id);
    });
  },
};

async function assertCategoryNameFree(id: string, name: string): Promise<void> {
  if (name.trim() === "") throw new Error("Nama kategori wajib diisi.");
  const taken = (await db.categories.toArray()).some((c) => c.id !== id && sameName(c.name, name));
  if (taken) throw new Error("Nama kategori sudah digunakan.");
}

/** A closed shift is an audited record: its cash movements stay as they were, for every role. */
async function assertShiftsOpenForEdit(shiftIds: readonly (string | undefined)[]): Promise<void> {
  const ids = shiftIds.filter((id): id is string => id !== undefined);
  const shifts = await db.shifts.bulkGet(ids);
  if (shifts.some((shift) => shift?.status === "CLOSED")) {
    throw new Error("Mutasi kas pada shift yang sudah ditutup tidak dapat diubah.");
  }
}
