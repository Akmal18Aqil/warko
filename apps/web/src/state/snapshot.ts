import { dataSource } from "../data/index";
import type { Snapshot } from "../types/domain";
import { catalogStore, ordersStore, pricingStore, resetCartStore, shiftStore } from "./stores";

/** Writes a snapshot into every slice; slices that did not change keep their identity. */
export function applySnapshot(snapshot: Snapshot): void {
  catalogStore.setIfChanged({
    products: snapshot.products,
    categories: snapshot.categories,
    tables: snapshot.tables,
  });
  ordersStore.setIfChanged({ orders: snapshot.orders });
  shiftStore.setIfChanged({
    activeShift: snapshot.activeShift,
    cashShiftOpen: snapshot.cashShiftOpen,
    cashMovements: snapshot.cashMovements,
  });
  pricingStore.setIfChanged({ pricing: snapshot.pricing });
}

/** Re-reads everything, e.g. after a backup was imported into the browser database. */
export async function reloadAllData(): Promise<void> {
  applySnapshot(await dataSource.loadSnapshot());
}

/**
 * Empties the in-memory staff data and cashier drafts. Run when the signed-in identity changes or ends
 * (switch, lock, revoked session, another tab signing in) so the next person never sees the previous one's data.
 * Per-waiter drafts in browser storage are keyed by staff id and stay with their owner.
 */
export function clearStaffState(): void {
  catalogStore.set({ products: [], categories: [], tables: [] });
  ordersStore.set({ orders: [] });
  shiftStore.set({ activeShift: null, cashShiftOpen: false, cashMovements: [] });
  resetCartStore();
}
