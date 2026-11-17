import type { CashMovementRow, OrderRow, ShiftRecord } from "../types/domain";
import { isPaid } from "./orderStatus";

export type DrawerCash = {
  /** Cash that should be in the drawer. */
  expected: number;
  /** Total of paid cash orders recorded against this shift. */
  cashSales: number;
  /** Paid orders (any method) inside the shift time window, for display. */
  paidOrders: OrderRow[];
  cashIn: number;
  cashOut: number;
};

type ShiftWindow = Pick<ShiftRecord, "id" | "openedAt" | "closedAt" | "startingCash">;

/**
 * The reconciliation rule used everywhere (cash drawer page, settings, and the local data source
 * that closes a shift; the API applies the same formula):
 * `startingCash + cash sales + cash in - cash out` (cash in excludes `modal_awal`), where cash sales are paid cash
 * orders whose `cashShiftId` is this shift and movements are the ones recorded against this shift.
 */
export function expectedDrawerCash(shift: ShiftWindow, orders: readonly OrderRow[], movements: readonly CashMovementRow[]): DrawerCash {
  const end = shift.closedAt ?? Number.POSITIVE_INFINITY;
  const paidOrders = orders.filter((o) => isPaid(o) && o.paidAt !== undefined && o.paidAt >= shift.openedAt && o.paidAt <= end);
  const cashSales = orders
    .filter((o) => isPaid(o) && o.method === "tunai" && o.cashShiftId === shift.id)
    .reduce((sum, o) => sum + o.total, 0);
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

const NOTE_STEPS = [5_000, 10_000, 20_000, 50_000, 100_000];

/**
 * Amounts a customer is likely to hand over for a bill of `amount`, ascending: the exact sum, the bill
 * rounded up to each common note, and always one Rp 100.000 multiple above it.
 */
export function cashSuggestions(amount: number): number[] {
  if (amount <= 0) return [];
  const values = new Set([amount, (Math.floor(amount / 100_000) + 1) * 100_000]);
  for (const step of NOTE_STEPS) values.add(Math.ceil(amount / step) * step);
  return [...values].sort((a, b) => a - b);
}
