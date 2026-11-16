import type { Env } from "./env";
import { errorResponse, HttpError, json, readJsonObject, Reader } from "./http";
import { loadPublicOrder, settleOrder } from "./orders";

/**
 * Self-payment QRIS via the Midtrans Core API.
 *
 * Disabled unless MIDTRANS_SERVER_KEY is set. The customer only ever receives a QR string; an order
 * becomes paid exclusively through a Midtrans notification whose signature verifies AND whose status,
 * re-read from the Midtrans API, is settled for exactly the charged amount.
 */

const CHARGE_TTL_MINUTES = 15;
const PUBLIC_QRIS_PATH = /^\/api\/public\/orders\/(\d{1,15})\/qris$/;
const NOTIFY_PATH = "/api/payments/midtrans/notify";
const PAID_STATUSES: Record<string, true> = { settlement: true, capture: true };
const FAILED_STATUSES: Record<string, true> = { deny: true, cancel: true, expire: true, failure: true };

type ChargeRow = { gateway_order_id: string; amount: number; qr_string: string; status: string; expires_at: number };

function serverKey(env: Env): string | null {
  return env.MIDTRANS_SERVER_KEY && env.MIDTRANS_SERVER_KEY.length >= 10 ? env.MIDTRANS_SERVER_KEY : null;
}

function apiBase(env: Env): string {
  if (env.MIDTRANS_API_BASE) return env.MIDTRANS_API_BASE.replace(/\/+$/, "");
  return env.MIDTRANS_IS_PRODUCTION === "true" ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
}

async function midtrans<T>(env: Env, key: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase(env)}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(`${key}:`)}`,
    },
  });
  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || body === null) {
    console.error("Midtrans API error", response.status, body);
    throw new HttpError(502, "Layanan QRIS sedang tidak tersedia. Silakan bayar di kasir.");
  }
  return body;
}

async function sha512Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

type MidtransCharge = {
  status_code?: string;
  status_message?: string;
  qr_string?: string;
  transaction_id?: string;
};

/** POST /api/public/orders/{no}/qris — returns the pending QR for this order or creates a new charge. */
async function startQris(env: Env, request: Request, no: number): Promise<Response> {
  const key = serverKey(env);
  if (!key) throw new HttpError(404, "Pembayaran QRIS belum diaktifkan. Silakan bayar di kasir.");
  const r = new Reader(await readJsonObject(request));
  const customerKey = r.string("key", { max: 100, min: 1 });
  r.done();

  const order = await loadPublicOrder(env, no, customerKey);
  if (order.paymentStatus !== "unpaid") throw new HttpError(409, "Pesanan ini sudah lunas.");

  const now = Date.now();
  const pending = await env.DB.prepare(
    `SELECT gateway_order_id, amount, qr_string, status, expires_at FROM payment_charges
     WHERE order_no = ? AND status = 'pending' AND expires_at > ? AND amount = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(no, now + 60_000, order.total)
    .first<ChargeRow>();
  if (pending) return json({ data: { qrString: pending.qr_string, amount: pending.amount, expiresAt: pending.expires_at } });

  const gatewayOrderId = `WAKRO-${no}-${now}`;
  const charge = await midtrans<MidtransCharge>(env, key, "/v2/charge", {
    method: "POST",
    body: JSON.stringify({
      payment_type: "qris",
      transaction_details: { order_id: gatewayOrderId, gross_amount: order.total },
      item_details: [{ id: `order-${no}`, price: order.total, quantity: 1, name: `Pesanan #${no} WAKRO` }],
      custom_expiry: { expiry_duration: CHARGE_TTL_MINUTES, unit: "minute" },
    }),
  });
  if (charge.status_code !== "201" || !charge.qr_string) {
    console.error("Midtrans QRIS charge rejected", charge.status_code, charge.status_message);
    throw new HttpError(502, "QRIS gagal dibuat. Silakan bayar di kasir.");
  }
  const expiresAt = now + CHARGE_TTL_MINUTES * 60_000;
  await env.DB.prepare(
    `INSERT INTO payment_charges (gateway_order_id, order_no, amount, qr_string, status, transaction_id, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
  )
    .bind(gatewayOrderId, no, order.total, charge.qr_string, charge.transaction_id ?? null, expiresAt, now, now)
    .run();
  return json({ data: { qrString: charge.qr_string, amount: order.total, expiresAt } }, 201);
}

type MidtransStatus = {
  order_id?: string;
  transaction_status?: string;
  transaction_id?: string;
  gross_amount?: string;
  payment_type?: string;
  fraud_status?: string;
};

/** POST /api/payments/midtrans/notify — Midtrans HTTP notification (server-to-server). */
async function handleNotification(env: Env, request: Request): Promise<Response> {
  const key = serverKey(env);
  if (!key) throw new HttpError(404, "Endpoint tidak ditemukan.");
  const body = await readJsonObject(request);
  const { order_id: orderId, status_code: statusCode, gross_amount: grossAmount, signature_key: signature } = body;
  if (typeof orderId !== "string" || typeof statusCode !== "string" || typeof grossAmount !== "string" || typeof signature !== "string") {
    throw new HttpError(400, "Notifikasi tidak valid.");
  }
  const expected = await sha512Hex(`${orderId}${statusCode}${grossAmount}${key}`);
  if (expected.length !== signature.length || !crypto.subtle.timingSafeEqual(new TextEncoder().encode(expected), new TextEncoder().encode(signature))) {
    throw new HttpError(401, "Signature tidak valid.");
  }

  const charge = await env.DB.prepare("SELECT gateway_order_id, order_no, amount, status FROM payment_charges WHERE gateway_order_id = ?")
    .bind(orderId)
    .first<{ gateway_order_id: string; order_no: number; amount: number; status: string }>();
  // Unknown charge (e.g. another app on the same Midtrans account): acknowledge so it is not retried.
  if (!charge) return json({ data: { ignored: true } });

  // Never trust the notification body for the outcome: re-read the transaction from Midtrans.
  const status = await midtrans<MidtransStatus>(env, key, `/v2/${encodeURIComponent(orderId)}/status`);
  const txStatus = status.transaction_status ?? "";
  const amount = Number.parseFloat(status.gross_amount ?? "NaN");
  const now = Date.now();

  if (PAID_STATUSES[txStatus] && status.fraud_status !== "deny") {
    if (status.order_id !== orderId || amount !== charge.amount) {
      console.error("Midtrans amount/order mismatch", orderId, status.gross_amount, charge.amount);
      return json({ data: { ignored: true } });
    }
    await settleOrder(env, charge.order_no, {
      method: "qris",
      cashReceived: null,
      paidBy: "QRIS Midtrans",
      paymentRef: status.transaction_id ?? orderId,
    });
    await env.DB.prepare("UPDATE payment_charges SET status = 'paid', transaction_id = ?, updated_at = ? WHERE gateway_order_id = ?")
      .bind(status.transaction_id ?? null, now, orderId)
      .run();
  } else if (FAILED_STATUSES[txStatus]) {
    await env.DB.prepare("UPDATE payment_charges SET status = ?, updated_at = ? WHERE gateway_order_id = ? AND status = 'pending'")
      .bind(txStatus === "expire" ? "expired" : "failed", now, orderId)
      .run();
  }
  return json({ data: { received: true } });
}

function assertSameOrigin(request: Request, url: URL): void {
  const origin = request.headers.get("Origin");
  if (origin !== null ? origin !== url.origin : !["same-origin", "none"].includes(request.headers.get("Sec-Fetch-Site") ?? "")) {
    throw new HttpError(403, "Permintaan lintas-origin ditolak.");
  }
}

export async function handlePayments(request: Request, env: Env, url: URL): Promise<Response | null> {
  const path = url.pathname.replace(/\/+$/, "");
  const qrisMatch = PUBLIC_QRIS_PATH.exec(path);
  if (path !== "/api/public/payments" && path !== NOTIFY_PATH && !qrisMatch) return null;
  try {
    if (path === "/api/public/payments") {
      if (request.method !== "GET") throw new HttpError(405, "Metode tidak diizinkan.", undefined, { Allow: "GET" });
      return json({ data: { qris: serverKey(env) !== null } });
    }
    if (request.method !== "POST") throw new HttpError(405, "Metode tidak diizinkan.", undefined, { Allow: "POST" });
    if (path === NOTIFY_PATH) return await handleNotification(env, request);
    assertSameOrigin(request, url);
    return await startQris(env, request, Number(qrisMatch![1]));
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error);
    throw error;
  }
}
