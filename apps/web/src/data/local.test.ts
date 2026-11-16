import "fake-indexeddb/auto";
import {
  ACCESS_DENIED_MESSAGE,
  DEFAULT_PRICING,
  EXPECTED_TOTAL_MISMATCH_MESSAGE,
  KITCHEN_STATUSES,
  type OrderSource,
  type PayMethod,
} from "@wakro/shared";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { expectedDrawerCash } from "../lib/cash";
import { buildOrderRow } from "../lib/orderBuilder";
import { computeTotals, NO_DISCOUNT } from "../lib/pricing";
import { STORAGE_KEYS } from "../lib/storageKeys";
import { resetDemoData } from "../state/demo";
import { DEMO_STAFF } from "../state/demoStaff";
import type { CartDiscount, CartLine, OrderItemLine, OrderRow, ShiftRecord } from "../types/domain";
import { db } from "./db";
import { startOfDay } from "./demoData";
import { type LocalActor, localSource, setLocalActor } from "./local";
import { priceOrder } from "./localOrder";
import { isLowStock, isSoldOut, MENU_SEED } from "./menu";
import { DATA_DAY_KEY } from "./meta";
import { redateToToday } from "./redate";

const DAY = 24 * 60 * 60 * 1000;

const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() {
    return storage.size;
  },
};

const actorOf = (id: string): LocalActor => {
  const staff = DEMO_STAFF.find((s) => s.id === id)!;
  return { id: staff.id, name: staff.name, role: staff.role };
};
const KASIR = actorOf("staff-1");
const WAITER = actorOf("staff-2");
const KITCHEN = actorOf("staff-5");
const MANAGER = actorOf("staff-6");
const ADMIN = actorOf("staff-7");

type OrderOptions = {
  source?: OrderSource;
  method?: PayMethod;
  tableId?: string;
  lines?: CartLine[];
  discount?: CartDiscount;
};

/** An order exactly like the cart builds it: priced from the menu with the stored pricing. */
function cartOrder({
  source = "pos",
  method,
  tableId,
  lines = [{ itemId: "kopi-susu", qty: 2 }],
  discount = NO_DISCOUNT,
}: OrderOptions = {}): OrderRow {
  const totals = computeTotals(lines, MENU_SEED, discount, DEFAULT_PRICING);
  return buildOrderRow(lines, MENU_SEED, totals, {
    source,
    orderType: tableId ? "meja" : "bawa-pulang",
    table: tableId ? { id: tableId, name: tableId, seats: 4, area: "Lantai 1" } : undefined,
    method,
    paymentChoice: method ? "paid-now" : "pay-later",
  });
}

let refCounter = 0;
const ref = () => `ref-${(refCounter += 1)}`;

const totalsOf = (o: Pick<OrderRow, "subtotal" | "discount" | "serviceCharge" | "tax" | "total" | "itemCount">) => ({
  subtotal: o.subtotal,
  discount: o.discount,
  serviceCharge: o.serviceCharge,
  tax: o.tax,
  total: o.total,
  itemCount: o.itemCount,
});
const lineOf = ({ itemId, name, qty, price }: OrderItemLine) => ({ itemId, name, qty, price });

async function openShift(): Promise<ShiftRecord> {
  const open = await localSource.loadActiveShift();
  if (!open) throw new Error("seed has no open shift");
  return open;
}

async function closeOpenShift(actualCash = 0): Promise<ShiftRecord> {
  const open = await openShift();
  return localSource.saveShift({ ...open, closedAt: Date.now(), actualCash, status: "CLOSED" });
}

beforeEach(async () => {
  storage.clear();
  vi.stubGlobal("localStorage", localStorageStub);
  setLocalActor(null);
  db.close();
  await db.delete();
  await localSource.init();
});

afterAll(async () => {
  db.close();
  await db.delete();
  vi.unstubAllGlobals();
});

describe("demo seed", () => {
  it("prices every seeded order exactly like a fresh re-pricing from the menu", async () => {
    const orders = await db.orders.toArray();
    const products = new Map(MENU_SEED.map((p) => [p.id, p]));
    expect(orders.length).toBeGreaterThan(150);
    for (const order of orders) {
      expect(order.items?.length, `order ${order.no} has items`).toBeGreaterThan(0);
      const priced = priceOrder(order, products, DEFAULT_PRICING);
      expect(totalsOf(order), `order ${order.no}`).toEqual(totalsOf(priced));
      expect(order.items?.map(lineOf)).toEqual(priced.items.map(lineOf));
    }
  });

  it("keeps closed shifts consistent with their orders and cash movements", async () => {
    const shifts = await db.shifts.toArray();
    const closed = shifts.filter((s) => s.status === "CLOSED");
    expect(closed.length).toBeGreaterThanOrEqual(21);
    expect(closed.some((s) => s.cashDifference !== 0)).toBe(true);
    for (const shift of closed) {
      const orders = await db.orders.where("cashShiftId").equals(shift.id).toArray();
      const movements = await db.cash_movements.where("shiftId").equals(shift.id).toArray();
      const drawer = expectedDrawerCash(shift, orders, movements);
      expect(shift.expectedCash).toBe(drawer.expected);
      expect(shift.cashSalesTotal).toBe(drawer.cashSales);
      expect(shift.cashDifference).toBe(shift.actualCash! - drawer.expected);
      expect(movements.some((m) => m.category === "modal_awal")).toBe(true);
    }
    const cashOrders = (await db.orders.toArray()).filter((o) => o.method === "tunai");
    expect(cashOrders.every((o) => o.cashShiftId !== undefined && o.cashReceived! >= o.total)).toBe(true);
  });

  it("has a live today: open shift, every kitchen status and source, waiters from the demo staff", async () => {
    const open = await openShift();
    expect(open).toMatchObject({ cashierName: "Jamie Morgan", startingCash: 200_000, status: "OPEN" });
    const opening = (await localSource.loadCashMovements(open.id)).find((m) => m.category === "modal_awal");
    expect(opening).toMatchObject({ shiftId: open.id, amount: 200_000 });

    const today = (await localSource.loadOrders()).filter((o) => o.createdAt >= open.openedAt);
    expect(new Set(today.map((o) => o.kitchenStatus))).toEqual(new Set(KITCHEN_STATUSES));
    expect(new Set(today.map((o) => o.source))).toEqual(new Set(["pos", "waiter", "self-order"]));
    expect(today.some((o) => o.kitchenStatus === "served" && o.paymentStatus === "unpaid")).toBe(true);
    expect(today.some((o) => o.orderType === "bawa-pulang" && o.paymentStatus === "unpaid")).toBe(true);
    expect(today.some((o) => o.source === "self-order" && o.paymentStatus === "paid")).toBe(true);
    const staffNames = new Map(DEMO_STAFF.map((s) => [s.id, s.name]));
    for (const order of today.filter((o) => o.source === "waiter")) expect(staffNames.get(order.waiterId!)).toBe(order.waiterName);
    expect(today.every((o) => o.createdAt <= Date.now())).toBe(true);
  });

  it("has a full menu with every stock state", () => {
    expect(MENU_SEED.length).toBeGreaterThanOrEqual(20);
    expect(MENU_SEED.some((p) => typeof p.stock === "number" && p.stock >= 5)).toBe(true);
    expect(MENU_SEED.some(isLowStock)).toBe(true);
    expect(MENU_SEED.some(isSoldOut)).toBe(true);
    expect(MENU_SEED.some((p) => p.stock === undefined)).toBe(true);
    expect(new Set(MENU_SEED.map((p) => p.barcode)).size).toBe(MENU_SEED.length);
  });
});

describe("keeping the demo fresh", () => {
  it("moves everything stored forward by the whole days that passed, keeping times of day", async () => {
    const before = { orders: await db.orders.toArray(), shifts: await db.shifts.toArray(), movements: await db.cash_movements.toArray() };
    const now = Date.now() + 2 * DAY;
    const delta = startOfDay(now) - startOfDay(Date.now());
    const move = (ts: number) => Math.min(ts + delta, now);

    await redateToToday(now);

    const orders = new Map((await db.orders.toArray()).map((o) => [o.no, o]));
    for (const old of before.orders) {
      expect(orders.get(old.no)?.createdAt).toBe(move(old.createdAt));
      expect(orders.get(old.no)?.paidAt).toBe(old.paidAt === undefined ? undefined : move(old.paidAt));
    }
    const shifts = new Map((await db.shifts.toArray()).map((s) => [s.id, s]));
    for (const old of before.shifts) {
      expect(shifts.get(old.id)?.openedAt).toBe(move(old.openedAt));
      expect(shifts.get(old.id)?.closedAt).toBe(old.closedAt === undefined ? undefined : move(old.closedAt));
    }
    for (const old of before.movements) expect((await db.cash_movements.get(old.id))?.createdAt).toBe(move(old.createdAt));
    expect((await openShift()).openedAt).toBeGreaterThanOrEqual(startOfDay(now));
    expect((await db.meta.get(DATA_DAY_KEY))?.value).toBe(startOfDay(now));

    const afterFirst = await db.orders.toArray();
    await redateToToday(now);
    expect(await db.orders.toArray()).toEqual(afterFirst);
  });

  it("changes nothing when the data is already aligned to today", async () => {
    const before = await db.orders.toArray();
    await localSource.init();
    expect(await db.orders.toArray()).toEqual(before);
  });
});

describe("resetting the demo", () => {
  it("deletes the database and the demo's browser settings, tells other tabs, and reloads", async () => {
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    storage.set(STORAGE_KEYS.pricing, "{}");
    storage.set(STORAGE_KEYS.currentStaffId, "staff-2");
    storage.set("wakro_waiter_cart_staff-2", "[]");
    storage.set("wakro_waiter_table_staff-2", "meja-01");
    storage.set(STORAGE_KEYS.sidebarCollapsed, "1");
    await db.products.clear();
    await db.orders.clear();

    await resetDemoData();

    expect(reload).toHaveBeenCalledOnce();
    expect([...storage.keys()]).toEqual([STORAGE_KEYS.sidebarCollapsed]);
    await localSource.init();
    expect(await localSource.loadProducts()).toHaveLength(MENU_SEED.length);
    expect(await db.orders.count()).toBeGreaterThan(150);
    expect(await localSource.loadActiveShift()).toBeDefined();
  });
});

describe("saving orders", () => {
  it("re-prices from the menu and rejects a total that no longer matches", async () => {
    const stale = cartOrder();
    storage.set(STORAGE_KEYS.pricing, JSON.stringify({ ...DEFAULT_PRICING, serviceChargeEnabled: true }));
    await expect(localSource.saveOrder(stale, { clientRef: ref() })).rejects.toThrow(EXPECTED_TOTAL_MISMATCH_MESSAGE);

    const tampered = cartOrder();
    tampered.items = tampered.items!.map((item) => ({ ...item, price: 1, name: "Murah" }));
    storage.clear();
    const saved = await localSource.saveOrder(tampered, { clientRef: ref() });
    expect(saved.items).toEqual([{ itemId: "kopi-susu", name: "Kopi Susu", qty: 2, price: 25_000, note: undefined }]);
    expect(saved.total).toBe(tampered.total);
  });

  it("rejects unknown products, missing tables and dine-in without a table", async () => {
    const unknown = cartOrder();
    unknown.items = [{ itemId: "tidak-ada", name: "?", qty: 1, price: 1 }];
    await expect(localSource.saveOrder(unknown, { clientRef: ref() })).rejects.toThrow("tidak ditemukan");
    await expect(localSource.saveOrder(cartOrder({ tableId: "meja-99" }), { clientRef: ref() })).rejects.toThrow("Meja tidak ditemukan");
    const noTable = { ...cartOrder({ tableId: "meja-01" }), tableId: undefined };
    await expect(localSource.saveOrder(noTable, { clientRef: ref() })).rejects.toThrow("Pilih meja");
    await expect(localSource.saveOrder(cartOrder({ lines: [{ itemId: "kopi-susu", qty: 1000 }] }), { clientRef: ref() })).rejects.toThrow(
      "1-999",
    );
  });

  it("caps a discount at the subtotal and rejects cash below the total", async () => {
    const order = cartOrder({ lines: [{ itemId: "kopi-hitam", qty: 1 }] });
    const huge = { ...order, discount: 999_999, total: 0 };
    expect((await localSource.saveOrder(huge, { clientRef: ref() })).discount).toBe(18_000);

    const paid = cartOrder({ method: "tunai" });
    await expect(localSource.saveOrder(paid, { clientRef: ref(), cashReceived: paid.total - 1 })).rejects.toThrow("Uang diterima kurang");
  });

  it("books cash payments on the open shift and stamps the acting staff member", async () => {
    setLocalActor(KASIR);
    const shift = await openShift();
    const cash = cartOrder({ method: "tunai" });
    const saved = await localSource.saveOrder(cash, { clientRef: ref(), cashReceived: 100_000 });
    expect(saved).toMatchObject({ cashShiftId: shift.id, paidBy: "Jamie Morgan", cashReceived: 100_000 });

    const qris = await localSource.saveOrder(cartOrder({ method: "qris" }), { clientRef: ref() });
    expect(qris.cashShiftId).toBeUndefined();

    const unpaid = await localSource.saveOrder(cartOrder(), { clientRef: ref() });
    const settled = await localSource.settleOrder(unpaid.no, "tunai", "ignored", 100_000);
    expect(settled.order).toMatchObject({ cashShiftId: shift.id, paidBy: "Jamie Morgan" });

    const closed = await closeOpenShift(500_000);
    const orders = await db.orders.where("cashShiftId").equals(shift.id).toArray();
    expect(closed.cashSalesTotal).toBe(orders.filter((o) => o.method === "tunai").reduce((sum, o) => sum + o.total, 0));
    expect(closed.cashSalesTotal).toBeGreaterThan(saved.total + settled.order.total - 1);
  });

  it("records the waiter from the acting staff member", async () => {
    setLocalActor(WAITER);
    const order = { ...cartOrder({ source: "waiter", tableId: "meja-01" }), waiterId: "forged", waiterName: "Forged" };
    expect(await localSource.saveOrder(order, { clientRef: ref() })).toMatchObject({
      waiterId: "staff-2",
      waiterName: "Budi Santoso",
      tableName: "Meja 01",
    });
  });

  it("accepts cash only while a shift is open, like the API", async () => {
    await closeOpenShift();
    const paidCash = cartOrder({ method: "tunai" });
    await expect(localSource.saveOrder(paidCash, { clientRef: ref(), cashReceived: 100_000 })).rejects.toThrow("Buka shift");
    const open = await localSource.saveOrder(cartOrder(), { clientRef: ref() });
    await expect(localSource.settleOrder(open.no, "tunai", "Kasir", 100_000)).rejects.toThrow("Buka shift");
    expect((await localSource.loadSnapshot()).cashShiftOpen).toBe(false);

    await localSource.saveShift({ id: "shift-test", openedAt: Date.now(), cashierName: "Kasir", startingCash: 0, status: "OPEN" });
    expect((await localSource.settleOrder(open.no, "tunai", "Kasir", 100_000)).order.paymentStatus).toBe("paid");
  });

  it("reports a refunded order before a missing shift", async () => {
    await closeOpenShift();
    const saved = await localSource.saveOrder(cartOrder(), { clientRef: ref() });
    await db.orders.put({ ...saved, paymentStatus: "refunded" });
    await expect(localSource.settleOrder(saved.no, "tunai", "Kasir", 100_000)).rejects.toThrow("direfund");
  });

  it("replays a retried submit and only lists recent or open orders", async () => {
    const clientRef = ref();
    const first = await localSource.saveOrder(cartOrder(), { clientRef });
    expect((await localSource.saveOrder(cartOrder(), { clientRef })).no).toBe(first.no);

    const listed = await localSource.loadOrders();
    const open = await openShift();
    expect(listed.length).toBeLessThan(await db.orders.count());
    expect(listed.every((o) => o.createdAt >= open.openedAt - 2 * DAY || o.paymentStatus === "unpaid")).toBe(true);
    await expect(localSource.loadOrdersInRange(0, 401 * DAY)).rejects.toThrow("400 hari");
    const range = await localSource.loadOrdersInRange(Date.now() - 30 * DAY, Date.now() + DAY);
    expect(range.map((o) => o.createdAt)).toEqual([...range.map((o) => o.createdAt)].sort((a, b) => a - b));
  });
});

describe("role policy", () => {
  it("denies actions the API denies, with the API's wording", async () => {
    const product = MENU_SEED[0];
    setLocalActor(WAITER);
    await expect(localSource.saveProduct(product)).rejects.toThrow(ACCESS_DENIED_MESSAGE);
    await expect(localSource.deleteTable("meja-01")).rejects.toThrow(ACCESS_DENIED_MESSAGE);
    await expect(localSource.saveShift({ id: "x", openedAt: 1, cashierName: "x", startingCash: 0, status: "OPEN" })).rejects.toThrow(
      ACCESS_DENIED_MESSAGE,
    );
    const unpaid = (await localSource.loadOrders()).find((o) => o.paymentStatus === "unpaid" && o.source === "pos")!;
    await expect(localSource.settleOrder(unpaid.no, "qris", "x")).rejects.toThrow(ACCESS_DENIED_MESSAGE);
    const discounted = { ...cartOrder(), discount: 1_000 };
    await expect(localSource.saveOrder(discounted, { clientRef: ref() })).rejects.toThrow(ACCESS_DENIED_MESSAGE);
    expect((await localSource.saveOrder(cartOrder({ method: "qris" }), { clientRef: ref() })).paymentStatus).toBe("paid");

    setLocalActor(KITCHEN);
    await expect(localSource.saveOrder(cartOrder(), { clientRef: ref() })).rejects.toThrow(ACCESS_DENIED_MESSAGE);
    const queued = (await localSource.loadOrders()).find((o) => o.kitchenStatus === "queued")!;
    expect((await localSource.updateKitchenStatus(queued.no, "preparing")).kitchenStatus).toBe("preparing");

    setLocalActor(MANAGER);
    await expect(localSource.saveCategory({ id: "c", name: "Baru", kind: "Makanan", sortOrder: 9, createdAt: 1 })).rejects.toThrow(
      ACCESS_DENIED_MESSAGE,
    );
    await expect(localSource.savePricing({ ...DEFAULT_PRICING })).rejects.toThrow(ACCESS_DENIED_MESSAGE);
    expect((await localSource.adjustStock(MENU_SEED.find((p) => p.id === "kentang-goreng")!, "add", 1)).stock).toBe(41);

    setLocalActor(KASIR);
    await expect(localSource.savePricing({ ...DEFAULT_PRICING })).resolves.toEqual(DEFAULT_PRICING);
  });

  it("lets a customer settle their self-order with the demo QRIS whoever is signed in", async () => {
    setLocalActor(WAITER);
    const pending = await localSource.saveOrder(cartOrder({ source: "self-order", tableId: "meja-01" }), { clientRef: ref() });
    const settled = await localSource.settleOrder(pending.no, "qris", "Pelanggan");
    expect(settled.order).toMatchObject({ paymentStatus: "paid", method: "qris", paidBy: "Pelanggan" });
    const posOrder = await localSource.saveOrder(cartOrder(), { clientRef: ref() });
    await expect(localSource.settleOrder(posOrder.no, "qris", "Pelanggan")).rejects.toThrow(ACCESS_DENIED_MESSAGE);
  });
});

describe("shifts", () => {
  it("allows one open shift, validates the closing time and freezes closed shifts for non-admins", async () => {
    setLocalActor(KASIR);
    const open = await openShift();
    await expect(
      localSource.saveShift({ id: "second", openedAt: Date.now(), cashierName: "x", startingCash: 0, status: "OPEN" }),
    ).rejects.toThrow("shift lain yang terbuka");
    await expect(localSource.saveShift({ ...open, closedAt: open.openedAt - 1, actualCash: 0, status: "CLOSED" })).rejects.toThrow(
      "tidak boleh sebelum openedAt",
    );

    const closed = await closeOpenShift(250_000);
    const drawer = expectedDrawerCash(
      closed,
      await db.orders.where("cashShiftId").equals(open.id).toArray(),
      await db.cash_movements.where("shiftId").equals(open.id).toArray(),
    );
    expect(closed).toMatchObject({
      status: "CLOSED",
      expectedCash: drawer.expected,
      cashDifference: 250_000 - drawer.expected,
      cashierName: "Jamie Morgan",
    });

    await expect(localSource.saveShift({ ...closed, notes: "ubah", status: "CLOSED" })).rejects.toThrow("hanya dapat diubah oleh admin");
    await expect(localSource.saveShift({ ...closed, status: "OPEN", closedAt: undefined })).rejects.toThrow(
      "hanya dapat diubah oleh admin",
    );

    setLocalActor(ADMIN);
    expect((await localSource.saveShift({ ...closed, notes: "dikoreksi admin" })).notes).toBe("dikoreksi admin");
    expect(
      (await localSource.saveShift({ id: "second", openedAt: Date.now(), cashierName: "x", startingCash: 0, status: "OPEN" })).cashierName,
    ).toBe("Dewi Lestari");
  });

  it("freezes the cash movements of a closed shift and validates movements", async () => {
    setLocalActor(KASIR);
    const closedShift = (await localSource.loadShiftHistory()).find((s) => s.status === "CLOSED")!;
    const frozen = (await localSource.loadCashMovements(closedShift.id))[0];
    await expect(localSource.saveCashMovement({ ...frozen, amount: 1 })).rejects.toThrow("sudah ditutup");
    await expect(localSource.deleteCashMovement(frozen.id)).rejects.toThrow("sudah ditutup");
    expect(await localSource.loadCashMovements(closedShift.id)).toContainEqual(frozen);

    const open = await openShift();
    const movement = {
      id: "mov-new",
      shiftId: open.id,
      type: "CASH_OUT" as const,
      category: "operasional" as const,
      amount: 5_000,
      description: "Tisu",
      cashierName: "x",
      createdAt: Date.now(),
    };
    expect((await localSource.saveCashMovement(movement)).cashierName).toBe("Jamie Morgan");
    await expect(localSource.saveCashMovement({ ...movement, amount: -1 })).rejects.toThrow("Nominal");
    await expect(localSource.saveCashMovement({ ...movement, category: "bukan" as never })).rejects.toThrow("Kategori");
    await expect(localSource.saveCashMovement({ ...movement, shiftId: closedShift.id })).rejects.toThrow("sudah ditutup");
    await localSource.deleteCashMovement(movement.id);
    expect(await localSource.loadCashMovements(open.id)).not.toContainEqual(expect.objectContaining({ id: movement.id }));
  });
});

describe("catalog rules", () => {
  it("refuses to delete a category that products use without a valid, different target", async () => {
    const minuman = (await localSource.loadCategories()).find((c) => c.name === "Minuman")!;
    await expect(localSource.deleteCategory(minuman.id, "Minuman")).rejects.toThrow("masih dipakai");
    await expect(localSource.deleteCategory(minuman.id, "Minuman", "minuman")).rejects.toThrow("harus berbeda");
    await expect(localSource.deleteCategory(minuman.id, "Minuman", "Tidak Ada")).rejects.toThrow("tidak ditemukan");
    expect((await localSource.loadProducts()).filter((p) => p.category === "Minuman")).not.toHaveLength(0);

    const inMinuman = (await localSource.loadProducts()).filter((p) => p.category === "Minuman").length;
    const before = (await localSource.loadProducts()).filter((p) => p.category === "Camilan").length;
    await localSource.deleteCategory(minuman.id, "Minuman", "camilan");
    const products = await localSource.loadProducts();
    expect(products.filter((p) => p.category === "Camilan")).toHaveLength(before + inMinuman);
    expect(products.some((p) => p.category === "Minuman")).toBe(false);
    expect((await localSource.loadCategories()).some((c) => c.id === minuman.id)).toBe(false);
  });

  it("keeps category names unique, ignoring case", async () => {
    await expect(localSource.saveCategory({ id: "dup", name: " favorit ", kind: "Makanan", sortOrder: 9, createdAt: 1 })).rejects.toThrow(
      "sudah digunakan",
    );
    const sarapan = (await localSource.loadCategories()).find((c) => c.name === "Sarapan")!;
    await expect(localSource.updateCategory(sarapan.id, { name: "MINUMAN" }, "Sarapan")).rejects.toThrow("sudah digunakan");
  });

  it("refuses to delete a table with active orders but deletes a free one", async () => {
    const busy = (await localSource.loadOrders()).find((o) => o.tableId && o.kitchenStatus === "queued")!;
    await expect(localSource.deleteTable(busy.tableId!)).rejects.toThrow("pesanan aktif");
    await localSource.deleteTable("rooftop-02");
    expect((await localSource.loadTables()).some((t) => t.id === "rooftop-02")).toBe(false);
    await expect(localSource.saveTable({ id: "t", name: " ", seats: 2, area: "Lantai 1" })).rejects.toThrow("wajib diisi");
  });

  it("validates products: unique barcode, existing category, image and stock bounds", async () => {
    const [first, second] = MENU_SEED;
    await expect(localSource.saveProduct({ ...first, barcode: second.barcode })).rejects.toThrow("barcode sudah digunakan");
    await expect(localSource.saveProduct({ ...first, category: "Tidak Ada" })).rejects.toThrow("category tidak ditemukan");
    await expect(localSource.saveProduct({ ...first, image: "javascript:alert(1)" })).rejects.toThrow("image harus");
    await localSource.saveProduct({ ...first, category: "favorit", price: 26_000 });
    expect((await localSource.loadProducts()).find((p) => p.id === first.id)).toMatchObject({ category: "Favorit", price: 26_000 });

    const tracked = MENU_SEED.find((p) => p.id === "kentang-goreng")!;
    await expect(localSource.adjustStock(tracked, "add", 1_000_001)).rejects.toThrow("bilangan bulat");
    await expect(localSource.adjustStock(tracked, "set", 1.5)).rejects.toThrow("bilangan bulat");
    await expect(localSource.adjustStock(first, "add", 1)).rejects.toThrow("belum dilacak");
  });
});
