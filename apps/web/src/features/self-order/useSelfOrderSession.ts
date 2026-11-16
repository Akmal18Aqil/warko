import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCartLines } from "../../hooks/useCartLines";
import { usePublicCustomer } from "../../hooks/usePublicCustomer";
import { useCategories, useProducts } from "../../state/catalog";
import { createSelfOrder } from "../../state/orders";
import { usePricing } from "../../state/pricing";
import { useDataReady, useDataSourceError } from "../../state/session";
import { usePrint } from "../../state/print";
import { isSoldOut, type MenuItem } from "../../data/menu";
import { RemoteDataError } from "../../data/index";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import { newClientRef } from "../../lib/orderStatus";
import { t } from "../../locales/id";
import type { CartLine, CategoryRow, OrderRow, OrderTotals } from "../../types/domain";
import type { PricingSettings } from "@wakro/shared";
import { useLiveOrders } from "./useLiveOrders";
import { useQrisPayment, type QrisPayment } from "./useQrisPayment";
import { useSelfTable, type SelfTable } from "./useSelfTable";
import { PENDING_ORDER_KEY, readPendingOrder, type PendingOrder } from "./pendingOrder";

type PaymentChoice = "paid-now" | "pay-later";

interface SelfOrderSession {
  ready: boolean;
  dataSourceError: string | null;
  isPublicCustomer: boolean;
  products: MenuItem[];
  categories: CategoryRow[];
  pricing: PricingSettings;
  table: SelfTable;
  customerName: string;
  setCustomerName: (name: string) => void;
  cart: {
    lines: CartLine[];
    totals: OrderTotals;
    add: (itemId: string) => void;
    decrease: (itemId: string) => void;
    setNote: (itemId: string, note: string) => void;
  };
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  submitting: boolean;
  pendingOrder: PendingOrder | null;
  liveOrders: OrderRow[];
  qris: QrisPayment;
  payAtCashier: () => Promise<void>;
  payQris: () => Promise<void>;
  /** Re-open the QRIS sheet for an already placed, unpaid order. */
  payPlacedOrderQris: (no: number) => void;
  demoQrisOpen: boolean;
  closeDemoQris: () => void;
  confirmDemoQris: () => Promise<void>;
  receipt: { order: OrderRow; close: () => void; print: () => void } | null;
  openReceipt: (order: OrderRow) => void;
}

const NOTE_MAX = 200;

/** Everything the customer self-order page needs: table, cart, placing the order, live status and payment. */
export function useSelfOrderSession(paramTableId: string | undefined): SelfOrderSession {
  const isPublicCustomer = usePublicCustomer();
  const ready = useDataReady();
  const dataSourceError = useDataSourceError();
  const products = useProducts();
  const categories = useCategories();
  const pricing = usePricing();
  const { printOrderReceipt } = usePrint();

  const table = useSelfTable(ready, paramTableId);
  const currentTable = table.current;

  const [customerName, setCustomerName] = useState(() => localStorage.getItem(STORAGE_KEYS.selfCustomerName) || "");
  useEffect(() => {
    if (customerName) localStorage.setItem(STORAGE_KEYS.selfCustomerName, customerName);
  }, [customerName]);

  const cart = useCartLines({ products, pricing });
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(() => readPendingOrder(localStorage));
  const pendingRef = useRef<PendingOrder | null>(pendingOrder);

  const [receiptOrder, setReceiptOrder] = useState<OrderRow | null>(null);
  const { live, track, keyOf } = useLiveOrders(isPublicCustomer, currentTable);
  const qris = useQrisPayment(isPublicCustomer, live, setReceiptOrder);
  /** Local demo only: the cart waiting for a simulated QRIS confirmation. */
  const [demoQrisOpen, setDemoQrisOpen] = useState(false);

  // Drop cart lines whose product disappeared or sold out after a menu refresh.
  useEffect(() => {
    const next = cart.lines.filter((line) => {
      const product = products.find((p) => p.id === line.itemId);
      return product !== undefined && !isSoldOut(product);
    });
    if (next.length !== cart.lines.length) cart.setLines(next);
  }, [products, cart.lines, cart.setLines]);

  const submitOrder = async (paymentChoice: PaymentChoice): Promise<{ order: OrderRow; key: string } | null> => {
    if (submittingRef.current) return null;
    if (!pendingRef.current && !currentTable) {
      table.openPicker();
      toast.error(t.selfOrder.table.required);
      return null;
    }
    if (!pendingRef.current && cart.lines.length === 0) {
      toast.error(t.selfOrder.order.emptyCart);
      return null;
    }
    const key = pendingRef.current?.clientRef ?? newClientRef();
    const pending: PendingOrder | null = isPublicCustomer ? pendingRef.current ?? {
      tableId: currentTable!.id,
      customerName: customerName.trim() || t.selfOrder.guestAt(currentTable!.name),
      lines: cart.lines.map((line) => ({ ...line })),
      clientRef: key,
      paymentChoice: "pay-later",
      expectedTotal: cart.totals.total,
    } : null;
    if (pending) {
      localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(pending));
      pendingRef.current = pending;
      setPendingOrder(pending);
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const created = await createSelfOrder(pending ?? {
        tableId: currentTable!.id,
        customerName: customerName.trim() || t.selfOrder.guestAt(currentTable!.name),
        lines: cart.lines,
        clientRef: key,
        paymentChoice,
      });
      track({ no: created.no, key, tableId: pending?.tableId ?? currentTable!.id, createdAt: Date.now() }, created);
      pendingRef.current = null;
      setPendingOrder(null);
      localStorage.removeItem(PENDING_ORDER_KEY);
      if (!pending || (currentTable?.id === pending.tableId && JSON.stringify(cart.lines) === JSON.stringify(pending.lines))) cart.clear();
      setCartOpen(false);
      return { order: created, key };
    } catch (err) {
      if (err instanceof RemoteDataError && err.status !== undefined && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
        pendingRef.current = null;
        setPendingOrder(null);
        localStorage.removeItem(PENDING_ORDER_KEY);
      }
      toast.error(err instanceof Error ? err.message : t.selfOrder.order.sendFailed);
      return null;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const payAtCashier = async () => {
    const result = await submitOrder("pay-later");
    if (!result) return;
    toast.success(t.selfOrder.order.accepted(result.order.no), {
      description: t.selfOrder.order.acceptedBody(result.order.no),
    });
  };

  const payQris = async () => {
    if (!isPublicCustomer) {
      // Local demo mode: no gateway; the payment is simulated and labelled as such.
      if (!currentTable || cart.lines.length === 0) {
        await submitOrder("paid-now");
        return;
      }
      setDemoQrisOpen(true);
      return;
    }
    const result = await submitOrder("pay-later");
    if (result) await qris.open(result.order.no, result.key);
  };

  const confirmDemoQris = async () => {
    const result = await submitOrder("paid-now");
    setDemoQrisOpen(false);
    if (!result) return;
    toast.success(t.selfOrder.order.paidDemo(result.order.no));
    setReceiptOrder(result.order);
  };

  const payPlacedOrderQris = (no: number) => {
    const key = keyOf(no);
    if (key) void qris.open(no, key);
  };

  // The receipt follows the live order so a payment confirmed while it is open shows up.
  const receiptView = receiptOrder ? (live.find((o) => o.no === receiptOrder.no) ?? receiptOrder) : null;

  return {
    ready,
    dataSourceError,
    isPublicCustomer,
    products,
    categories,
    pricing,
    table,
    customerName,
    setCustomerName,
    cart: {
      lines: cart.lines,
      totals: cart.totals,
      add: (itemId) => {
        if (products.some((p) => p.id === itemId)) cart.add(itemId);
      },
      decrease: cart.decrease,
      setNote: (itemId, note) => cart.setNote(itemId, note.slice(0, NOTE_MAX)),
    },
    cartOpen,
    setCartOpen,
    submitting,
    pendingOrder,
    liveOrders: live,
    qris,
    payAtCashier,
    payQris,
    payPlacedOrderQris,
    demoQrisOpen,
    closeDemoQris: () => setDemoQrisOpen(false),
    confirmDemoQris,
    receipt: receiptView
      ? {
          order: receiptView,
          close: () => setReceiptOrder(null),
          print: () =>
            printOrderReceipt(receiptView).catch((err: unknown) =>
              toast.error(err instanceof Error ? err.message : t.selfOrder.order.receiptSaveFailed),
            ),
        }
      : null,
    openReceipt: setReceiptOrder,
  };
}
