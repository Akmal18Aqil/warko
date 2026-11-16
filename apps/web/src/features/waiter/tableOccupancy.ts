import { openOrdersForTable } from "../../lib/orderStatus";
import { t } from "../../locales/id";
import type { OrderRow, TableRow } from "../../types/domain";

/** The most recent open order of each table, keyed by table id. */
export function latestOpenOrderByTable(orders: OrderRow[], tables: TableRow[]): Map<string, OrderRow> {
  const map = new Map<string, OrderRow>();
  for (const table of tables) {
    const open = openOrdersForTable(orders, table);
    if (open.length > 0)
      map.set(
        table.id,
        open.reduce((a, b) => (b.createdAt > a.createdAt ? b : a)),
      );
  }
  return map;
}

/** First name of the waiter handling an order, or the guest fallback when the order has no waiter. */
export function waiterFirstName(order: Pick<OrderRow, "waiterName">): string {
  return order.waiterName?.split(" ")[0] || t.waiter.guestFallback;
}
