import type { OrderType, PayMethod } from "@wakro/shared";
import { useMemo } from "react";
import { toast } from "sonner";
import { RemoteDataError } from "../data/index";
import { addLine, decreaseLine, increaseLine, removeLine, setLineNote, stockLimitMessage } from "../lib/cart";
import { buildOrderRow } from "../lib/orderBuilder";
import { newClientRef } from "../lib/orderStatus";
import { computeTotals, NO_DISCOUNT } from "../lib/pricing";
import { t } from "../locales/id";
import type { CartDiscount, CartLine, OrderRow, TableRow } from "../types/domain";
import { useProducts, useTables } from "./catalog";
import { persistNewOrder } from "./orders";
import { usePricing } from "./pricing";
import { useStore } from "./store";
import { type CartEntry, cartStore, catalogStore, pricingStore } from "./stores";

const EMPTY_CART: CartEntry = { lines: [], discount: NO_DISCOUNT };

type CartSelection = { orderType: OrderType; tableId: string | null };

function cartKeyOf({ orderType, tableId }: CartSelection): string {
  return orderType === "bawa-pulang" ? "takeaway" : `table-${tableId ?? "none"}`;
}

function activeEntry(): CartEntry {
  const state = cartStore.get();
  return state.carts[cartKeyOf(state)] ?? EMPTY_CART;
}

function updateActiveCart(update: (entry: CartEntry) => CartEntry): void {
  cartStore.set((state) => {
    const key = cartKeyOf(state);
    return { carts: { ...state.carts, [key]: update(state.carts[key] ?? EMPTY_CART) } };
  });
}

function updateLines(update: (lines: CartLine[]) => CartLine[]): void {
  updateActiveCart((entry) => ({ ...entry, lines: update(entry.lines) }));
}

/** The cashier cart: selection, lines and discount of the active cart, with live totals. */
export function useCart() {
  const state = useStore(cartStore, (s) => s);
  const products = useProducts();
  const tables = useTables();
  const pricing = usePricing();

  return useMemo(() => {
    const entry = state.carts[cartKeyOf(state)] ?? EMPTY_CART;
    return {
      orderType: state.orderType,
      tableId: state.tableId,
      guests: state.guests,
      selectedTable: tables.find((t) => t.id === state.tableId) ?? null,
      lines: entry.lines,
      discountType: entry.discount.type,
      discountValue: entry.discount.value,
      totals: computeTotals(entry.lines, products, entry.discount, pricing),
    };
  }, [state, products, tables, pricing]);
}

export const setOrderType = (orderType: OrderType) => cartStore.set({ orderType });
export const setGuests = (guests: number) => cartStore.set({ guests });

export function selectTable(table: TableRow): void {
  cartStore.set({ orderType: "meja", tableId: table.id, guests: table.seats });
}

export function setDiscount(type: CartDiscount["type"], value: number): void {
  updateActiveCart((entry) => ({ ...entry, discount: { type, value } }));
}

function blockedByStock(itemId: string): boolean {
  const message = stockLimitMessage(activeEntry().lines, catalogStore.get().products, itemId);
  if (message === null) return false;
  toast.error(message);
  return true;
}

export function addItem(itemId: string): void {
  if (!blockedByStock(itemId)) updateLines((lines) => addLine(lines, itemId));
}

export function increaseItem(itemId: string): void {
  if (!blockedByStock(itemId)) updateLines((lines) => increaseLine(lines, itemId));
}

export const decreaseItem = (itemId: string) => updateLines((lines) => decreaseLine(lines, itemId));
export const removeItem = (itemId: string) => updateLines((lines) => removeLine(lines, itemId));
export const setItemNote = (itemId: string, note: string) => updateLines((lines) => setLineNote(lines, itemId, note));

export function clearCart(): void {
  updateActiveCart(() => EMPTY_CART);
}

// ---- submit ---------------------------------------------------------------------------------

let submitting = false;
/**
 * Idempotency key per cart, kept until the server definitively answers. A submit that timed out
 * is retried with the same key, so a request that actually succeeded is not stored twice.
 */
const pendingRefs = new Map<string, string>();

async function withClientRef<T>(key: string, run: (clientRef: string) => Promise<T>): Promise<T> {
  const clientRef = pendingRefs.get(key) ?? newClientRef();
  pendingRefs.set(key, clientRef);
  try {
    const result = await run(clientRef);
    pendingRefs.delete(key);
    return result;
  } catch (error) {
    // Keep the key only when the outcome is unknown (no HTTP answer); any server answer is final.
    if (!(error instanceof RemoteDataError) || error.status !== undefined) pendingRefs.delete(key);
    throw error;
  }
}

async function recordOrder(payment: { method: PayMethod; cashReceived?: number } | null): Promise<OrderRow> {
  if (submitting) throw new Error(t.state.orderStillProcessing);
  const state = cartStore.get();
  const cartKey = cartKeyOf(state);
  const { lines, discount } = activeEntry();
  const { products, tables } = catalogStore.get();
  const table = tables.find((t) => t.id === state.tableId);
  if (lines.length === 0) throw new Error(t.state.cartEmpty);
  if (state.orderType === "meja" && !table) throw new Error(t.state.pickTableFirst);

  submitting = true;
  try {
    const totals = computeTotals(lines, products, discount, pricingStore.get().pricing);
    const row = buildOrderRow(lines, products, totals, {
      source: "pos",
      orderType: state.orderType,
      table,
      guests: state.guests,
      method: payment?.method,
      paymentChoice: payment ? "paid-now" : "pay-later",
    });
    const saved = await withClientRef(`pos:${cartKey}`, (clientRef) =>
      persistNewOrder(row, { clientRef, cashReceived: payment?.cashReceived }),
    );
    cartStore.set((s) => ({ carts: { ...s.carts, [cartKey]: EMPTY_CART } }));
    return saved;
  } finally {
    submitting = false;
  }
}

/** Sends the cart to the kitchen unpaid; returns the order number. */
export async function saveDraft(): Promise<number> {
  return (await recordOrder(null)).no;
}

type PayResult = { order: OrderRow; change: number | null };

export async function payOrder(method: PayMethod, cashReceived?: number): Promise<PayResult> {
  const order = await recordOrder({ method, cashReceived });
  const change = method === "tunai" && cashReceived !== undefined ? Math.max(0, cashReceived - order.total) : null;
  return { order, change };
}
