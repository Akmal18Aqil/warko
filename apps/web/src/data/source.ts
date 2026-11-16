import type { KitchenStatus, PayMethod, PricingSettings } from "@wakro/shared";
import type {
  CashMovementRow,
  CategoryRow,
  OrderRow,
  OrderSubmitOptions,
  SettleResult,
  ShiftRecord,
  Snapshot,
  StockMode,
  TableRow,
} from "../types/domain";
import type { MenuItem } from "./menu";

export type WatchHandlers = {
  onSnapshot: (snapshot: Snapshot) => void;
  onHealthy: () => void;
  onError: (error: unknown) => void;
};

/**
 * Everything the state layer needs from storage. Exactly one implementation is active for the
 * whole session (`localSource` = IndexedDB demo, `remoteSource` = API Worker), picked once at startup.
 */
export interface DataSource {
  readonly kind: "local" | "remote";

  /** Prepares the backing store (local: opens and seeds IndexedDB). */
  init(): Promise<void>;
  loadSnapshot(): Promise<Snapshot>;
  /**
   * Follows changes made by other devices. Sources without a server omit it; the caller then relies
   * on same-browser tab sync only. `onSnapshot` fires only when something changed; `onHealthy` fires
   * after every successful check (including "nothing changed") so a connection error can clear.
   */
  watch?(handlers: WatchHandlers): () => void;

  loadPricing(): Promise<PricingSettings>;
  savePricing(pricing: PricingSettings): Promise<PricingSettings>;

  loadProducts(): Promise<MenuItem[]>;
  saveProduct(item: MenuItem): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  /** `set` with `null` stops tracking stock; `add` increments tracked stock. */
  adjustStock(item: MenuItem, mode: StockMode, qty: number | null): Promise<MenuItem>;
  findProductByBarcode(code: string): Promise<MenuItem | undefined>;

  loadTables(): Promise<TableRow[]>;
  saveTable(table: TableRow): Promise<void>;
  deleteTable(id: string): Promise<void>;

  loadCategories(): Promise<CategoryRow[]>;
  saveCategory(category: CategoryRow): Promise<void>;
  /** Renaming a category renames it on every product that uses it. */
  updateCategory(id: string, updates: Partial<CategoryRow>, oldName?: string): Promise<void>;
  deleteCategory(id: string, categoryName: string, reassignToCategoryName?: string): Promise<void>;

  loadOrders(): Promise<OrderRow[]>;
  /** Orders created or paid inside [from, to), for reports and exports. All pages are fetched. */
  loadOrdersInRange(from: number, to: number): Promise<OrderRow[]>;
  /**
   * Stores a new order. The number is assigned by the source; ready stock is checked and decremented
   * atomically. Submitting the same `clientRef` twice returns the first order.
   */
  saveOrder(row: OrderRow, options: OrderSubmitOptions): Promise<OrderRow>;
  /** Idempotent: an already-paid order is returned unchanged with `alreadyPaid: true`. */
  settleOrder(no: number, method: PayMethod, paidBy: string, cashReceived?: number): Promise<SettleResult>;
  updateKitchenStatus(no: number, kitchenStatus: KitchenStatus): Promise<OrderRow>;

  loadActiveShift(): Promise<ShiftRecord | undefined>;
  /** Most recent shifts first. */
  loadShiftHistory(): Promise<ShiftRecord[]>;
  /**
   * Opens or closes a shift and returns the stored record. When closing, the source computes the
   * reconciliation totals (expected cash, difference, cash sales/in/out); callers must not send them.
   */
  saveShift(shift: ShiftRecord): Promise<ShiftRecord>;

  loadCashMovements(shiftId?: string): Promise<CashMovementRow[]>;
  saveCashMovement(item: CashMovementRow): Promise<CashMovementRow>;
  deleteCashMovement(id: string): Promise<void>;
}
