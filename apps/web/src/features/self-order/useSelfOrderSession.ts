import type { PricingSettings } from "@wakro/shared";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RemoteDataError } from "../../data/index";
import { isSoldOut, type MenuItem } from "../../data/menu";
import { useCartLines } from "../../hooks/useCartLines";
import { usePublicCustomer } from "../../hooks/usePublicCustomer";
import { newClientRef } from "../../lib/orderStatus";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import { t } from "../../locales/id";
import { useCategories, useProducts } from "../../state/catalog";
import { createSelfOrder, settleOrder } from "../../state/orders";
import { usePricing } from "../../state/pricing";
import { usePrint } from "../../state/print";
import { useDataReady, useDataSourceError } from "../../state/session";
import type { CartLine, CategoryRow, OrderRow, OrderTotals } from "../../types/domain";
import { cartUnchanged, type PendingOrder, readPendingOrder } from "./pendingOrder";
import { useLiveOrders } from "./useLiveOrders";
import { type QrisPayment, useQrisPayment } from "./useQrisPayment";
import { type SelfTable, useSelfTable } from "./useSelfTable";

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
  /** Re-sends the stored order whose response was lost, with the same idempotency key. */
  retryPendingOrder: () => Promise<void>;
  liveOrders: OrderRow[];
  qris: QrisPayment;
  payAtCashier: () => Promise<void>;
  payQris: () => Promise<void>;
  /** Re-open the QRIS sheet for an already placed, unpaid order. */
  payPlacedOrderQris: (no: number) => void;
  /** Local demo only: the simulated QRIS sheet, for a cart being paid now or for an already placed order. */
  demoQris: DemoQris | null;
  receipt: { order: OrderRow; close: () => void; print: () => void } | null;
  openReceipt: (order: OrderRow) => void;
}

interface DemoQris {
  total: number;
  submitting: boolean;
  confirm: () => Promise<void>;
  close: () => void;
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
  const currentCart = useRef(cart.lines);
  currentCart.current = cart.lines;
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
  /** Local demo only: a placed pay-later order waiting for a simulated QRIS confirmation. */
  const [demoPayOrder, setDemoPayOrder] = useState<OrderRow | null>(null);
  const [settlingDemo, setSettlingDemo] = useState(false);

  // Drop cart lines whose product disappeared or sold out after a menu refresh.
  useEffect(() => {
    const next = cart.lines.filter((line) => {
      const product = products.find((p) => p.id === line.itemId);
      return product !== undefined && !isSoldOut(product);
    });
    if (next.length !== cart.lines.length) cart.setLines(next);
  }, [products, cart.lines, cart.setLines]);

  /**
   * `new` submits the cart; `recover` re-sends the stored payload of an order whose outcome is unknown.
   * While such an order exists, new submissions are blocked so the customer cannot order twice by accident.
   */
  const submitOrder = async (
    paymentChoice: PaymentChoice,
    mode: "new" | "recover" = "new",
  ): Promise<{ order: OrderRow; key: string } | null> => {
    if (submittingRef.current) return null;
    if (mode === "recover" && !pendingRef.current) return null;
    if (mode === "new" && pendingRef.current) {
      toast.error(t.selfOrder.pending.blocked);
      return null;
    }
    if (mode === "new" && !currentTable) {
      table.openPicker();
      toast.error(t.selfOrder.table.required);
      return null;
    }
    if (mode === "new" && cart.lines.length === 0) {
      toast.error(t.selfOrder.order.emptyCart);
      return null;
    }
    const submittedLines = cart.lines;
    const key = pendingRef.current?.clientRef ?? newClientRef();
    const pending: PendingOrder | null = isPublicCustomer
      ? (pendingRef.current ?? {
          tableId: currentTable!.id,
          customerName: customerName.trim() || t.selfOrder.guestAt(currentTable!.name),
          lines: cart.lines.map((line) => ({ ...line })),
          clientRef: key,
          paymentChoice: "pay-later",
          expectedTotal: cart.totals.total,
        })
      : null;
    if (pending) {
      localStorage.setItem(STORAGE_KEYS.selfPendingOrder, JSON.stringify(pending));
      pendingRef.current = pending;
      setPendingOrder(pending);
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const created = await createSelfOrder(
        pending ?? {
          tableId: currentTable!.id,
          customerName: customerName.trim() || t.selfOrder.guestAt(currentTable!.name),
          lines: cart.lines,
          clientRef: key,
          paymentChoice,
        },
      );
      track({ no: created.no, key, tableId: pending?.tableId ?? currentTable!.id, createdAt: Date.now() }, created);
      pendingRef.current = null;
      setPendingOrder(null);
      localStorage.removeItem(STORAGE_KEYS.selfPendingOrder);
      if (mode === "new" && cartUnchanged(submittedLines, currentCart.current)) cart.clear();
      setCartOpen(false);
      return { order: created, key };
    } catch (err) {
      const final =
        err instanceof RemoteDataError &&
        err.status !== undefined &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 408 &&
        err.status !== 429;
      if (final) {
        pendingRef.current = null;
        setPendingOrder(null);
        localStorage.removeItem(STORAGE_KEYS.selfPendingOrder);
        // The server rejected the stored order (e.g. a price changed): hand its items back to the cart.
        if (mode === "recover" && pending && currentCart.current.length === 0) cart.setLines(pending.lines);
      } else if (pending && mode === "new") {
        // The stored payload now stands for this order; anything added to the cart afterwards is a new order.
        cart.clear();
        setCartOpen(false);
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

  const retryPendingOrder = async () => {
    const result = await submitOrder("pay-later", "recover");
    if (!result) return;
    toast.success(t.selfOrder.pending.recovered(result.order.no), {
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

  const confirmDemoPlacedQris = async (order: OrderRow) => {
    setSettlingDemo(true);
    try {
      const { order: paid } = await settleOrder(order.no, "qris", t.selfOrder.demoQris.paidBy);
      setDemoPayOrder(null);
      toast.success(t.selfOrder.order.paidDemo(paid.no));
      setReceiptOrder(paid);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.selfOrder.order.sendFailed);
    } finally {
      setSettlingDemo(false);
    }
  };

  const payPlacedOrderQris = (no: number) => {
    if (!isPublicCustomer) {
      setDemoPayOrder(live.find((o) => o.no === no) ?? null);
      return;
    }
    const key = keyOf(no);
    if (key) void qris.open(no, key);
  };

  const demoQris: DemoQris | null = demoPayOrder
    ? {
        total: demoPayOrder.total,
        submitting: settlingDemo,
        confirm: () => confirmDemoPlacedQris(demoPayOrder),
        close: () => setDemoPayOrder(null),
      }
    : demoQrisOpen
      ? { total: cart.totals.total, submitting, confirm: confirmDemoQris, close: () => setDemoQrisOpen(false) }
      : null;

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
    retryPendingOrder,
    liveOrders: live,
    qris,
    payAtCashier,
    payQris,
    payPlacedOrderQris,
    demoQris,
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
