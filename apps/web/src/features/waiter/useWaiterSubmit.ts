import { useState } from "react";
import { toast } from "sonner";
import { formatIDR } from "../../data/menu";
import { RemoteDataError } from "../../data/index";
import { t } from "../../locales/id";
import { newClientRef, tableLabel } from "../../lib/orderStatus";
import { useAuth } from "../../state/auth";
import { createWaiterOrder } from "../../state/orders";
import type { OrderRow, TableRow } from "../../types/domain";
import type { WaiterPayMethod } from "./constants";
import type { WaiterDraft } from "./useWaiterDraft";

type Payment = { method: WaiterPayMethod; cashReceived?: number };

/** Sends the draft to the kitchen, or takes payment at the table; one submit at a time. */
export function useWaiterSubmit(draft: WaiterDraft) {
  const { currentStaff } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Idempotency key for the current cart; reset once the order is stored. */
  const [submitRef, setSubmitRef] = useState(newClientRef);

  const { lines, totals } = draft.cart;

  const readyTable = (): TableRow | null => {
    if (lines.length === 0) {
      toast.error(t.waiter.pickMenuFirst);
      return null;
    }
    if (!draft.selectedTable) {
      toast.error(t.waiter.pickTableFirst);
      return null;
    }
    return draft.selectedTable;
  };

  const place = async (table: TableRow, failureMessage: string, payment?: Payment): Promise<OrderRow | null> => {
    if (isSubmitting) return null;
    setIsSubmitting(true);
    try {
      const created = await createWaiterOrder({
        tableId: table.id,
        customerName: draft.customerName.trim() || t.waiter.defaultCustomer(table.name),
        waiterId: currentStaff.id,
        waiterName: currentStaff.name,
        guests: draft.guests,
        lines,
        method: payment?.method,
        cashReceived: payment?.method === "tunai" ? payment.cashReceived : undefined,
        clientRef: submitRef,
      });
      draft.finishOrder();
      setSubmitRef(newClientRef());
      return created;
    } catch (err) {
      // A network failure (no HTTP status) may still have stored the order: keep the key so the retry is deduplicated.
      if (!(err instanceof RemoteDataError && err.status === undefined)) setSubmitRef(newClientRef());
      toast.error(err instanceof Error ? err.message : failureMessage);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendToKitchen = async () => {
    const table = readyTable();
    if (!table) return;
    const created = await place(table, t.waiter.sendFailed);
    if (created) {
      toast.success(t.waiter.sentToKitchen, {
        description: t.waiter.sentDetail(created.no, tableLabel(created), currentStaff.name),
      });
    }
  };

  /** Resolves true once the order is stored and paid. */
  const payAtTable = async (payment: Payment): Promise<boolean> => {
    const table = readyTable();
    if (!table) return false;
    if (payment.method === "tunai" && (payment.cashReceived ?? 0) < totals.total) {
      toast.error(t.waiter.cashShort);
      return false;
    }
    const created = await place(table, t.waiter.payFailed, payment);
    if (!created) return false;
    const change =
      payment.method === "tunai" ? formatIDR(Math.max(0, (payment.cashReceived ?? 0) - created.total)) : null;
    toast.success(t.waiter.paid, {
      description: t.waiter.paidDetail(
        created.no,
        formatIDR(created.total),
        payment.method === "tunai" ? t.waiter.methodCashCode : t.waiter.methodQris,
        change,
        currentStaff.name,
      ),
    });
    return true;
  };

  return { isSubmitting, sendToKitchen, payAtTable };
}

