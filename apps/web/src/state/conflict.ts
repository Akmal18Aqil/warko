import { dataSource, RemoteDataError } from "../data";
import { loadPublicMenu } from "../data/public";
import { catalogStore, pricingStore, sessionStore } from "./stores";

/**
 * After a 409 (stale prices or pricing config) pull the authoritative values so the next attempt
 * shows correct amounts. Any other error is left alone.
 */
export async function resyncAfterConflict(error: unknown): Promise<void> {
  if (!(error instanceof RemoteDataError) || error.status !== 409) return;
  try {
    if (sessionStore.get().publicCustomer) {
      const menu = await loadPublicMenu();
      catalogStore.set({ products: menu.products });
      pricingStore.set({ pricing: menu.pricing });
    } else if (dataSource.kind === "remote") {
      const snapshot = await dataSource.loadSnapshot();
      catalogStore.set({ products: snapshot.products });
      pricingStore.set({ pricing: snapshot.pricing });
    }
  } catch (cause) {
    console.warn("Sinkronisasi setelah konflik gagal:", cause);
  }
}
