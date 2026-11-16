import { STORAGE_KEYS } from "../../lib/storageKeys";
import type { CartLine } from "../../types/domain";

/** A submitted self-order whose outcome is unknown (the response was lost); re-sent with the same key. */
export type PendingOrder = {
  tableId: string;
  customerName: string;
  lines: CartLine[];
  clientRef: string;
  paymentChoice: "pay-later";
  expectedTotal: number;
};

export function readPendingOrder(storage: Storage): PendingOrder | null {
  const raw = storage.getItem(STORAGE_KEYS.selfPendingOrder);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const item = value as Partial<PendingOrder>;
    if (typeof item.tableId !== "string" || !item.tableId || typeof item.customerName !== "string" ||
        typeof item.clientRef !== "string" || !/^[A-Za-z0-9_-]{22,100}$/.test(item.clientRef) ||
        item.paymentChoice !== "pay-later" || !Number.isSafeInteger(item.expectedTotal) || (item.expectedTotal ?? -1) < 0 ||
        !Array.isArray(item.lines) || item.lines.length === 0 || !item.lines.every((line) =>
          line && typeof line.itemId === "string" && line.itemId && Number.isSafeInteger(line.qty) && line.qty > 0 &&
          (line.note === undefined || typeof line.note === "string"))) return null;
    return item as PendingOrder;
  } catch {
    return null;
  }
}

/** True when the cart still holds exactly what was submitted (the customer did not edit it meanwhile). */
export function cartUnchanged(submitted: readonly CartLine[], current: readonly CartLine[]): boolean {
  return JSON.stringify(current) === JSON.stringify(submitted);
}
