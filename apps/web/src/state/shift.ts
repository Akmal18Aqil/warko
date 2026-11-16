import type { CashMovementCategory, CashMovementType } from "@wakro/shared";
import { dataSource } from "../data/index";
import { broadcastSync } from "../lib/syncBus";
import type { CashMovementRow, ShiftRecord } from "../types/domain";
import { useStore } from "./store";
import { shiftStore } from "./stores";
import { t } from "../locales/id";

export const useActiveShift = () => useStore(shiftStore, (s) => s.activeShift);
export const useCashMovements = () => useStore(shiftStore, (s) => s.cashMovements);

export async function reloadActiveShift(): Promise<void> {
  shiftStore.set({ activeShift: (await dataSource.loadActiveShift()) ?? null });
}

export async function reloadCashMovements(): Promise<void> {
  shiftStore.set({ cashMovements: await dataSource.loadCashMovements() });
}

/** Shifts, newest first, for the history table. */
export function loadShiftHistory(): Promise<ShiftRecord[]> {
  return dataSource.loadShiftHistory();
}

/** Opens a shift and returns the stored record (remote: the server sets `cashierName` from the session). */
export async function openShift(cashierName: string, startingCash: number): Promise<ShiftRecord> {
  const saved = await dataSource.saveShift({
    id: `shift-${Date.now()}`,
    openedAt: Date.now(),
    cashierName,
    startingCash,
    status: "OPEN",
  });
  shiftStore.set({ activeShift: saved });
  broadcastSync({ type: "SHIFT_CHANGED", payload: { shift: saved } });
  return saved;
}

/** Closes the open shift. The data source computes expected cash and the difference; the stored record is returned. */
export async function closeShift(
  actualCash: number,
  notes?: string,
  denominations?: Record<string, number>,
): Promise<ShiftRecord> {
  const { activeShift } = shiftStore.get();
  if (!activeShift) throw new Error(t.state.noActiveShift);
  const closed = await dataSource.saveShift({
    id: activeShift.id,
    openedAt: activeShift.openedAt,
    cashierName: activeShift.cashierName,
    startingCash: activeShift.startingCash,
    closedAt: Date.now(),
    actualCash,
    denominations,
    status: "CLOSED",
    notes,
  });
  shiftStore.set({ activeShift: null });
  broadcastSync({ type: "SHIFT_CHANGED", payload: { shift: closed } });
  return closed;
}

type CashMovementInput = {
  type: CashMovementType;
  category: CashMovementCategory;
  amount: number;
  description: string;
  /** Recorded by the local source only; the server uses the signed-in staff member. */
  cashierName: string;
};

export async function addCashMovement(input: CashMovementInput): Promise<CashMovementRow> {
  const saved = await dataSource.saveCashMovement({
    id: `mov-${Date.now()}`,
    shiftId: shiftStore.get().activeShift?.id,
    type: input.type,
    category: input.category,
    amount: input.amount,
    description: input.description,
    cashierName: input.cashierName,
    createdAt: Date.now(),
  });
  shiftStore.set((s) => ({ cashMovements: [saved, ...s.cashMovements] }));
  broadcastSync({ type: "CASH_MOVEMENTS_CHANGED" });
  return saved;
}

export async function deleteCashMovement(id: string): Promise<void> {
  await dataSource.deleteCashMovement(id);
  shiftStore.set((s) => ({ cashMovements: s.cashMovements.filter((m) => m.id !== id) }));
  broadcastSync({ type: "CASH_MOVEMENTS_CHANGED" });
}
