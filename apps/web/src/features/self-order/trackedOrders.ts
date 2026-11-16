import { STORAGE_KEYS } from "../../lib/storageKeys";

/** Orders this device placed: the key is the secret that unlocks status and e-receipt. */
export type TrackedOrder = { no: number; key: string; tableId: string; createdAt: number };

const TRACK_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_TRACKED = 10;

export function readTracked(): TrackedOrder[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS.selfOrders) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter(
      (entry): entry is TrackedOrder =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.no === "number" &&
        typeof entry.key === "string" &&
        typeof entry.tableId === "string" &&
        typeof entry.createdAt === "number" &&
        now - entry.createdAt < TRACK_TTL_MS,
    );
  } catch {
    return [];
  }
}

export function writeTracked(list: TrackedOrder[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.selfOrders, JSON.stringify(list.slice(0, MAX_TRACKED)));
  } catch {
    // Storage can be full or blocked; the order is still placed, only the status shortcut is lost.
  }
}
