import type { CashMovementRow, OrderRow, ShiftRecord } from "../types/domain";
import { isPaid } from "./orderStatus";

export type DrawerCash = {
  /** Cash that should be in the drawer. */
  expected: number;
  /** Total of paid cash orders whose payment falls inside the shift window. */
  cashSales: number;
  /** Paid orders (any method) inside the shift window. */
  paidOrders: OrderRow[];
  cashIn: number;
  cashOut: number;
};

type ShiftWindow = Pick<ShiftRecord, "id" | "openedAt" | "closedAt" | "startingCash">;

/**
 * The reconciliation rule used everywhere (cash drawer page, settings, and the local data source
 * that closes a shift; the API applies the same formula):
 * `startingCash + cash sales + cash in - cash out` (cash in excludes `modal_awal`), where cash sales are `paidAt` inside
 * `[openedAt, closedAt]` and movements are the ones recorded against this shift.
 */
export function expectedDrawerCash(
  shift: ShiftWindow,
  orders: readonly OrderRow[],
  movements: readonly CashMovementRow[],
): DrawerCash {
  const end = shift.closedAt ?? Number.POSITIVE_INFINITY;
  const paidOrders = orders.filter((o) => isPaid(o) && o.paidAt !== undefined && o.paidAt >= shift.openedAt && o.paidAt <= end);
  const cashSales = paidOrders.filter((o) => o.method === "tunai").reduce((sum, o) => sum + o.total, 0);
  let cashIn = 0;
  let cashOut = 0;
  for (const m of movements) {
    if (m.shiftId !== shift.id) continue;
    // Opening cash is already part of `startingCash`; counting its movement would double it.
    if (m.type === "CASH_OUT") cashOut += m.amount;
    else if (m.category !== "modal_awal") cashIn += m.amount;
  }
  return { cashSales, paidOrders, cashIn, cashOut, expected: shift.startingCash + cashSales + cashIn - cashOut };
}
