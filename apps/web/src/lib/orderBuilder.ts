import type { KitchenStatus, OrderSource, OrderType, PayMethod } from "@wakro/shared";
import type { MenuItem } from "../data/menu";
import type { CartLine, OrderItemLine, OrderRow, OrderTotals, TableRow } from "../types/domain";
import { legacyStatusFor } from "./orderStatus";

export type OrderMeta = {
  source: OrderSource;
  orderType: OrderType;
  /** Required for dine-in orders. */
  table?: TableRow;
  guests?: number;
  customerName?: string;
  waiterId?: string;
  waiterName?: string;
  /** Set when the order is paid at creation. */
  method?: PayMethod;
  paymentChoice: "paid-now" | "pay-later";
  kitchenStatus?: KitchenStatus;
};

/** Snapshot of the lines with the name and price they were sold at. */
export function orderItems(lines: readonly CartLine[], products: readonly MenuItem[]): OrderItemLine[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return lines.map((l) => {
    const product = byId.get(l.itemId);
    return { itemId: l.itemId, name: product?.name ?? "Produk", qty: l.qty, price: product?.price ?? 0, note: l.note };
  });
}

/**
 * The single place an `OrderRow` is assembled before it is submitted. The data source assigns the
 * order number and, on the server, re-prices and sets payment fields; `total` is what the customer saw.
 */
export function buildOrderRow(lines: readonly CartLine[], products: readonly MenuItem[], totals: OrderTotals, meta: OrderMeta): OrderRow {
  const paid = meta.paymentChoice === "paid-now";
  const kitchenStatus = meta.kitchenStatus ?? "queued";
  const dineIn = meta.orderType === "meja";
  return {
    no: 0,
    status: legacyStatusFor(kitchenStatus),
    paymentStatus: paid ? "paid" : "unpaid",
    kitchenStatus,
    total: totals.total,
    subtotal: totals.subtotal,
    tax: totals.tax,
    discount: totals.discountAmount,
    serviceCharge: totals.serviceCharge,
    itemCount: totals.count,
    items: orderItems(lines, products),
    method: meta.method,
    orderType: meta.orderType,
    tableId: dineIn ? meta.table?.id : undefined,
    tableName: dineIn ? meta.table?.name : undefined,
    tableArea: dineIn ? meta.table?.area : undefined,
    guests: dineIn ? meta.guests : undefined,
    customerName: meta.customerName,
    waiterId: meta.waiterId,
    waiterName: meta.waiterName,
    source: meta.source,
    paymentChoice: meta.paymentChoice,
    createdAt: Date.now(),
  };
}
