import type { KitchenStatus, OrderStatus, PaymentStatus } from "@wakro/shared";
import type { OrderRow, TableRow } from "../types/domain";

/**
 * Orders carry two independent lifecycles. Payment (`paymentStatus`) and kitchen progress
 * (`kitchenStatus`) are always read through these helpers; the legacy `status` field is only a
 * fallback for very old local rows that predate the split and never decides whether an order is paid.
 */

export function kitchenStatusOf(order: Pick<OrderRow, "kitchenStatus" | "status">): KitchenStatus {
  if (order.kitchenStatus) return order.kitchenStatus;
  switch (order.status) {
    case "disimpan":
      return "draft";
    case "memasak":
      return "preparing";
    case "siap":
      return "ready";
    case "sudah-dibayar":
      return "served";
  }
}

export function paymentStatusOf(order: Pick<OrderRow, "paymentStatus" | "paidAt">): PaymentStatus {
  if (order.paymentStatus) return order.paymentStatus;
  return order.paidAt ? "paid" : "unpaid";
}

export function isPaid(order: Pick<OrderRow, "paymentStatus" | "paidAt">): boolean {
  return paymentStatusOf(order) === "paid";
}

/** Legacy status column value kept in sync for older readers and the D1 CHECK constraint. */
export function legacyStatusFor(kitchen: KitchenStatus): OrderStatus {
  switch (kitchen) {
    case "draft":
      return "disimpan";
    case "queued":
    case "preparing":
      return "memasak";
    case "ready":
      return "siap";
    case "served":
      return "sudah-dibayar";
  }
}

/** Whether `staff` is the waiter who took this order. Matches by id only; names are not unique. */
export function isHandledBy(order: Pick<OrderRow, "waiterId">, staff: { id: string }): boolean {
  return order.waiterId !== undefined && order.waiterId === staff.id;
}

function isToday(ts?: number): boolean {
  if (!ts) return false;
  return new Date(ts).toDateString() === new Date().toDateString();
}

/** Revenue of orders paid today. */
export function salesToday(orders: readonly OrderRow[]): number {
  return orders.filter((o) => isPaid(o) && isToday(o.paidAt)).reduce((sum, o) => sum + o.total, 0);
}

/** Kitchen tickets still in progress (shown on the KDS). */
export function isKitchenActive(order: OrderRow): boolean {
  const k = kitchenStatusOf(order);
  return k === "queued" || k === "preparing" || k === "ready";
}

export const KITCHEN_LABEL: Record<KitchenStatus, string> = {
  draft: "Draf",
  queued: "Diterima Dapur",
  preparing: "Sedang Dimasak",
  ready: "Siap Diantar",
  served: "Sudah Diantar",
};

export const NEXT_KITCHEN_STATUS: Partial<Record<KitchenStatus, KitchenStatus>> = {
  draft: "queued",
  queued: "preparing",
  preparing: "ready",
  ready: "served",
};

/**
 * A table is occupied while any of its orders is still being prepared/served or not yet paid.
 * Orders are matched by stable `tableId`; name matching is only a fallback for rows saved before
 * table ids were recorded.
 */
export function ordersForTable(orders: OrderRow[], table: TableRow): OrderRow[] {
  return orders.filter(
    (o) => o.orderType === "meja" && (o.tableId ? o.tableId === table.id : o.tableName === table.name),
  );
}

export function isOrderOpen(order: OrderRow): boolean {
  if (paymentStatusOf(order) === "refunded") return false;
  return kitchenStatusOf(order) !== "served" || !isPaid(order);
}

export function openOrdersForTable(orders: OrderRow[], table: TableRow): OrderRow[] {
  return ordersForTable(orders, table).filter(isOrderOpen);
}

export function tableLabel(order: Pick<OrderRow, "orderType" | "tableName" | "tableArea">): string {
  if (order.orderType !== "meja") return "Takeaway";
  const name = order.tableName ?? "Meja";
  return order.tableArea ? `${name} · ${order.tableArea}` : name;
}

/** Floors in display order: the WAKRO defaults first, then any custom area names. */
export function floorsOf(tables: TableRow[]): string[] {
  const preferred = ["Lantai 1", "Lantai 2", "Rooftop"];
  const names = [...new Set(tables.map((t) => t.area))];
  return names.sort((a, b) => {
    const ia = preferred.indexOf(a);
    const ib = preferred.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

export function runningOrdersCount(orders: readonly OrderRow[]): number {
  return orders.filter(isKitchenActive).length;
}

/** Random URL-safe idempotency key (≥128 bits) for one submit attempt. */
export function newClientRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
