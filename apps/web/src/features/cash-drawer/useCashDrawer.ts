import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { expectedDrawerCash, type DrawerCash } from "../../lib/cash";
import { t } from "../../locales/id";
import { useOrders } from "../../state/orders";
import { loadShiftHistory, useActiveShift, useCashMovements } from "../../state/shift";
import type { CashMovementRow, ShiftRecord } from "../../types/domain";
import { errorMessage } from "./format";

export type ShiftFigures = DrawerCash & {
  /** Paid, non-cash sales inside the shift window. */
  nonCashSales: number;
};

interface CashDrawerData {
  activeShift: ShiftRecord | null;
  movements: readonly CashMovementRow[];
  /** Reconciliation figures of the open shift; `null` while no shift is open. */
  figures: ShiftFigures | null;
  history: readonly ShiftRecord[];
}

/** Live shift, movements and reconciliation figures, plus the stored shift history (reloaded whenever the open shift changes). */
export function useCashDrawer(): CashDrawerData {
  const activeShift = useActiveShift();
  const orders = useOrders();
  const movements = useCashMovements();
  const [history, setHistory] = useState<readonly ShiftRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadShiftHistory().then(
      (list) => {
        if (!cancelled) setHistory(list);
      },
      (error: unknown) => {
        if (!cancelled) toast.error(errorMessage(error, t.cashDrawer.toast.historyFailed));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [activeShift]);

  const figures = useMemo<ShiftFigures | null>(() => {
    if (!activeShift) return null;
    const drawer = expectedDrawerCash(activeShift, orders, movements);
    const nonCashSales = drawer.paidOrders.filter((o) => o.method !== "tunai").reduce((sum, o) => sum + o.total, 0);
    return { ...drawer, nonCashSales };
  }, [activeShift, orders, movements]);

  return { activeShift, movements, figures, history };
}
