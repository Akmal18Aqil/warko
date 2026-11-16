import { DEFAULT_PRICING, type KitchenStatus, type OrderSource, type PayMethod } from "@wakro/shared";
import type { Transaction } from "dexie";
import { expectedDrawerCash } from "../lib/cash";
import { buildOrderRow } from "../lib/orderBuilder";
import { computeTotals, NO_DISCOUNT } from "../lib/pricing";
import { DEMO_STAFF } from "../state/demoStaff";
import type { CartDiscount, CartLine, CashMovementRow, CategoryRow, OrderRow, ShiftRecord, TableRow } from "../types/domain";
import { isSoldOut, MENU_SEED, type MenuItem } from "./menu";
import { DATA_DAY_KEY } from "./meta";
import { DEFAULT_CATEGORIES, DEFAULT_TABLES } from "./seed";

/**
 * Deterministic demo data for the browser-only (local) mode: three weeks of closed shifts with paid
 * orders, plus a live "today" (open shift, orders in every kitchen status). Every order is built from
 * the demo menu with the same pricing functions the API uses, so stored totals always match a re-pricing.
 */

const MINUTE = 60_000;
const HISTORY_DAYS = 21;
const FIRST_ORDER_NO = 1001;
const STARTING_CASH = 200_000;

export type DemoData = {
  products: MenuItem[];
  categories: CategoryRow[];
  tables: TableRow[];
  orders: OrderRow[];
  shifts: ShiftRecord[];
  cashMovements: CashMovementRow[];
};

// ---- time ---------------------------------------------------------------------------------------

/** Local midnight of the day `ts` falls on. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayStartDaysAgo(now: number, daysAgo: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysAgo).getTime();
}

function dayKey(dayStart: number): string {
  const d = new Date(dayStart);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// ---- randomness ---------------------------------------------------------------------------------

/** mulberry32: tiny seeded PRNG so the demo history is identical on every device and run. */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

const between = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)];

function pickWeighted(rng: Rng, pool: readonly MenuItem[]): MenuItem {
  const weight = (p: MenuItem) => (p.badge ? 3 : p.category === "Favorit" ? 2 : 1);
  let roll = rng() * pool.reduce((sum, p) => sum + weight(p), 0);
  for (const product of pool) {
    roll -= weight(product);
    if (roll < 0) return product;
  }
  return pool[pool.length - 1];
}

function pickDistinct(rng: Rng, pool: readonly MenuItem[], count: number): MenuItem[] {
  const left = [...pool];
  const picked: MenuItem[] = [];
  while (picked.length < count && left.length > 0) {
    const product = pickWeighted(rng, left);
    picked.push(product);
    left.splice(left.indexOf(product), 1);
  }
  return picked;
}

// ---- cast and menu pools ------------------------------------------------------------------------

const cashier = DEMO_STAFF.find((s) => s.role === "kasir")!;
const waiters = DEMO_STAFF.filter((s) => s.role === "pelayan");

const sellable = MENU_SEED.filter((p) => !isSoldOut(p));
const MAINS = sellable.filter((p) => p.kind === "Makanan" && ["Favorit", "Makanan", "Mie & Pasta"].includes(p.category));
const DRINKS = sellable.filter((p) => p.kind === "Minuman");
const EXTRAS = sellable.filter((p) => ["Sarapan", "Camilan", "Dessert"].includes(p.category));

const CUSTOMERS = [
  "Rina",
  "Pak Wijaya",
  "Keluarga Hartono",
  "Andi",
  "Lia",
  "Maya",
  "Bu Sari",
  "Dimas",
  "Kevin & Teman",
  "Pak Anton",
  "Nadia",
];
const NOTES = ["Pedas sedang", "Tanpa es", "Less sugar", "Tanpa bawang goreng", "Ekstra sambal", "Dipisah wadahnya"];
const OUT_DESCRIPTIONS: Record<"bahan_baku" | "operasional", readonly string[]> = {
  bahan_baku: [
    "Beli es batu kristal 2 pack",
    "Beli sayur dan cabai di pasar",
    "Beli gas LPG 3 kg",
    "Beli susu segar 6 liter",
    "Beli telur 2 tray",
  ],
  operasional: ["Beli tisu dan plastik takeaway", "Iuran kebersihan harian", "Beli bon kertas struk"],
};

type Meal = "lunch" | "dinner" | "snack";

function pickLines(rng: Rng, meal: Meal): CartLine[] {
  const products =
    meal === "snack"
      ? [...pickDistinct(rng, DRINKS, between(rng, 1, 2)), ...(rng() < 0.6 ? pickDistinct(rng, EXTRAS, 1) : [])]
      : [
          ...pickDistinct(rng, MAINS, 1 + (rng() < 0.5 ? 1 : 0) + (rng() < 0.2 ? 1 : 0)),
          ...pickDistinct(rng, DRINKS, 1 + (rng() < 0.4 ? 1 : 0)),
          ...(rng() < 0.45 ? pickDistinct(rng, EXTRAS, 1) : []),
        ];
  return products.map((product) => ({
    itemId: product.id,
    qty: rng() < 0.15 ? 2 : 1,
    note: rng() < 0.12 ? pick(rng, NOTES) : undefined,
  }));
}

// ---- orders -------------------------------------------------------------------------------------

type PaymentSpec = { method: PayMethod; paidAt: number; paidBy?: string; cashShiftId?: string };

type OrderSpec = {
  createdAt: number;
  source: OrderSource;
  kitchenStatus: KitchenStatus;
  lines: CartLine[];
  table?: TableRow;
  guests?: number;
  customerName: string;
  waiter?: (typeof waiters)[number];
  discount?: CartDiscount;
  payment?: PaymentSpec;
};

/** Smallest "customer hands over this much" amount at or above the total. */
function cashReceivedFor(total: number): number {
  const step = total <= 20_000 ? 5_000 : total <= 100_000 ? 10_000 : 50_000;
  return Math.ceil(total / step) * step;
}

function makeOrder(spec: OrderSpec): OrderRow {
  const totals = computeTotals(spec.lines, MENU_SEED, spec.discount ?? NO_DISCOUNT, DEFAULT_PRICING);
  const row = buildOrderRow(spec.lines, MENU_SEED, totals, {
    source: spec.source,
    orderType: spec.table ? "meja" : "bawa-pulang",
    table: spec.table,
    guests: spec.guests,
    customerName: spec.customerName,
    waiterId: spec.waiter?.id,
    waiterName: spec.waiter?.name,
    method: spec.payment?.method,
    paymentChoice: spec.payment ? "paid-now" : "pay-later",
    kitchenStatus: spec.kitchenStatus,
  });
  const { payment } = spec;
  return {
    ...row,
    createdAt: spec.createdAt,
    ...(payment && {
      paidAt: payment.paidAt,
      paidBy: payment.paidBy,
      cashShiftId: payment.cashShiftId,
      cashReceived: payment.method === "tunai" ? cashReceivedFor(totals.total) : undefined,
    }),
  };
}

type Window = { from: number; to: number };

type PaidShape = { source: OrderSource; method: PayMethod };

/** One finished order: dine-in or takeaway, paid at the register or by the customer, cash booked on `shiftId`. */
function makePaidOrder(rng: Rng, createdAt: number, shiftId: string, latestPaidAt: number, meal: Meal, forced?: PaidShape): OrderRow {
  const source = forced?.source ?? (rng() < 0.55 ? "pos" : rng() < 0.67 ? "waiter" : "self-order");
  const dineIn = source !== "pos" || (meal !== "snack" && rng() < 0.5);
  const table = dineIn ? pick(rng, DEFAULT_TABLES) : undefined;
  const method = forced?.method ?? (source === "self-order" ? "qris" : rng() < 0.4 ? "tunai" : rng() < 0.58 ? "qris" : "kartu-qr");
  const delay = dineIn ? between(rng, 18, 50) * MINUTE : between(rng, 0, 4) * MINUTE;
  return makeOrder({
    createdAt,
    source,
    kitchenStatus: "served",
    lines: pickLines(rng, meal),
    table,
    guests: table ? between(rng, 1, table.seats) : undefined,
    customerName: pick(rng, CUSTOMERS),
    waiter: source === "waiter" ? pick(rng, waiters) : undefined,
    discount: source === "pos" && rng() < 0.08 ? { type: "percent", value: 10 } : undefined,
    payment: {
      method,
      paidAt: Math.max(createdAt, Math.min(createdAt + delay, latestPaidAt)),
      paidBy: source === "self-order" ? undefined : cashier.name,
      cashShiftId: method === "tunai" ? shiftId : undefined,
    },
  });
}

const MEAL_WINDOWS: Record<Meal, [fromMinute: number, toMinute: number]> = {
  lunch: [11 * 60 + 30, 14 * 60 + 15],
  dinner: [18 * 60, 21 * 60 + 15],
  snack: [8 * 60 + 45, 17 * 60 + 30],
};

function pickMeal(rng: Rng): Meal {
  const roll = rng();
  return roll < 0.55 ? "lunch" : roll < 0.95 ? "dinner" : "snack";
}

// ---- shifts -------------------------------------------------------------------------------------

function openingMovement(shiftId: string, openedAt: number): CashMovementRow {
  return {
    id: `mov-${shiftId}-open`,
    shiftId,
    type: "CASH_IN",
    category: "modal_awal",
    amount: STARTING_CASH,
    description: "Modal awal kasir buka shift",
    cashierName: cashier.name,
    createdAt: openedAt + MINUTE,
  };
}

function expenseMovement(rng: Rng, shiftId: string, index: number, window: Window): CashMovementRow {
  const category = rng() < 0.7 ? "bahan_baku" : "operasional";
  return {
    id: `mov-${shiftId}-${index}`,
    shiftId,
    type: "CASH_OUT",
    category,
    amount: between(rng, 3, 12) * 5_000,
    description: pick(rng, OUT_DESCRIPTIONS[category]),
    cashierName: cashier.name,
    createdAt: between(rng, window.from, window.to),
  };
}

const DRAWER_DIFFERENCES = [0, 0, 0, 0, -2_000, 1_000, -5_000, 0, 5_000, -1_000];

type DayOutput = { orders: OrderRow[]; shift: ShiftRecord; movements: CashMovementRow[] };

/** A finished day: one closed shift whose totals are computed from its own orders and movements. */
function buildClosedDay(rng: Rng, dayStart: number): DayOutput {
  const shiftId = `shift-${dayKey(dayStart)}`;
  const openedAt = dayStart + between(rng, 7 * 60 + 50, 8 * 60 + 20) * MINUTE;
  const closedAt = dayStart + between(rng, 22 * 60 + 25, 22 * 60 + 50) * MINUTE;
  const weekday = new Date(dayStart).getDay();
  const count = weekday === 0 || weekday === 5 || weekday === 6 ? between(rng, 15, 21) : between(rng, 9, 13);

  const orders = Array.from({ length: count }, () => {
    const meal = pickMeal(rng);
    const [fromMinute, toMinute] = MEAL_WINDOWS[meal];
    return makePaidOrder(rng, dayStart + between(rng, fromMinute, toMinute) * MINUTE, shiftId, closedAt - 5 * MINUTE, meal);
  });
  const movements = [
    openingMovement(shiftId, openedAt),
    ...Array.from({ length: between(rng, 1, 2) }, (_, i) =>
      expenseMovement(rng, shiftId, i + 1, { from: openedAt + 60 * MINUTE, to: closedAt - 60 * MINUTE }),
    ),
  ];

  const base = { id: shiftId, openedAt, closedAt, startingCash: STARTING_CASH };
  const drawer = expectedDrawerCash(base, orders, movements);
  const difference = pick(rng, DRAWER_DIFFERENCES);
  const shift: ShiftRecord = {
    ...base,
    cashierName: cashier.name,
    status: "CLOSED",
    actualCash: drawer.expected + difference,
    expectedCash: drawer.expected,
    cashDifference: difference,
    cashSalesTotal: drawer.cashSales,
    cashInTotal: drawer.cashIn,
    cashOutTotal: drawer.cashOut,
    notes:
      difference === 0
        ? undefined
        : difference < 0
          ? "Selisih kurang, kembalian kemungkinan keliru."
          : "Selisih lebih, dicatat untuk dicek ulang.",
  };
  return { orders, shift, movements };
}

// ---- today --------------------------------------------------------------------------------------

/** Paid orders of the open shift: [source, method] in the order they were placed. */
const PAID_TODAY: readonly PaidShape[] = [
  { source: "pos", method: "tunai" },
  { source: "pos", method: "qris" },
  { source: "waiter", method: "tunai" },
  { source: "pos", method: "kartu-qr" },
  { source: "self-order", method: "qris" },
  { source: "waiter", method: "tunai" },
  { source: "pos", method: "qris" },
  { source: "pos", method: "tunai" },
];

function tableById(id: string): TableRow {
  return DEFAULT_TABLES.find((t) => t.id === id)!;
}

function waiter(id: string): (typeof waiters)[number] {
  return waiters.find((w) => w.id === id)!;
}

/** The live day: an open shift, a few paid orders, and one order in every kitchen status and source. */
function buildToday(rng: Rng, now: number): DayOutput {
  const dayStart = startOfDay(now);
  const shiftId = `shift-${dayKey(dayStart)}`;
  const openedAt = Math.max(dayStart + MINUTE, Math.min(dayStart + 8 * 60 * MINUTE, now - 90 * MINUTE));
  const ago = (minutes: number) => Math.max(openedAt, now - minutes * MINUTE);

  const span = Math.max(0, now - 55 * MINUTE - openedAt);
  const paid = PAID_TODAY.map((shape, i) =>
    makePaidOrder(rng, openedAt + Math.round(span * ((i + 1) / (PAID_TODAY.length + 1))), shiftId, now - 2 * MINUTE, "lunch", shape),
  );

  const active: OrderSpec[] = [
    { createdAt: ago(3), source: "pos", kitchenStatus: "draft", lines: pickLines(rng, "snack"), customerName: "Lia" },
    {
      createdAt: ago(4),
      source: "self-order",
      kitchenStatus: "queued",
      lines: pickLines(rng, "lunch"),
      table: tableById("meja-03"),
      guests: 3,
      customerName: "Pak Wijaya",
    },
    { createdAt: ago(8), source: "pos", kitchenStatus: "preparing", lines: pickLines(rng, "lunch"), customerName: "Andi" },
    {
      createdAt: ago(12),
      source: "waiter",
      kitchenStatus: "preparing",
      lines: pickLines(rng, "lunch"),
      table: tableById("meja-01"),
      guests: 2,
      customerName: "Rina & Teman",
      waiter: waiter("staff-2"),
    },
    {
      createdAt: ago(15),
      source: "self-order",
      kitchenStatus: "preparing",
      lines: pickLines(rng, "lunch"),
      table: tableById("meja-05"),
      guests: 2,
      customerName: "Maya",
      payment: { method: "qris", paidAt: ago(14) },
    },
    {
      createdAt: ago(26),
      source: "waiter",
      kitchenStatus: "ready",
      lines: pickLines(rng, "lunch"),
      table: tableById("meja-04"),
      guests: 4,
      customerName: "Keluarga Hartono",
      waiter: waiter("staff-3"),
    },
    {
      createdAt: ago(48),
      source: "waiter",
      kitchenStatus: "served",
      lines: pickLines(rng, "lunch"),
      table: tableById("meja-02"),
      guests: 4,
      customerName: "Bu Sari",
      waiter: waiter("staff-4"),
    },
  ];

  const movements = [
    openingMovement(shiftId, openedAt),
    expenseMovement(rng, shiftId, 1, { from: openedAt + MINUTE, to: Math.max(openedAt + MINUTE, now - 30 * MINUTE) }),
  ];
  const shift: ShiftRecord = { id: shiftId, openedAt, cashierName: cashier.name, startingCash: STARTING_CASH, status: "OPEN" };
  return { orders: [...paid, ...active.map(makeOrder)], shift, movements };
}

/** Everything the demo starts with, anchored to `now` (the day of `now` is "today"). */
export function buildDemoData(now: number): DemoData {
  const rng = createRng(20240611);
  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => buildClosedDay(rng, dayStartDaysAgo(now, HISTORY_DAYS - i)));
  const today = buildToday(rng, now);
  const all = [...days, today];

  const orders = all
    .flatMap((day) => day.orders)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((order, i) => ({ ...order, no: FIRST_ORDER_NO + i }));
  return {
    products: MENU_SEED,
    categories: DEFAULT_CATEGORIES,
    tables: DEFAULT_TABLES,
    orders,
    shifts: all.map((day) => day.shift),
    cashMovements: all.flatMap((day) => day.movements),
  };
}

/** Writes the demo data into an open Dexie transaction (fresh database or upgrade) and stamps the day it is aligned to. */
export async function writeDemoData(tx: Transaction, now: number): Promise<void> {
  const data = buildDemoData(now);
  await Promise.all([
    tx.table("products").bulkPut(data.products),
    tx.table("categories").bulkPut(data.categories),
    tx.table("tables").bulkPut(data.tables),
    tx.table("orders").bulkPut(data.orders),
    tx.table("shifts").bulkPut(data.shifts),
    tx.table("cash_movements").bulkPut(data.cashMovements),
    tx.table("meta").put({ key: DATA_DAY_KEY, value: startOfDay(now) }),
  ]);
}
