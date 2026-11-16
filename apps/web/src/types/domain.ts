import type {
  CashMovementCategory,
  CashMovementType,
  KitchenStatus,
  OrderSource,
  OrderStatus,
  OrderType,
  PayMethod,
  PaymentStatus,
  PricingSettings,
} from "@wakro/shared";
import type { MenuItem, MenuKind } from "../data/menu";

export type OrderItemLine = {
  itemId: string;
  name: string;
  qty: number;
  price: number;
  note?: string;
};

export type OrderRow = {
  no: number;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  kitchenStatus?: KitchenStatus;
  total: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  serviceCharge?: number;
  itemCount: number;
  items?: OrderItemLine[];
  method?: PayMethod;
  orderType: OrderType;
  /** Stable table id; `tableName`/`tableArea` are display snapshots. */
  tableId?: string;
  tableName?: string;
  /** Floor / area of the table (Lantai 1, Lantai 2, Rooftop). */
  tableArea?: string;
  guests?: number;
  customerName?: string;
  waiterId?: string;
  waiterName?: string;
  source?: OrderSource;
  paymentChoice?: "paid-now" | "pay-later";
  cashReceived?: number;
  paidBy?: string;
  paidAt?: number;
  /** Shift whose drawer holds this order's cash; set for cash payments only. */
  cashShiftId?: string;
  createdAt: number;
  /** Local mode only: idempotency key of the submit that created this order. */
  clientRef?: string;
};

export type TableRow = {
  id: string;
  name: string;
  seats: number;
  /** Floor / area: Lantai 1, Lantai 2, Rooftop. */
  area: string;
  active?: boolean;
};

export type CashMovementRow = {
  id: string;
  shiftId?: string;
  type: CashMovementType;
  category: CashMovementCategory;
  amount: number;
  description: string;
  /** Set by the data source (server session / local staff); never sent by the client in remote mode. */
  cashierName: string;
  createdAt: number;
};

export type ShiftStatus = "OPEN" | "CLOSED";

export type ShiftRecord = {
  id: string;
  openedAt: number;
  closedAt?: number;
  cashierName: string;
  startingCash: number;
  actualCash?: number;
  /** The reconciliation figures below are computed by the data source when the shift closes. */
  expectedCash?: number;
  cashDifference?: number;
  cashSalesTotal?: number;
  cashInTotal?: number;
  cashOutTotal?: number;
  denominations?: Record<string, number>;
  status: ShiftStatus;
  notes?: string;
};

export interface CategoryRow {
  id: string;
  name: string;
  kind: MenuKind;
  color?: string;
  sortOrder: number;
  isDefault?: boolean;
  createdAt: number;
}

export type CartLine = { itemId: string; qty: number; note?: string };

/** The kinds of cart-level discount the POS can apply. */
export type CartDiscount = { type: "percent" | "fixed"; value: number };

export type OrderTotals = {
  rawSubtotal: number;
  discountAmount: number;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  count: number;
};

/** Everything the app needs on startup, delivered in one round trip by the data source. */
export type Snapshot = {
  products: MenuItem[];
  orders: OrderRow[];
  tables: TableRow[];
  categories: CategoryRow[];
  /** The open shift, if any. */
  activeShift: ShiftRecord | null;
  /** Whether any shift is open; known to every role (only finance roles receive `activeShift`). */
  cashShiftOpen: boolean;
  cashMovements: CashMovementRow[];
  pricing: PricingSettings;
};

export type StockMode = "set" | "add";

export type OrderSubmitOptions = {
  /** Idempotency key: a retried submit returns the first order instead of creating a duplicate. */
  clientRef: string;
  cashReceived?: number;
};

export type SettleResult = { order: OrderRow; alreadyPaid: boolean };

/** A browser tab (or device) announcing itself to the others sharing this browser profile. */
export interface ConnectedDevice {
  id: string;
  name: string;
  role: "kasir" | "pelayan" | "dapur" | "meja";
  lastSeen: number;
}
