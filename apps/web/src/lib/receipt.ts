import { formatIDR } from "../data/menu";
import type { OrderRow, PayMethod } from "./db";
import { isPaid, tableLabel } from "./orderStatus";
import type { ReceiptPayload } from "../services/printer";

export const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  tunai: "Tunai",
  qris: "QRIS",
  "kartu-qr": "Kartu / Debit",
};

export type ReceiptRow = { label: string; amount: string };

/** One receipt layout for thermal print, the browser print layer and the customer e-receipt. */
export type ReceiptModel = {
  orderNo: number;
  details: string[];
  lines: Array<{ qty: number; name: string; note?: string; unit: string; amount: string }>;
  summary: ReceiptRow[];
  total: string;
  payment: ReceiptRow[];
  paid: boolean;
};

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function receiptFromOrder(order: OrderRow): ReceiptModel {
  const paid = isPaid(order);
  const details = [tableLabel(order), formatDateTime(order.paidAt ?? order.createdAt)];
  if (order.customerName) details.push(`Pelanggan: ${order.customerName}`);
  if (order.paidBy) details.push(`Kasir: ${order.paidBy}`);

  const summary: ReceiptRow[] = [];
  const itemsTotal = (order.items ?? []).reduce((sum, i) => sum + i.price * i.qty, 0);
  summary.push({ label: "Subtotal", amount: formatIDR(itemsTotal) });
  if (order.discount) summary.push({ label: "Diskon", amount: `-${formatIDR(order.discount)}` });
  if (order.serviceCharge) summary.push({ label: "Service", amount: formatIDR(order.serviceCharge) });
  if (order.tax) summary.push({ label: "Pajak", amount: formatIDR(order.tax) });

  const payment: ReceiptRow[] = [];
  if (paid) {
    payment.push({ label: "Dibayar", amount: order.method ? PAY_METHOD_LABEL[order.method] : "Lunas" });
    if (order.method === "tunai" && order.cashReceived) {
      payment.push({ label: "Uang diterima", amount: formatIDR(order.cashReceived) });
      payment.push({ label: "Kembalian", amount: formatIDR(Math.max(0, order.cashReceived - order.total)) });
    }
  } else {
    payment.push({ label: "Status", amount: "BELUM BAYAR" });
  }

  return {
    orderNo: order.no,
    details,
    lines: (order.items ?? []).map((i) => ({
      qty: i.qty,
      name: i.name,
      note: i.note || undefined,
      unit: formatIDR(i.price),
      amount: formatIDR(i.price * i.qty),
    })),
    summary,
    total: formatIDR(order.total),
    payment,
    paid,
  };
}

export function escPosPayload(model: ReceiptModel): ReceiptPayload {
  return {
    orderNo: model.orderNo,
    total: model.total,
    details: model.details,
    lines: model.lines.map((l) => ({ qty: l.qty, name: l.note ? `${l.name} (${l.note})` : l.name, amount: l.amount })),
    summary: model.summary,
    payment: model.payment,
  };
}
