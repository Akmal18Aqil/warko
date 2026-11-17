import { DEFAULT_PRICING, type OrderType, type PricingSettings } from "@wakro/shared";
import type { MenuItem } from "../data/menu";
import { STORAGE_KEYS } from "../lib/storageKeys";
import type { CartDiscount, CartLine, CashMovementRow, CategoryRow, OrderRow, ShiftRecord, TableRow } from "../types/domain";
import { createStore } from "./store";

/** Connection / bootstrap state. */
export const sessionStore = createStore({
  ready: false,
  dataSourceError: null as string | null,
  /** Signed-out customer on a `/order` page (remote mode): reads the public menu instead of the staff snapshot. */
  publicCustomer: false,
});

export const catalogStore = createStore({
  products: [] as MenuItem[],
  categories: [] as CategoryRow[],
  tables: [] as TableRow[],
});

export const ordersStore = createStore({
  orders: [] as OrderRow[],
});

export const shiftStore = createStore({
  activeShift: null as ShiftRecord | null,
  cashShiftOpen: false,
  cashMovements: [] as CashMovementRow[],
});

export const pricingStore = createStore({
  pricing: { ...DEFAULT_PRICING } as PricingSettings,
});

export type CartEntry = { lines: CartLine[]; discount: CartDiscount };

/** The order type this device used last, so a dine-in restaurant does not start every order as takeaway. */
function lastOrderType(): OrderType {
  try {
    return localStorage.getItem(STORAGE_KEYS.posOrderType) === "meja" ? "meja" : "bawa-pulang";
  } catch {
    return "bawa-pulang";
  }
}

/** One cart per table plus one for takeaway; each keeps its own lines and discount. */
export const cartStore = createStore({
  orderType: lastOrderType(),
  /** Selected dine-in table (stable id); null when none is chosen yet. */
  tableId: null as string | null,
  guests: 2,
  carts: {} as Record<string, CartEntry>,
});
