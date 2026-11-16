import { useEffect, useState } from "react";
import { toast } from "sonner";
import { loadPublicPaymentOptions, type QrisCharge, startPublicQris } from "../../data/public";
import { isPaid } from "../../lib/orderStatus";
import { qrDataUrl } from "../../lib/qr";
import { t } from "../../locales/id";
import type { OrderRow } from "../../types/domain";

export interface QrisPayment {
  /** Whether the QRIS button is offered at all (the local demo always offers its simulation). */
  available: boolean;
  orderNo: number | null;
  charge: QrisCharge | null;
  image: string;
  open: (no: number, key: string) => Promise<void>;
  close: () => void;
}

/**
 * Gateway QRIS flow for a placed order. The sheet closes by itself once the live order shows as paid;
 * `onPaid` receives that order so the caller can show the receipt.
 */
export function useQrisPayment(isPublicCustomer: boolean, liveOrders: OrderRow[], onPaid: (order: OrderRow) => void): QrisPayment {
  const [available, setAvailable] = useState(!isPublicCustomer);
  const [orderNo, setOrderNo] = useState<number | null>(null);
  const [charge, setCharge] = useState<QrisCharge | null>(null);
  const [image, setImage] = useState("");

  useEffect(() => {
    if (!isPublicCustomer) return;
    loadPublicPaymentOptions()
      .then((options) => setAvailable(options.qris))
      .catch(() => setAvailable(false));
  }, [isPublicCustomer]);

  const close = () => {
    setOrderNo(null);
    setCharge(null);
  };

  const open = async (no: number, key: string) => {
    setOrderNo(no);
    setCharge(null);
    try {
      setCharge(await startPublicQris(no, key));
    } catch (err) {
      setOrderNo(null);
      toast.error(err instanceof Error ? err.message : t.selfOrder.qris.unavailable, {
        description: t.selfOrder.qris.unavailableBody(no),
      });
    }
  };

  const paidOrder = orderNo !== null ? liveOrders.find((o) => o.no === orderNo) : undefined;
  useEffect(() => {
    if (paidOrder && isPaid(paidOrder)) {
      toast.success(t.selfOrder.qris.received(paidOrder.no));
      setOrderNo(null);
      setCharge(null);
      onPaid(paidOrder);
    }
    // onPaid is a state setter in the caller; the effect must only react to the order changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidOrder]);

  useEffect(() => {
    if (!charge) {
      setImage("");
      return;
    }
    qrDataUrl(charge.qrString, { width: 300, margin: 1, errorCorrectionLevel: "M" })
      .then(setImage)
      .catch(() => setImage(""));
  }, [charge]);

  return { available, orderNo, charge, image, open, close };
}
