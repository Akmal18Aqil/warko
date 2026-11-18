import { dataSource } from "../data/index";
import { loadPublicMenu } from "../data/public";
import { subscribeSync } from "../lib/syncBus";
import { t } from "../locales/id";
import { startTabPresence } from "../services/tabPresence";
import type { CategoryRow, Snapshot } from "../types/domain";
import { refreshCategories, refreshProducts, refreshTables } from "./catalog";
import { reloadOrders } from "./orders";
import { reloadPricing } from "./pricing";
import { reloadActiveShift, reloadCashMovements } from "./shift";
import { applySnapshot, reloadAllData } from "./snapshot";
import { catalogStore, ordersStore, pricingStore, sessionStore, shiftStore } from "./stores";

const UNREACHABLE = t.state.serverUnreachable;
const LOCAL_FAILED = t.state.localDbFailed;

function connectionMessage(): string {
  return dataSource.kind === "remote" ? UNREACHABLE : LOCAL_FAILED;
}

/** The public page only has a menu: categories are derived from the products that exist. */
function categoriesFromProducts(products: Snapshot["products"]): CategoryRow[] {
  return [
    ...new Map(
      products.map((product, index) => [
        product.category,
        { id: product.category, name: product.category, kind: product.kind, sortOrder: index, createdAt: 0 },
      ]),
    ).values(),
  ];
}

async function loadPublic(isActive: () => boolean): Promise<void> {
  const menu = await loadPublicMenu();
  if (!isActive()) return;
  pricingStore.set({ pricing: menu.pricing });
  catalogStore.set({ products: menu.products, tables: menu.tables, categories: categoriesFromProducts(menu.products) });
  ordersStore.set({ orders: [] });
  shiftStore.set({ activeShift: null, cashShiftOpen: false, cashMovements: [] });
}

async function loadStaff(isActive: () => boolean): Promise<void> {
  await dataSource.init();
  const snapshot = await dataSource.loadSnapshot();
  if (isActive()) applySnapshot(snapshot);
}

function logFailure(what: string) {
  return (error: unknown) => console.warn(`Gagal menyegarkan ${what}:`, error);
}

/** Other tabs in this browser changed something: reload just that slice. */
function subscribeTabEvents(): () => void {
  return subscribeSync((msg) => {
    switch (msg.type) {
      case "ORDER_CREATED":
      case "ORDER_STATUS_CHANGED":
        void reloadOrders().catch(logFailure("pesanan"));
        break;
      case "TABLE_UPDATED":
        void refreshTables().catch(logFailure("meja"));
        break;
      case "PRODUCTS_UPDATED":
        void refreshProducts().catch(logFailure("produk"));
        break;
      case "CATEGORIES_UPDATED":
        void Promise.all([refreshCategories(), refreshProducts()]).catch(logFailure("kategori"));
        break;
      case "SHIFT_CHANGED":
        void reloadActiveShift().catch(logFailure("shift"));
        break;
      case "CASH_MOVEMENTS_CHANGED":
        void reloadCashMovements().catch(logFailure("mutasi kas"));
        break;
      case "PRICING_UPDATED":
        void reloadPricing().catch(logFailure("pengaturan harga"));
        break;
      case "DATA_IMPORTED":
        void reloadAllData().catch(logFailure("data impor"));
        break;
      case "DEMO_RESET":
        // The other tab deleted the database; this tab must reopen it from scratch.
        window.location.reload();
        break;
      case "DEVICE_HEARTBEAT":
      case "AUTH_CHANGED": // handled by the sign-in gate
        break;
    }
  });
}

/**
 * Loads data, then keeps it fresh: other tabs through the sync bus, other devices through the data
 * source's `watch` (remote only). Returns a function that stops everything.
 */
export function startDataSync(publicCustomer: boolean): () => void {
  let alive = true;
  sessionStore.set({ ready: false, dataSourceError: null, publicCustomer });
  // Never show the previous session's data (another staff member, or the staff app vs. public menu).
  catalogStore.set({ products: [], categories: [], tables: [] });
  ordersStore.set({ orders: [] });
  shiftStore.set({ activeShift: null, cashShiftOpen: false, cashMovements: [] });

  void (async () => {
    try {
      await (publicCustomer ? loadPublic(() => alive) : loadStaff(() => alive));
      if (alive) sessionStore.set({ dataSourceError: null });
    } catch (error) {
      console.error(error);
      if (!alive) return;
      catalogStore.set({ products: [] });
      ordersStore.set({ orders: [] });
      sessionStore.set({ dataSourceError: connectionMessage() });
    } finally {
      if (alive) sessionStore.set({ ready: true });
    }
  })();

  if (publicCustomer) {
    return () => {
      alive = false;
    };
  }

  const stopTabEvents = subscribeTabEvents();
  const stopPresence = startTabPresence();
  const stopWatching = dataSource.watch?.({
    onSnapshot: (snapshot) => {
      if (alive) applySnapshot(snapshot);
    },
    onHealthy: () => {
      if (alive) sessionStore.set({ dataSourceError: null });
    },
    onError: () => {
      if (alive) sessionStore.set({ dataSourceError: UNREACHABLE });
    },
  });

  return () => {
    alive = false;
    stopWatching?.();
    stopPresence();
    stopTabEvents();
  };
}
