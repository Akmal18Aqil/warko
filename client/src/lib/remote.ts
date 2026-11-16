import type { MenuItem } from "../data/menu";
import type {
  CashMovementRow,
  CategoryRow,
  KitchenStatus,
  OrderRow,
  PayMethod,
  ShiftRecord,
  TableRow,
} from "./db";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export const isRemoteDataSource = import.meta.env.VITE_DATA_SOURCE === "remote";
export const isPublicCustomer = isRemoteDataSource && /^\/order(?:\/|$)/.test(window.location.pathname);

export class RemoteDataError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "RemoteDataError";
  }
}

export type PricingSettings = {
  taxEnabled: boolean;
  taxRate: number;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
};

type ApiEnvelope<T> = { data: T; replayed?: boolean; alreadyPaid?: boolean };

async function requestEnvelope<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new RemoteDataError("Server data tidak dapat dijangkau. Periksa koneksi lalu coba lagi.", error);
  }

  if (!response.ok) {
    // Server messages are user-facing Indonesian text (stock shortages, changed totals, validation).
    let message = `Server data mengembalikan HTTP ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: unknown; errors?: Record<string, unknown> };
      const firstFieldError = body.errors ? Object.values(body.errors).flat().find((e) => typeof e === "string") : undefined;
      if (typeof body.message === "string") {
        message = body.message === "Data yang dikirim tidak valid." && typeof firstFieldError === "string" ? firstFieldError : body.message;
      }
    } catch {
      // Non-JSON error body: keep the HTTP status message.
    }
    throw new RemoteDataError(message, undefined, response.status);
  }

  return (await response.json()) as ApiEnvelope<T>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await requestEnvelope<T>(path, init)).data;
}

export function loadRemotePricing(): Promise<PricingSettings> {
  return request<PricingSettings>("/pricing");
}

export function saveRemotePricing(pricing: PricingSettings): Promise<PricingSettings> {
  return request<PricingSettings>("/pricing", { method: "PUT", body: JSON.stringify(pricing) });
}

export function loadPublicMenu(): Promise<{ products: MenuItem[]; tables: TableRow[]; pricing: PricingSettings }> {
  return request("/public/menu");
}

/** Self-order: `clientRef` is the customer's random key (idempotency + status/e-receipt access). */
export function createPublicOrder(input: {
  tableId: string;
  customerName: string;
  items: { itemId: string; qty: number; note?: string }[];
  expectedTotal: number;
  clientRef: string;
}): Promise<OrderRow> {
  return request("/public/orders", { method: "POST", body: JSON.stringify({ ...input, paymentChoice: "pay-later" }) });
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
  return request(`/public/orders/${no}/qris`, { method: "POST", body: JSON.stringify({ key }) });
}

export type RemoteResource = "products" | "tables" | "categories" | "shifts" | "cashMovements";

export function loadRemoteResource<T>(resource: RemoteResource): Promise<T[]> {
  return request<T[]>(`/resources/${resource}`);
}

export function saveRemoteResource<T>(resource: RemoteResource, id: string, value: T): Promise<T> {
  return request<T>(`/resources/${resource}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(value),
  });
}

export function deleteRemoteResource(resource: RemoteResource, id: string, reassignTo?: string): Promise<boolean> {
  const query = reassignTo ? `?${new URLSearchParams({ reassignTo })}` : "";
  return request<boolean>(`/resources/${resource}/${encodeURIComponent(id)}${query}`, { method: "DELETE" });
}

export async function loadRemoteProducts(): Promise<MenuItem[]> {
  return request<MenuItem[]>("/products");
}

export async function loadRemoteOrders(): Promise<OrderRow[]> {
  return request<OrderRow[]>("/orders");
}

export type RemoteSnapshot = {
  products: MenuItem[];
  orders: OrderRow[];
  tables: TableRow[];
  categories: CategoryRow[];
  shifts: ShiftRecord[];
  cashMovements: CashMovementRow[];
  pricing: PricingSettings;
};

export async function loadRemoteSnapshot(): Promise<RemoteSnapshot> {
  return request<RemoteSnapshot>("/bootstrap");
}

export type OrderSubmitOptions = {
  /** Idempotency key: a retried submit returns the first order instead of creating a duplicate. */
  clientRef: string;
  cashReceived?: number;
};

/** Persists the order; the server assigns the number, prices, stock and payment fields. */
export function saveRemoteOrder(row: OrderRow, options: OrderSubmitOptions): Promise<OrderRow> {
  return request<OrderRow>("/orders", {
    method: "POST",
    body: JSON.stringify({
      kitchenStatus: row.kitchenStatus,
      orderType: row.orderType,
      tableId: row.tableId,
      tableName: row.tableName,
      guests: row.guests,
      customerName: row.customerName,
      source: row.source,
      paymentChoice: row.paymentChoice,
      discount: row.discount,
      method: row.paymentStatus === "paid" ? row.method : undefined,
      cashReceived: row.paymentStatus === "paid" && row.method === "tunai" ? options.cashReceived : undefined,
      expectedTotal: row.total,
      clientRef: options.clientRef,
      items: (row.items || []).map((item) => ({
        barcode: item.itemId,
        qty: item.qty,
        note: item.note,
      })),
    }),
  });
}

export async function settleRemoteOrder(
  no: number,
  method: PayMethod,
  cashReceived?: number,
): Promise<{ order: OrderRow; alreadyPaid: boolean }> {
  const envelope = await requestEnvelope<OrderRow>(`/orders/${no}/payment`, {
    method: "POST",
    body: JSON.stringify({ method, cashReceived }),
  });
  return { order: envelope.data, alreadyPaid: envelope.alreadyPaid === true };
}

export function updateRemoteKitchenStatus(no: number, kitchenStatus: KitchenStatus): Promise<OrderRow> {
  return request<OrderRow>(`/orders/${no}/status`, {
    method: "PATCH",
    body: JSON.stringify({ kitchenStatus }),
  });
}

/** `mode: "set"` with `qty: null` stops tracking stock for the product. */
export function adjustRemoteStock(barcode: string, mode: "set" | "add", qty: number | null): Promise<MenuItem> {
  return request<MenuItem>(`/products/${encodeURIComponent(barcode)}/stock`, {
    method: "POST",
    body: JSON.stringify({ mode, qty }),
  });
}

export function loadRemoteReportOrders(from: number, to: number): Promise<OrderRow[]> {
  return request<OrderRow[]>(`/reports/orders?${new URLSearchParams({ from: String(from), to: String(to) })}`);
}
