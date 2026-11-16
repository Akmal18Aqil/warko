import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { MENU_SEED, type MenuItem } from "../data/menu";
import { resetToDemoSeed } from "../lib/exporters";
import { broadcastSync, subscribeSync } from "../lib/syncBus";
import { useAuth } from "./AuthContext";
import {
  db,
  ensureSeeded,
  DEFAULT_TABLES,
  DEFAULT_CATEGORIES,
  type OrderItemLine,
  type OrderRow,
  type OrderStatus,
  type PaymentStatus,
  type KitchenStatus,
  type OrderType,
  type PayMethod,
  type ShiftRecord,
  type TableRow,
  type CashMovementRow,
  type CashMovementType,
  type CashMovementCategory,
  type CategoryRow,
} from "../lib/db";
import {
  createPublicOrder,
  isPublicCustomer,
  isRemoteDataSource,
  loadPublicMenu,
  loadRemoteSnapshot,
  RemoteDataError,
  saveRemotePricing,
  type PricingSettings,
} from "../lib/remote";
import { isKitchenActive, isPaid, legacyStatusFor, newClientRef } from "../lib/orderStatus";
import {
  deleteProduct as repoDeleteProduct,
  deleteTable as repoDeleteTable,
  loadActiveShift,
  loadOrders,
  loadProducts,
  loadTables,
  loadCashMovements,
  loadCategories,
  saveCashMovement as repoSaveCashMovement,
  deleteCashMovement as repoDeleteCashMovement,
  saveCategory as repoSaveCategory,
  updateCategory as repoUpdateCategory,
  deleteCategory as repoDeleteCategory,
  adjustStock as repoAdjustStock,
  saveOrder,
  settleOrder as repoSettleOrder,
  saveProduct as repoSaveProduct,
  saveShift as repoSaveShift,
  saveTable as repoSaveTable,
  updateKitchenStatus as repoUpdateKitchenStatus,
} from "../lib/repo";

export type {
  OrderType,
  PayMethod,
  OrderStatus,
  PaymentStatus,
  KitchenStatus,
  TableRow,
  ShiftRecord,
  OrderRow,
  CashMovementRow,
  CashMovementType,
  CashMovementCategory,
  CategoryRow,
};
export type CartLine = { itemId: string; qty: number; note?: string };

export type OrderTotals = {
  rawSubtotal: number;
  discountAmount: number;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  count: number;
};

type PayResult = { order: OrderRow; change: number | null };

export type SettleResult = { order: OrderRow; alreadyPaid: boolean; change: number | null };

type PosContextValue = {
  ready: boolean;
  dataSourceError: string | null;
  products: MenuItem[];
  categories: CategoryRow[];
  tables: TableRow[];
  orderNo: number;
  orderType: OrderType;
  /** Selected dine-in table (stable id); null when none is chosen yet. */
  tableId: string | null;
  selectedTable: TableRow | null;
  guests: number;
  lines: CartLine[];
  totals: OrderTotals;
  orders: OrderRow[];
  cashMovements: CashMovementRow[];
  discountType: "percent" | "fixed";
  discountValue: number;
  taxRate: number;
  serviceChargeRate: number;
  taxEnabled: boolean;
  serviceChargeEnabled: boolean;
  activeShift: ShiftRecord | null;
  setOrderType: (t: OrderType) => void;
  setTableId: (id: string) => void;
  setGuests: (n: number) => void;
  setDiscount: (type: "percent" | "fixed", value: number) => void;
  savePricing: (pricing: PricingSettings) => Promise<void>;
  addItem: (itemId: string) => void;
  setItemNote: (itemId: string, note: string) => void;
  increaseLine: (itemId: string) => void;
  decreaseLine: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  clearOrder: () => void;
  saveDraft: () => Promise<number>;
  payOrder: (method: PayMethod, cashReceived?: number) => Promise<PayResult>;
  /** Settles an existing unpaid order (self-order / waiter order paid at the register). */
  settleOrder: (no: number, method: PayMethod, cashReceived?: number) => Promise<SettleResult>;
  createSelfOrder: (input: SelfOrderInput) => Promise<OrderRow>;
  createWaiterOrder: (input: WaiterOrderInput) => Promise<OrderRow>;
  addCashMovement: (input: {
    type: CashMovementType;
    category: CashMovementCategory;
    amount: number;
    description: string;
    cashierName?: string;
  }) => Promise<CashMovementRow>;
  deleteCashMovement: (id: string) => Promise<void>;
  reloadCashMovements: () => Promise<void>;
  triggerOpenDrawer: () => void;
  reloadProducts: () => Promise<void>;
  reloadTables: () => Promise<void>;
  reloadOrders: () => Promise<void>;
  reloadCategories: () => Promise<void>;
  addProduct: (item: MenuItem) => Promise<void>;
  updateProduct: (item: MenuItem) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addCategory: (category: Partial<CategoryRow>) => Promise<CategoryRow>;
  updateCategory: (id: string, updates: Partial<CategoryRow>, oldName?: string) => Promise<void>;
  deleteCategory: (id: string, categoryName: string, reassignToCategoryName?: string) => Promise<void>;
  addTable: (table: TableRow) => Promise<void>;
  updateTable: (table: TableRow) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
  selectTable: (table: TableRow) => void;
  updateKitchenStatus: (no: number, kitchenStatus: KitchenStatus) => Promise<void>;
  adjustStock: (item: MenuItem, mode: "set" | "add", qty: number | null) => Promise<void>;
  openShift: (cashierName: string, startingCash: number) => Promise<void>;
  closeShift: (
    actualCash: number,
    notes?: string,
    denominations?: Record<string, number>,
  ) => Promise<ShiftRecord>;
  resetSeed: () => Promise<void>;
};

export type SelfOrderInput = {
  tableId: string;
  customerName: string;
  lines: CartLine[];
  /** Random key kept by the customer: idempotent submit + status / e-receipt access. */
  clientRef: string;
  /** Local demo only: "paid-now" simulates a QRIS payment. Remote self-orders are always pay-later. */
  paymentChoice: "paid-now" | "pay-later";
};

export type WaiterOrderInput = {
  tableId: string;
  customerName?: string;
  lines: CartLine[];
  guests?: number;
  /** Local mode only; the server records the signed-in staff member as the waiter. */
  waiterId?: string;
  waiterName?: string;
  /** Set when the waiter collected the payment at the table. */
  method?: PayMethod;
  cashReceived?: number;
  clientRef: string;
};

const PosContext = createContext<PosContextValue | null>(null);

const DEFAULT_PRICING: PricingSettings = {
  taxEnabled: true,
  taxRate: 11,
  serviceChargeEnabled: false,
  serviceChargeRate: 5,
};

/** Remote mode takes pricing from the server; local mode keeps the editable localStorage settings. */
function readInitialPricing(): PricingSettings {
  if (isRemoteDataSource) return DEFAULT_PRICING;
  try {
    const taxEnabled = localStorage.getItem("kasa_tax_enabled");
    const taxRate = localStorage.getItem("kasa_tax_rate");
    const serviceChargeEnabled = localStorage.getItem("kasa_service_charge_enabled");
    const serviceChargeRate = localStorage.getItem("kasa_service_charge_rate");
    return {
      taxEnabled: taxEnabled === null ? DEFAULT_PRICING.taxEnabled : taxEnabled === "1",
      taxRate: taxRate ? Number.parseFloat(taxRate) : DEFAULT_PRICING.taxRate,
      serviceChargeEnabled: serviceChargeEnabled === null ? DEFAULT_PRICING.serviceChargeEnabled : serviceChargeEnabled === "1",
      serviceChargeRate: serviceChargeRate ? Number.parseFloat(serviceChargeRate) : DEFAULT_PRICING.serviceChargeRate,
    };
  } catch {
    return DEFAULT_PRICING;
  }
}

function computeTotals(
  lines: CartLine[],
  products: MenuItem[],
  discountType: "percent" | "fixed",
  discountValue: number,
  taxEnabled: boolean,
  taxRate: number,
  serviceChargeEnabled: boolean,
  serviceChargeRate: number,
): OrderTotals {
  let rawSubtotal = 0;
  let count = 0;
  for (const line of lines) {
    const item = products.find((p) => p.id === line.itemId);
    if (!item) continue;
    rawSubtotal += item.price * line.qty;
    count += line.qty;
  }

  let discountAmount = 0;
  if (discountValue > 0) {
    if (discountType === "percent") {
      discountAmount = Math.round(rawSubtotal * (Math.min(100, discountValue) / 100));
    } else {
      discountAmount = Math.min(rawSubtotal, discountValue);
    }
  }

  const subtotal = Math.max(0, rawSubtotal - discountAmount);
  const serviceCharge = serviceChargeEnabled
    ? Math.round((subtotal * serviceChargeRate) / 100)
    : 0;
  const taxableBase = subtotal + serviceCharge;
  const tax = taxEnabled ? Math.round((taxableBase * taxRate) / 100) : 0;
  const total = subtotal + serviceCharge + tax;

  return { rawSubtotal, discountAmount, subtotal, tax, serviceCharge, total, count };
}

function isToday(ts?: number): boolean {
  if (!ts) return false;
  return new Date(ts).toDateString() === new Date().toDateString();
}

export function PosProvider({ children }: { children: ReactNode }) {
  const { currentStaff } = useAuth();
  const cashierNameRef = useRef(currentStaff.name);
  cashierNameRef.current = currentStaff.name;
  const [ready, setReady] = useState(false);
  const [dataSourceError, setDataSourceError] = useState<string | null>(null);
  const [products, setProducts] = useState<MenuItem[]>(MENU_SEED);
  const [categories, setCategories] = useState<CategoryRow[]>(DEFAULT_CATEGORIES);
  const [tables, setTables] = useState<TableRow[]>(DEFAULT_TABLES);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);

  const [orderNo, setOrderNo] = useState(1049);
  const [orderType, setOrderType] = useState<OrderType>("bawa-pulang");
  const [tableId, setTableId] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);

  // Multi-tab carts per table
  const [tableDrafts, setTableDrafts] = useState<Record<string, CartLine[]>>({
    takeaway: [
      { itemId: "kopi-susu", qty: 1, note: "Gula aren sedikit" },
      { itemId: "roti-panggang-isi", qty: 1 },
    ],
  });

  // Discounts & Tax Configs
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [initialPricing] = useState(readInitialPricing);
  const [taxEnabled, setTaxEnabled] = useState<boolean>(initialPricing.taxEnabled);
  const [taxRate, setTaxRate] = useState<number>(initialPricing.taxRate);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState<boolean>(initialPricing.serviceChargeEnabled);
  const [serviceChargeRate, setServiceChargeRate] = useState<number>(initialPricing.serviceChargeRate);
  const savingOrderRef = useRef(false);
  /**
   * Idempotency key per cart, kept until the server definitively answers. A submit that timed out
   * is retried with the same key, so a request that actually succeeded is not stored twice.
   */
  const pendingRefs = useRef(new Map<string, string>());

  const applyPricing = useCallback((pricing: PricingSettings) => {
    setTaxEnabled(pricing.taxEnabled);
    setTaxRate(pricing.taxRate);
    setServiceChargeEnabled(pricing.serviceChargeEnabled);
    setServiceChargeRate(pricing.serviceChargeRate);
  }, []);

  // After a 409 (stale prices/pricing config), pull the authoritative values so the next attempt shows correct amounts.
  const syncAfterConflict = useCallback(
    async (error: unknown) => {
      if (!(error instanceof RemoteDataError) || error.status !== 409) return;
      try {
        if (isPublicCustomer) {
          const menu = await loadPublicMenu();
          setProducts(menu.products);
          applyPricing(menu.pricing);
        } else if (isRemoteDataSource) {
          const snapshot = await loadRemoteSnapshot();
          setProducts(snapshot.products);
          applyPricing(snapshot.pricing);
        }
      } catch {
        // The conflict error remains the surfaced failure.
      }
    },
    [applyPricing],
  );

  const [cashMovements, setCashMovements] = useState<CashMovementRow[]>([]);

  const selectedTable = useMemo(() => tables.find((t) => t.id === tableId) ?? null, [tables, tableId]);
  const activeCartKey = orderType === "bawa-pulang" ? "takeaway" : `table-${tableId ?? "none"}`;
  const lines = tableDrafts[activeCartKey] || [];

  const setLinesForActiveCart = useCallback(
    (updater: (prev: CartLine[]) => CartLine[]) => {
      setTableDrafts((prev) => {
        const current = prev[activeCartKey] || [];
        return {
          ...prev,
          [activeCartKey]: updater(current),
        };
      });
    },
    [activeCartKey],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await ensureSeeded();
        let loadedProducts: MenuItem[];
        let loadedOrders: OrderRow[];
        let loadedTables: TableRow[];
        let shift: ShiftRecord | undefined;
        let loadedMovements: CashMovementRow[];
        let loadedCats: CategoryRow[];

        if (isPublicCustomer) {
          const menu = await loadPublicMenu();
          applyPricing(menu.pricing);
          loadedProducts = menu.products;
          loadedTables = menu.tables;
          loadedOrders = [];
          loadedMovements = [];
          shift = undefined;
          loadedCats = [...new Map(menu.products.map((product, index) => [
            product.category,
            { id: product.category, name: product.category, kind: product.kind, sortOrder: index, createdAt: 0 },
          ])).values()];
        } else if (isRemoteDataSource) {
          const snapshot = await loadRemoteSnapshot();
          applyPricing(snapshot.pricing);
          loadedProducts = snapshot.products;
          loadedOrders = snapshot.orders;
          loadedTables = snapshot.tables;
          loadedCats = snapshot.categories;
          loadedMovements = snapshot.cashMovements;
          shift = snapshot.shifts.find((item) => item.status === "OPEN");
        } else {
          [loadedProducts, loadedOrders, loadedTables, shift, loadedMovements, loadedCats] = await Promise.all([
            loadProducts(),
            loadOrders(),
            loadTables(),
            loadActiveShift(),
            loadCashMovements(),
            loadCategories(),
          ]);
        }

        if (loadedProducts.length === 0 && !isRemoteDataSource) {
          await db.products.bulkPut(MENU_SEED);
          loadedProducts = await loadProducts();
        }
        if (!alive) return;
        setDataSourceError(null);
        setProducts(loadedProducts);
        setCategories(loadedCats);
        setOrders(loadedOrders);
        setTables(loadedTables);
        setCashMovements(loadedMovements);
        setActiveShift(shift || null);
        if (isRemoteDataSource) setTableDrafts({});
        const last = loadedOrders[0]?.no ?? 1048;
        setOrderNo(last + 1);
      } catch (error) {
        console.error(error);
        if (!alive) return;
        if (isRemoteDataSource) {
          setProducts([]);
          setOrders([]);
          setDataSourceError("Server data tidak dapat dijangkau. Periksa koneksi dan masuk kembali.");
        }
      } finally {
        if (alive) setReady(true);
      }
    })();

    const unsubscribe = subscribeSync(async (msg) => {
      if (isPublicCustomer) return;
      if (!alive) return;
      if (msg.type === "ORDER_CREATED" || msg.type === "ORDER_STATUS_CHANGED") {
        const loadedOrders = await loadOrders();
        if (alive) {
          setOrders(loadedOrders);
          const maxNo = loadedOrders.reduce((max, o) => Math.max(max, o.no), 1048);
          setOrderNo((prev) => Math.max(prev, maxNo + 1));
        }
      } else if (msg.type === "TABLE_UPDATED") {
        const loadedTables = await loadTables();
        if (alive) setTables(loadedTables);
      } else if (msg.type === "PRODUCTS_UPDATED") {
        const loadedProducts = await loadProducts();
        if (alive) setProducts(loadedProducts);
      } else if (msg.type === "CATEGORY_CREATED" || msg.type === "CATEGORY_UPDATED" || msg.type === "CATEGORY_DELETED") {
        const [loadedCats, loadedProducts] = await Promise.all([loadCategories(), loadProducts()]);
        if (alive) {
          setCategories(loadedCats);
          setProducts(loadedProducts);
        }
      } else if (msg.type === "SHIFT_CHANGED") {
        const shift = await loadActiveShift();
        if (alive) setActiveShift(shift || null);
      } else if (msg.type === "CASH_MOVEMENT_CREATED" || msg.type === "CASH_MOVEMENT_DELETED") {
        const loadedMovements = await loadCashMovements();
        if (alive) setCashMovements(loadedMovements);
      }
    });

    let refreshing = false;
    const refreshTimer = isRemoteDataSource && !isPublicCustomer ? window.setInterval(() => {
      if (!alive || refreshing || document.hidden) return;
      refreshing = true;
      void loadRemoteSnapshot().then((snapshot) => {
        if (!alive) return;
        setProducts(snapshot.products);
        applyPricing(snapshot.pricing);
        setCategories(snapshot.categories);
        setOrders(snapshot.orders);
        setTables(snapshot.tables);
        setCashMovements(snapshot.cashMovements);
        setActiveShift(snapshot.shifts.find((shift) => shift.status === "OPEN") ?? null);
        setOrderNo((current) => Math.max(current, (snapshot.orders[0]?.no ?? 1048) + 1));
        setDataSourceError(null);
      }).catch(() => {
        if (alive) setDataSourceError("Server data tidak dapat dijangkau. Periksa koneksi dan masuk kembali.");
      }).finally(() => { refreshing = false; });
    }, 5000) : undefined;

    return () => {
      alive = false;
      if (refreshTimer !== undefined) window.clearInterval(refreshTimer);
      unsubscribe();
    };
  }, []);

  const totals = useMemo(
    () =>
      computeTotals(
        lines,
        products,
        discountType,
        discountValue,
        taxEnabled,
        taxRate,
        serviceChargeEnabled,
        serviceChargeRate,
      ),
    [
      lines,
      products,
      discountType,
      discountValue,
      taxEnabled,
      taxRate,
      serviceChargeEnabled,
      serviceChargeRate,
    ],
  );

  /** True when one more portion of `itemId` fits the ready stock; warns the cashier otherwise. */
  const canAddPortion = useCallback(
    (itemId: string): boolean => {
      const product = products.find((p) => p.id === itemId);
      if (!product || product.stock === undefined || product.stock === null) return true;
      const inCart = lines.find((l) => l.itemId === itemId)?.qty ?? 0;
      if (inCart < product.stock) return true;
      toast.error(product.stock <= 0 ? `${product.name} HABIS` : `Stok ${product.name} tinggal ${product.stock}`);
      return false;
    },
    [lines, products],
  );

  const addItem = useCallback(
    (itemId: string) => {
      if (!canAddPortion(itemId)) return;
      setLinesForActiveCart((prev) => {
        const idx = prev.findIndex((l) => l.itemId === itemId);
        if (idx >= 0) {
          return prev.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l));
        }
        return [...prev, { itemId, qty: 1 }];
      });
    },
    [canAddPortion, setLinesForActiveCart],
  );

  const setItemNote = useCallback(
    (itemId: string, note: string) => {
      setLinesForActiveCart((prev) =>
        prev.map((l) => (l.itemId === itemId ? { ...l, note } : l)),
      );
    },
    [setLinesForActiveCart],
  );

  const increaseLine = useCallback(
    (itemId: string) => {
      if (!canAddPortion(itemId)) return;
      setLinesForActiveCart((prev) =>
        prev.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + 1 } : l)),
      );
    },
    [canAddPortion, setLinesForActiveCart],
  );

  const decreaseLine = useCallback(
    (itemId: string) => {
      setLinesForActiveCart((prev) =>
        prev
          .map((l) => (l.itemId === itemId ? { ...l, qty: l.qty - 1 } : l))
          .filter((l) => l.qty > 0),
      );
    },
    [setLinesForActiveCart],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      setLinesForActiveCart((prev) => prev.filter((l) => l.itemId !== itemId));
    },
    [setLinesForActiveCart],
  );

  const clearOrder = useCallback(() => {
    setLinesForActiveCart(() => []);
    setDiscountValue(0);
  }, [setLinesForActiveCart]);

  const setDiscount = useCallback((type: "percent" | "fixed", value: number) => {
    setDiscountType(type);
    setDiscountValue(value);
  }, []);

  const savePricing = useCallback(
    async (pricing: PricingSettings) => {
      if (isRemoteDataSource) {
        applyPricing(await saveRemotePricing(pricing));
        return;
      }
      applyPricing(pricing);
      try {
        localStorage.setItem("kasa_tax_enabled", pricing.taxEnabled ? "1" : "0");
        localStorage.setItem("kasa_tax_rate", String(pricing.taxRate));
        localStorage.setItem("kasa_service_charge_enabled", pricing.serviceChargeEnabled ? "1" : "0");
        localStorage.setItem("kasa_service_charge_rate", String(pricing.serviceChargeRate));
      } catch {}
    },
    [applyPricing],
  );

  /** Re-reads products after an order so stock badges (HABIS / low stock) are current. */
  const refreshProductsQuietly = useCallback(async () => {
    if (isPublicCustomer) {
      try {
        setProducts((await loadPublicMenu()).products);
      } catch {}
      return;
    }
    try {
      setProducts(await loadProducts());
      broadcastSync("PRODUCTS_UPDATED");
    } catch {}
  }, []);

  /** Runs a submit with a per-key idempotency reference that survives network failures. */
  const withClientRef = useCallback(async <T,>(key: string, run: (clientRef: string) => Promise<T>): Promise<T> => {
    const clientRef = pendingRefs.current.get(key) ?? newClientRef();
    pendingRefs.current.set(key, clientRef);
    try {
      const result = await run(clientRef);
      pendingRefs.current.delete(key);
      return result;
    } catch (error) {
      // Keep the key only when the outcome is unknown (no HTTP answer); any server answer is final.
      if (!(error instanceof RemoteDataError) || error.status !== undefined) pendingRefs.current.delete(key);
      throw error;
    }
  }, []);

  const recordOrder = useCallback(
    async (payment: { method: PayMethod; cashReceived?: number } | null): Promise<OrderRow> => {
      if (savingOrderRef.current) throw new Error("Pesanan sebelumnya masih diproses.");
      if (lines.length === 0) throw new Error("Keranjang masih kosong.");
      if (orderType === "meja" && !selectedTable) throw new Error("Pilih meja terlebih dahulu.");
      savingOrderRef.current = true;
      const cartKey = activeCartKey;
      try {
        const orderItems: OrderItemLine[] = lines.map((l) => {
          const prod = products.find((p) => p.id === l.itemId);
          return {
            itemId: l.itemId,
            name: prod?.name || "Produk",
            qty: l.qty,
            price: prod?.price || 0,
            note: l.note,
          };
        });

        const paid = payment !== null;
        const row: OrderRow = {
          no: orderNo,
          status: legacyStatusFor("queued"),
          paymentStatus: paid ? "paid" : "unpaid",
          kitchenStatus: "queued",
          total: totals.total,
          subtotal: totals.subtotal,
          tax: totals.tax,
          discount: totals.discountAmount,
          serviceCharge: totals.serviceCharge,
          itemCount: totals.count,
          items: orderItems,
          method: payment?.method,
          orderType,
          tableId: orderType === "meja" ? selectedTable?.id : undefined,
          tableName: orderType === "meja" ? selectedTable?.name : undefined,
          tableArea: orderType === "meja" ? selectedTable?.area : undefined,
          guests: orderType === "meja" ? guests : undefined,
          source: "pos",
          paymentChoice: paid ? "paid-now" : "pay-later",
          createdAt: Date.now(),
        };

        const saved = await withClientRef(`pos:${cartKey}`, (clientRef) =>
          saveOrder(row, { clientRef, cashReceived: payment?.cashReceived }),
        );
        setOrders((prev) => [saved, ...prev.filter((o) => o.no !== saved.no)]);
        setTableDrafts((prev) => ({ ...prev, [cartKey]: [] }));
        setDiscountValue(0);
        setOrderNo((n) => Math.max(n + 1, saved.no + 1));
        broadcastSync("ORDER_CREATED", { order: saved });
        void refreshProductsQuietly();
        return saved;
      } catch (error) {
        await syncAfterConflict(error);
        throw error;
      } finally {
        savingOrderRef.current = false;
      }
    },
    [activeCartKey, guests, lines, orderNo, orderType, products, refreshProductsQuietly, selectedTable, syncAfterConflict, totals, withClientRef],
  );

  const saveDraft = useCallback(async (): Promise<number> => {
    const saved = await recordOrder(null);
    return saved.no;
  }, [recordOrder]);

  const payOrder = useCallback(
    async (method: PayMethod, cashReceived?: number): Promise<PayResult> => {
      const saved = await recordOrder({ method, cashReceived });
      const change =
        method === "tunai" && cashReceived !== undefined
          ? Math.max(0, cashReceived - saved.total)
          : null;
      return { order: saved, change };
    },
    [recordOrder],
  );

  const settleOrder = useCallback(
    async (no: number, method: PayMethod, cashReceived?: number): Promise<SettleResult> => {
      const result = await repoSettleOrder(no, method, cashierNameRef.current, cashReceived);
      setOrders((prev) => prev.map((o) => (o.no === no ? result.order : o)));
      broadcastSync("ORDER_STATUS_CHANGED", { no });
      const received = result.order.cashReceived ?? cashReceived;
      const change = result.order.method === "tunai" && received !== undefined ? Math.max(0, received - result.order.total) : null;
      return { ...result, change };
    },
    [],
  );

  const tableById = useCallback(
    (id: string): TableRow => {
      const table = tables.find((t) => t.id === id);
      if (!table) throw new Error("Meja tidak ditemukan. Muat ulang daftar meja.");
      return table;
    },
    [tables],
  );

  const createSelfOrder = useCallback(
    async (input: SelfOrderInput): Promise<OrderRow> => {
      if (input.lines.length === 0) throw new Error("Keranjang masih kosong.");
      const expected = computeTotals(
        input.lines,
        products,
        "percent",
        0,
        taxEnabled,
        taxRate,
        serviceChargeEnabled,
        serviceChargeRate,
      );
      try {
        if (isPublicCustomer) {
          if (input.paymentChoice !== "pay-later") throw new Error("Pembayaran dilakukan di kasir atau lewat QRIS setelah pesanan dibuat.");
          const created = await createPublicOrder({
            tableId: input.tableId,
            customerName: input.customerName,
            items: input.lines.map((line) => ({ itemId: line.itemId, qty: line.qty, note: line.note })),
            expectedTotal: expected.total,
            clientRef: input.clientRef,
          });
          setOrders((previous) => [created, ...previous.filter((o) => o.no !== created.no)]);
          void refreshProductsQuietly();
          return created;
        }

        const table = tableById(input.tableId);
        const paid = input.paymentChoice === "paid-now";
        const row: OrderRow = {
          no: 0,
          status: legacyStatusFor("queued"),
          paymentStatus: paid ? "paid" : "unpaid",
          kitchenStatus: "queued",
          total: expected.total,
          subtotal: expected.subtotal,
          tax: expected.tax,
          discount: 0,
          serviceCharge: expected.serviceCharge,
          itemCount: expected.count,
          items: input.lines.map((l) => {
            const prod = products.find((p) => p.id === l.itemId);
            return { itemId: l.itemId, name: prod?.name || "Produk", qty: l.qty, price: prod?.price || 0, note: l.note };
          }),
          method: paid ? "qris" : undefined,
          orderType: "meja",
          tableId: table.id,
          tableName: table.name,
          tableArea: table.area,
          customerName: input.customerName.trim() || "Pelanggan Meja",
          source: "self-order",
          paymentChoice: input.paymentChoice,
          createdAt: Date.now(),
        };
        const saved = await saveOrder(row, { clientRef: input.clientRef });
        setOrders((prev) => [saved, ...prev.filter((o) => o.no !== saved.no)]);
        setOrderNo((n) => Math.max(n, saved.no + 1));
        broadcastSync("ORDER_CREATED", { order: saved });
        void refreshProductsQuietly();
        return saved;
      } catch (error) {
        await syncAfterConflict(error);
        throw error;
      }
    },
    [products, refreshProductsQuietly, serviceChargeEnabled, serviceChargeRate, syncAfterConflict, tableById, taxEnabled, taxRate],
  );

  const createWaiterOrder = useCallback(
    async (input: WaiterOrderInput): Promise<OrderRow> => {
      if (input.lines.length === 0) throw new Error("Keranjang masih kosong.");
      const table = tableById(input.tableId);
      const waiterTotals = computeTotals(
        input.lines,
        products,
        "percent",
        0,
        taxEnabled,
        taxRate,
        serviceChargeEnabled,
        serviceChargeRate,
      );
      const paid = input.method !== undefined;
      const row: OrderRow = {
        no: 0,
        status: legacyStatusFor("queued"),
        paymentStatus: paid ? "paid" : "unpaid",
        kitchenStatus: "queued",
        total: waiterTotals.total,
        subtotal: waiterTotals.subtotal,
        tax: waiterTotals.tax,
        discount: 0,
        serviceCharge: waiterTotals.serviceCharge,
        itemCount: waiterTotals.count,
        items: input.lines.map((l) => {
          const prod = products.find((p) => p.id === l.itemId);
          return { itemId: l.itemId, name: prod?.name || "Produk", qty: l.qty, price: prod?.price || 0, note: l.note };
        }),
        method: input.method,
        orderType: "meja",
        tableId: table.id,
        tableName: table.name,
        tableArea: table.area,
        guests: input.guests || 2,
        customerName: input.customerName?.trim() || "Tamu Meja",
        waiterId: input.waiterId,
        waiterName: input.waiterName,
        source: "waiter",
        paymentChoice: paid ? "paid-now" : "pay-later",
        createdAt: Date.now(),
      };

      try {
        const saved = await saveOrder(row, { clientRef: input.clientRef, cashReceived: input.cashReceived });
        setOrders((prev) => [saved, ...prev.filter((o) => o.no !== saved.no)]);
        setOrderNo((n) => Math.max(n, saved.no + 1));
        broadcastSync("ORDER_CREATED", { order: saved });
        void refreshProductsQuietly();
        return saved;
      } catch (error) {
        await syncAfterConflict(error);
        throw error;
      }
    },
    [products, refreshProductsQuietly, serviceChargeEnabled, serviceChargeRate, syncAfterConflict, tableById, taxEnabled, taxRate],
  );

  const updateKitchenStatus = useCallback(async (no: number, kitchenStatus: KitchenStatus) => {
    const updated = await repoUpdateKitchenStatus(no, kitchenStatus);
    if (isRemoteDataSource) await db.orders.put(updated).catch(() => undefined);
    setOrders((prev) => prev.map((o) => (o.no === no ? { ...o, ...updated } : o)));
    broadcastSync("ORDER_STATUS_CHANGED", { no, kitchenStatus });
  }, []);

  const adjustStock = useCallback(async (item: MenuItem, mode: "set" | "add", qty: number | null) => {
    const updated = await repoAdjustStock(item, mode, qty);
    setProducts((prev) => prev.map((p) => (p.id === item.id ? { ...p, stock: updated.stock } : p)));
    broadcastSync("PRODUCTS_UPDATED");
  }, []);

  const openShift = useCallback(async (cashierName: string, startingCash: number) => {
    const shift: ShiftRecord = {
      id: `shift-${Date.now()}`,
      openedAt: Date.now(),
      cashierName,
      startingCash,
      status: "OPEN",
    };
    await repoSaveShift(shift);
    setActiveShift(shift);
    broadcastSync("SHIFT_CHANGED", { shift });
  }, []);

  const closeShift = useCallback(
    async (
      actualCash: number,
      notes?: string,
      denominations?: Record<string, number>,
    ): Promise<ShiftRecord> => {
      if (!activeShift) {
        throw new Error("Tidak ada shift yang sedang aktif.");
      }
      const paidCashTotal = orders
        .filter(
          (o) =>
            isPaid(o) &&
            o.method === "tunai" &&
            (o.paidAt ?? 0) >= activeShift.openedAt,
        )
        .reduce((sum, o) => sum + o.total, 0);

      const shiftMovements = cashMovements.filter((m) => (m.createdAt ?? 0) >= activeShift.openedAt);
      const cashInTotal = shiftMovements
        .filter((m) => m.type === "CASH_IN" && m.category !== "modal_awal")
        .reduce((sum, m) => sum + m.amount, 0);
      const cashOutTotal = shiftMovements
        .filter((m) => m.type === "CASH_OUT")
        .reduce((sum, m) => sum + m.amount, 0);

      const expectedCash = activeShift.startingCash + paidCashTotal + cashInTotal - cashOutTotal;
      const cashDifference = actualCash - expectedCash;

      const closed: ShiftRecord = {
        ...activeShift,
        closedAt: Date.now(),
        actualCash,
        expectedCash,
        cashDifference,
        cashSalesTotal: paidCashTotal,
        cashInTotal,
        cashOutTotal,
        denominations,
        status: "CLOSED",
        notes,
      };

      await repoSaveShift(closed);
      setActiveShift(null);
      broadcastSync("SHIFT_CHANGED", { shift: closed });
      return closed;
    },
    [activeShift, cashMovements, orders],
  );

  const addCashMovement = useCallback(
    async (input: {
      type: CashMovementType;
      category: CashMovementCategory;
      amount: number;
      description: string;
      cashierName?: string;
    }): Promise<CashMovementRow> => {
      const row: CashMovementRow = {
        id: `mov-${Date.now()}`,
        shiftId: activeShift?.id,
        type: input.type,
        category: input.category,
        amount: input.amount,
        description: input.description,
        cashierName: input.cashierName || activeShift?.cashierName || "Kasir",
        createdAt: Date.now(),
      };
      await repoSaveCashMovement(row);
      setCashMovements((prev) => [row, ...prev]);
      broadcastSync("CASH_MOVEMENT_CREATED", { movement: row });
      return row;
    },
    [activeShift],
  );

  const deleteCashMovement = useCallback(
    async (id: string) => {
      await repoDeleteCashMovement(id);
      setCashMovements((prev) => prev.filter((m) => m.id !== id));
      broadcastSync("CASH_MOVEMENT_DELETED", { id });
    },
    [],
  );

  const reloadCashMovements = useCallback(async () => {
    const list = await loadCashMovements();
    setCashMovements(list);
    broadcastSync("CASH_MOVEMENT_CREATED");
  }, []);

  const triggerOpenDrawer = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        }
      }
    } catch {}
  }, []);

  const reloadProducts = useCallback(async () => {
    const p = await loadProducts();
    setProducts(p);
    broadcastSync("PRODUCTS_UPDATED");
  }, []);

  const reloadTables = useCallback(async () => {
    const t = await loadTables();
    setTables(t);
    broadcastSync("TABLE_UPDATED");
  }, []);

  const reloadOrders = useCallback(async () => {
    const o = await loadOrders();
    setOrders(o);
  }, []);

  const reloadCategories = useCallback(async () => {
    const cats = await loadCategories();
    setCategories(cats);
  }, []);

  const addCategory = useCallback(async (input: Partial<CategoryRow>) => {
    const id = input.id || `cat-${Date.now()}`;
    const newCat: CategoryRow = {
      id,
      name: input.name?.trim() || "Kategori Baru",
      kind: input.kind || "Makanan",
      color: input.color || "accent",
      sortOrder: input.sortOrder ?? (categories.length + 1),
      createdAt: Date.now(),
      isDefault: false,
    };
    await repoSaveCategory(newCat);
    const updatedCats = await loadCategories();
    setCategories(updatedCats);
    broadcastSync("CATEGORY_CREATED", newCat);
    return newCat;
  }, [categories.length]);

  const updateCategory = useCallback(async (id: string, updates: Partial<CategoryRow>, oldName?: string) => {
    await repoUpdateCategory(id, updates, oldName);
    const [updatedCats, updatedProds] = await Promise.all([loadCategories(), loadProducts()]);
    setCategories(updatedCats);
    setProducts(updatedProds);
    broadcastSync("CATEGORY_UPDATED", { id, updates });
    if (updates.name && oldName && updates.name !== oldName) {
      broadcastSync("PRODUCTS_UPDATED");
    }
  }, []);

  const deleteCategory = useCallback(async (id: string, categoryName: string, reassignToCategoryName?: string) => {
    await repoDeleteCategory(id, categoryName, reassignToCategoryName);
    const [updatedCats, updatedProds] = await Promise.all([loadCategories(), loadProducts()]);
    setCategories(updatedCats);
    setProducts(updatedProds);
    broadcastSync("CATEGORY_DELETED", { id, categoryName, reassignToCategoryName });
    if (reassignToCategoryName) {
      broadcastSync("PRODUCTS_UPDATED");
    }
  }, []);

  const addProduct = useCallback(async (item: MenuItem) => {
    await repoSaveProduct(item);
    setProducts(await loadProducts());
    broadcastSync("PRODUCTS_UPDATED");
  }, []);

  const updateProduct = useCallback(async (item: MenuItem) => {
    await repoSaveProduct(item);
    setProducts(await loadProducts());
    broadcastSync("PRODUCTS_UPDATED");
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await repoDeleteProduct(id);
    setProducts(await loadProducts());
    broadcastSync("PRODUCTS_UPDATED");
  }, []);

  const addTable = useCallback(async (table: TableRow) => {
    await repoSaveTable(table);
    setTables(await loadTables());
    broadcastSync("TABLE_UPDATED");
  }, []);

  const updateTable = useCallback(async (table: TableRow) => {
    await repoSaveTable(table);
    setTables(await loadTables());
    broadcastSync("TABLE_UPDATED");
  }, []);

  const deleteTable = useCallback(async (id: string) => {
    await repoDeleteTable(id);
    setTables(await loadTables());
    broadcastSync("TABLE_UPDATED");
  }, []);

  const selectTable = useCallback((table: TableRow) => {
    setOrderType("meja");
    setTableId(table.id);
    setGuests(table.seats);
  }, []);

  const resetSeed = useCallback(async () => {
    await resetToDemoSeed();
    const [prods, tbls, movs, cats] = await Promise.all([
      loadProducts(),
      loadTables(),
      loadCashMovements(),
      loadCategories(),
    ]);
    setProducts(prods);
    setTables(tbls);
    setCashMovements(movs);
    setCategories(cats);
    broadcastSync("PRODUCTS_UPDATED");
    broadcastSync("TABLE_UPDATED");
    broadcastSync("CATEGORY_UPDATED");
  }, []);

  const value = useMemo<PosContextValue>(
    () => ({
      ready,
      dataSourceError,
      products,
      categories,
      tables,
      orderNo,
      orderType,
      tableId,
      selectedTable,
      guests,
      lines,
      totals,
      orders,
      cashMovements,
      discountType,
      discountValue,
      taxRate,
      serviceChargeRate,
      taxEnabled,
      serviceChargeEnabled,
      activeShift,
      setOrderType,
      setTableId,
      setGuests,
      setDiscount,
      savePricing,
      addItem,
      setItemNote,
      increaseLine,
      decreaseLine,
      removeItem,
      clearOrder,
      saveDraft,
      payOrder,
      createSelfOrder,
      createWaiterOrder,
      addCashMovement,
      deleteCashMovement,
      reloadCashMovements,
      triggerOpenDrawer,
      reloadProducts,
      reloadTables,
      reloadOrders,
      reloadCategories,
      addProduct,
      updateProduct,
      deleteProduct,
      addCategory,
      updateCategory,
      deleteCategory,
      addTable,
      updateTable,
      deleteTable,
      selectTable,
      updateKitchenStatus,
      adjustStock,
      settleOrder,
      openShift,
      closeShift,
      resetSeed,
    }),
    [
      ready,
      dataSourceError,
      products,
      categories,
      tables,
      orderNo,
      orderType,
      tableId,
      selectedTable,
      guests,
      lines,
      totals,
      orders,
      cashMovements,
      discountType,
      discountValue,
      taxRate,
      serviceChargeRate,
      taxEnabled,
      serviceChargeEnabled,
      activeShift,
      setOrderType,
      setTableId,
      setGuests,
      setDiscount,
      savePricing,
      addItem,
      setItemNote,
      increaseLine,
      decreaseLine,
      removeItem,
      clearOrder,
      saveDraft,
      payOrder,
      createSelfOrder,
      createWaiterOrder,
      addCashMovement,
      deleteCashMovement,
      reloadCashMovements,
      triggerOpenDrawer,
      reloadProducts,
      reloadTables,
      reloadOrders,
      reloadCategories,
      addProduct,
      updateProduct,
      deleteProduct,
      addCategory,
      updateCategory,
      deleteCategory,
      addTable,
      updateTable,
      deleteTable,
      selectTable,
      updateKitchenStatus,
      adjustStock,
      settleOrder,
      openShift,
      closeShift,
      resetSeed,
    ],
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos(): PosContextValue {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos harus dipakai di dalam PosProvider");
  return ctx;
}

export function runningOrdersCount(orders: OrderRow[]): number {
  return orders.filter(isKitchenActive).length;
}

export function salesToday(orders: OrderRow[]): number {
  const paidToday = orders
    .filter((o) => isPaid(o) && isToday(o.paidAt))
    .reduce((sum, o) => sum + o.total, 0);
  return paidToday;
}

export { db };
