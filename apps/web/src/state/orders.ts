import type { KitchenStatus, PayMethod } from "@wakro/shared";
import { dataSource } from "../data/index";
import { createPublicOrder } from "../data/public";
import { computeTotals, NO_DISCOUNT } from "../lib/pricing";
import { buildOrderRow } from "../lib/orderBuilder";
import { broadcastSync } from "../lib/syncBus";
import type { CartLine, OrderRow, OrderSubmitOptions, SettleResult } from "../types/domain";
import { refreshProductsAfterOrder } from "./catalog";
import { resyncAfterConflict } from "./conflict";
import { useStore } from "./store";
import { catalogStore, ordersStore, pricingStore, sessionStore } from "./stores";
import { t } from "../locales/id";

export const useOrders = () => useStore(ordersStore, (s) => s.orders);

/** Preview of the next order number; the data source assigns the real one. */
export const useNextOrderNo = () => useStore(ordersStore, (s) => s.orders.reduce((max, o) => Math.max(max, o.no), 0) + 1);

function upsertOrder(order: OrderRow): void {
  ordersStore.set((s) => ({ orders: [order, ...s.orders.filter((o) => o.no !== order.no)] }));
}

export async function reloadOrders(): Promise<void> {
  ordersStore.set({ orders: await dataSource.loadOrders() });
}

/**
 * Submits a new order and brings local state up to date: order list, other tabs, stock badges.
 * A 409 (stale prices) triggers a resync before the error is rethrown.
 */
export async function persistNewOrder(row: OrderRow, options: OrderSubmitOptions): Promise<OrderRow> {
  try {
    const saved = await dataSource.saveOrder(row, options);
    upsertOrder(saved);
    broadcastSync({ type: "ORDER_CREATED", payload: { order: saved } });
    void refreshProductsAfterOrder();
    return saved;
  } catch (error) {
    await resyncAfterConflict(error);
    throw error;
  }
}

function tableById(id: string) {
  const table = catalogStore.get().tables.find((t) => t.id === id);
  if (!table) throw new Error(t.state.tableNotFound);
  return table;
}

type SelfOrderInput = {
  tableId: string;
  customerName: string;
  lines: CartLine[];
  /** Random key kept by the customer: idempotent submit + status / e-receipt access. */
  clientRef: string;
  /** Local demo only: "paid-now" simulates a QRIS payment. Remote self-orders are always pay-later. */
  paymentChoice: "paid-now" | "pay-later";
  expectedTotal?: number;
};

export async function createSelfOrder(input: SelfOrderInput): Promise<OrderRow> {
  if (input.lines.length === 0) throw new Error(t.state.cartEmpty);
  const { products } = catalogStore.get();
  const totals = computeTotals(input.lines, products, NO_DISCOUNT, pricingStore.get().pricing);

  if (sessionStore.get().publicCustomer) {
    if (input.paymentChoice !== "pay-later") {
      throw new Error(t.state.publicPayLater);
    }
    try {
      const created = await createPublicOrder({
        tableId: input.tableId,
        customerName: input.customerName,
        items: input.lines.map((line) => ({ itemId: line.itemId, qty: line.qty, note: line.note })),
        expectedTotal: input.expectedTotal ?? totals.total,
        clientRef: input.clientRef,
      });
      upsertOrder(created);
      void refreshProductsAfterOrder();
      return created;
    } catch (error) {
      await resyncAfterConflict(error);
      throw error;
    }
  }

  const paid = input.paymentChoice === "paid-now";
  const row = buildOrderRow(input.lines, products, totals, {
    source: "self-order",
    orderType: "meja",
    table: tableById(input.tableId),
    customerName: input.customerName.trim() || t.state.defaultCustomer,
    method: paid ? "qris" : undefined,
    paymentChoice: input.paymentChoice,
  });
  return persistNewOrder(row, { clientRef: input.clientRef });
}

type WaiterOrderInput = {
  tableId: string;
  customerName?: string;
  lines: CartLine[];
  guests?: number;
  /** Local mode only; the server records the signed-in staff member as the waiter. */
  waiterId?: string;
  waiterName?: string;
  /** Set when the waiter collected the payment at the table. */
  method?: PayMethod;
  cashReceived?: number;
  clientRef: string;
};

export async function createWaiterOrder(input: WaiterOrderInput): Promise<OrderRow> {
  if (input.lines.length === 0) throw new Error(t.state.cartEmpty);
  const table = tableById(input.tableId);
  const { products } = catalogStore.get();
  const totals = computeTotals(input.lines, products, NO_DISCOUNT, pricingStore.get().pricing);
  const row = buildOrderRow(input.lines, products, totals, {
    source: "waiter",
    orderType: "meja",
    table,
    guests: input.guests || 2,
    customerName: input.customerName?.trim() || t.state.defaultGuest,
    waiterId: input.waiterId,
    waiterName: input.waiterName,
    method: input.method,
    paymentChoice: input.method !== undefined ? "paid-now" : "pay-later",
  });
  return persistNewOrder(row, { clientRef: input.clientRef, cashReceived: input.cashReceived });
}

type SettleOutcome = SettleResult & { change: number | null };

/** Settles an existing unpaid order (self-order / waiter order paid at the register). */
export async function settleOrder(
  no: number,
  method: PayMethod,
  paidBy: string,
  cashReceived?: number,
): Promise<SettleOutcome> {
  const result = await dataSource.settleOrder(no, method, paidBy, cashReceived);
  upsertOrder(result.order);
  broadcastSync({ type: "ORDER_STATUS_CHANGED", payload: { no } });
  const received = result.order.cashReceived ?? cashReceived;
  const change = result.order.method === "tunai" && received !== undefined ? Math.max(0, received - result.order.total) : null;
  return { ...result, change };
}

export async function updateKitchenStatus(no: number, kitchenStatus: KitchenStatus): Promise<void> {
  const updated = await dataSource.updateKitchenStatus(no, kitchenStatus);
  ordersStore.set((s) => ({ orders: s.orders.map((o) => (o.no === no ? { ...o, ...updated } : o)) }));
  broadcastSync({ type: "ORDER_STATUS_CHANGED", payload: { no, kitchenStatus } });
}
