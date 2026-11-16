import type { PricingSettings } from "@wakro/shared";
import type { MenuItem } from "./menu";
import type { OrderRow, TableRow } from "../types/domain";
import { jsonBody, request } from "./api";

/** Endpoints used by the signed-out customer self-order page (remote mode only). */

export function loadPublicMenu(): Promise<{ products: MenuItem[]; tables: TableRow[]; pricing: PricingSettings }> {
  return request("/public/menu");
}

/** `clientRef` is the customer's random key (idempotency + status/e-receipt access). */
export function createPublicOrder(input: {
  tableId: string;
  customerName: string;
  items: { itemId: string; qty: number; note?: string }[];
  expectedTotal: number;
  clientRef: string;
}): Promise<OrderRow> {
  return request("/public/orders", { method: "POST", ...jsonBody({ ...input, paymentChoice: "pay-later" }) });
}

export function loadPublicOrder(no: number, key: string): Promise<OrderRow> {
  return request(`/public/orders/${no}?${new URLSearchParams({ key })}`);
}

export type PublicPaymentOptions = { qris: boolean };

/** Whether self-payment via the QRIS gateway is configured on the server. */
export function loadPublicPaymentOptions(): Promise<PublicPaymentOptions> {
  return request("/public/payments");
}

export type QrisCharge = { qrString: string; amount: number; expiresAt: number };

/** Creates (or reuses) a gateway QRIS charge for an unpaid self-order. Payment is confirmed by webhook. */
export function startPublicQris(no: number, key: string): Promise<QrisCharge> {
  return request(`/public/orders/${no}/qris`, { method: "POST", ...jsonBody({ key }) });
}
