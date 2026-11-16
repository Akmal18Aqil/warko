import { safeEqual, sha256Hex } from "../crypto";
import type { Env } from "../env";
import { HttpError, json, Reader, readJsonObject } from "../http";
import { loadPublicOrder, settleOrder } from "../orders";
import { publicGet, publicPost, type Route, type RouteContext } from "../router";

/**
 * Self-payment QRIS via the Midtrans Core API.
 *
 * Disabled unless MIDTRANS_SERVER_KEY is set. The customer only ever receives a QR string; an order
 * becomes paid exclusively through a Midtrans notification whose signature verifies AND whose status,
 * re-read from the Midtrans API, is settled for exactly the charged amount.
 */

const CHARGE_TTL_MINUTES = 15;
const IDEMPOTENCY_WINDOW_MS = 4 * 60_000;
const PAID_STATUSES: Record<string, true> = { settlement: true, capture: true };
const FAILED_STATUSES: Record<string, true> = { deny: true, cancel: true, expire: true, failure: true };

type ChargeRow = { gateway_order_id: string; amount: number; qr_string: string; status: string; expires_at: number; created_at: number };

function serverKey(env: Env): string | null {
  return env.MIDTRANS_SERVER_KEY && env.MIDTRANS_SERVER_KEY.length >= 10 ? env.MIDTRANS_SERVER_KEY : null;
}

function apiBase(env: Env): string {
  if (env.MIDTRANS_API_BASE) return env.MIDTRANS_API_BASE.replace(/\/+$/, "");
  return env.MIDTRANS_IS_PRODUCTION === "true" ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
}

function badGateway(): HttpError {
  return new HttpError(502, "Layanan QRIS sedang tidak tersedia. Silakan bayar di kasir.");
}

/** Calls the Midtrans API and returns its JSON body as an object; shape checks happen in the parsers below. */
async function midtrans(env: Env, key: string, path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Basic ${btoa(`${key}:`)}`);
  const response = await fetch(`${apiBase(env)}${path}`, {
    ...init,
    headers,
  });
  if (response.status === 202) throw new HttpError(503, "QRIS sedang diproses. Coba lagi sebentar.");
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof body !== "object" || body === null || Array.isArray(body)) {
    console.error("Midtrans API error", response.status, body);
    throw badGateway();
  }
  return body as Record<string, unknown>;
}

/** A field that Midtrans documents as a string; anything else is treated as absent. */
function text(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];
  return typeof value === "string" ? value : undefined;
}

type MidtransCharge = {
  statusCode: string | undefined;
  statusMessage: string | undefined;
  qrString: string | undefined;
  transactionId: string | undefined;
};

function parseCharge(body: Record<string, unknown>): MidtransCharge {
  return {
    statusCode: text(body, "status_code"),
    statusMessage: text(body, "status_message"),
    qrString: text(body, "qr_string"),
    transactionId: text(body, "transaction_id"),
  };
}

type MidtransStatus = {
  orderId: string | undefined;
  transactionStatus: string;
  transactionId: string | undefined;
  grossAmount: string | undefined;
  fraudStatus: string | undefined;
};

function parseStatus(body: Record<string, unknown>): MidtransStatus {
  const transactionStatus = text(body, "transaction_status");
  if (transactionStatus === undefined) {
    console.error("Midtrans status response without transaction_status", body);
    throw badGateway();
  }
  return {
    orderId: text(body, "order_id"),
    transactionStatus,
    transactionId: text(body, "transaction_id"),
    grossAmount: text(body, "gross_amount"),
    fraudStatus: text(body, "fraud_status"),
  };
}

async function sha512Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-512", new TextEncoder().encode(value)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function requestCharge(env: Env, key: string, no: number, amount: number, gatewayOrderId: string): Promise<MidtransCharge> {
  const idempotencyKey = (await sha256Hex(`qris-charge:${gatewayOrderId}`)).slice(0, 40);
  const charge = parseCharge(
    await midtrans(env, key, "/v2/charge", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        payment_type: "qris",
        transaction_details: { order_id: gatewayOrderId, gross_amount: amount },
        item_details: [{ id: `order-${no}`, price: amount, quantity: 1, name: `Pesanan #${no} WAKRO` }],
        custom_expiry: { expiry_duration: CHARGE_TTL_MINUTES, unit: "minute" },
      }),
    }),
  );
  if (charge.statusCode === "202") throw new HttpError(503, "QRIS sedang diproses. Coba lagi sebentar.");
  if (charge.statusCode !== "201" || !charge.qrString) {
    console.error("Midtrans QRIS charge rejected", charge.statusCode, charge.statusMessage);
    throw badGateway();
  }
  await env.DB.prepare(
    "UPDATE payment_charges SET qr_string = ?, transaction_id = COALESCE(transaction_id, ?), updated_at = ? WHERE gateway_order_id = ?",
  )
    .bind(charge.qrString, charge.transactionId ?? null, Date.now(), gatewayOrderId)
    .run();
  return charge;
}

/** POST /api/public/orders/{no}/qris — returns the pending QR for this order or creates a new charge. */
async function startQris({ request, env, params }: RouteContext): Promise<Response> {
  const key = serverKey(env);
  if (!key) throw new HttpError(404, "Pembayaran QRIS belum diaktifkan. Silakan bayar di kasir.");
  const no = Number(params.no);
  const r = new Reader(await readJsonObject(request));
  const customerKey = r.string("key", { max: 100, min: 1 });
  r.done();

  const order = await loadPublicOrder(env, no, customerKey);
  if (order.paymentStatus !== "unpaid") throw new HttpError(409, "Pesanan ini sudah lunas.");

  const now = Date.now();
  const pending = await env.DB.prepare(
    `SELECT gateway_order_id, amount, qr_string, status, expires_at, created_at FROM payment_charges
     WHERE order_no = ? AND status = 'pending' AND (expires_at > ? OR qr_string = '') AND amount = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(no, now, order.total)
    .first<ChargeRow>();
  if (pending) {
    if (!pending.qr_string) {
      if (now - pending.created_at < IDEMPOTENCY_WINDOW_MS) {
        const charge = await requestCharge(env, key, no, pending.amount, pending.gateway_order_id);
        return json({ data: { qrString: charge.qrString, amount: pending.amount, expiresAt: pending.expires_at } });
      }
      const status = parseStatus(await midtrans(env, key, `/v2/${encodeURIComponent(pending.gateway_order_id)}/status`));
      if (status.orderId !== pending.gateway_order_id || Number(status.grossAmount) !== pending.amount) throw badGateway();
      if (PAID_STATUSES[status.transactionStatus] && status.fraudStatus !== "deny") {
        const outcome = await settleCharge(env, no, status.transactionId ?? pending.gateway_order_id);
        await env.DB.prepare(
          "UPDATE payment_charges SET status = ?, transaction_id = ?, updated_at = ? WHERE gateway_order_id = ? AND status = 'pending'",
        )
          .bind(outcome, status.transactionId ?? null, Date.now(), pending.gateway_order_id)
          .run();
        throw new HttpError(409, outcome === "paid" ? "Pesanan ini sudah lunas." : "Pembayaran QRIS ganda terdeteksi. Hubungi kasir.");
      }
      if (FAILED_STATUSES[status.transactionStatus]) {
        await env.DB.prepare("UPDATE payment_charges SET status = ?, updated_at = ? WHERE gateway_order_id = ? AND status = 'pending'")
          .bind(status.transactionStatus === "expire" ? "expired" : "failed", Date.now(), pending.gateway_order_id)
          .run();
        throw new HttpError(409, "QRIS sebelumnya gagal atau kedaluwarsa. Coba buat QRIS baru.");
      }
      throw new HttpError(503, "QRIS sedang diproses. Coba lagi nanti atau bayar di kasir.");
    }
    return json({ data: { qrString: pending.qr_string, amount: pending.amount, expiresAt: pending.expires_at } });
  }

  const gatewayOrderId = `WAKRO-${no}-${crypto.randomUUID()}`;
  const expiresAt = now + CHARGE_TTL_MINUTES * 60_000;
  const intent = await env.DB.prepare(
    `INSERT INTO payment_charges (gateway_order_id, order_no, amount, qr_string, status, expires_at, created_at, updated_at)
     SELECT ?, ?, ?, '', 'pending', ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM payment_charges WHERE order_no = ? AND status = 'pending' AND (expires_at > ? OR qr_string = '')
     )`,
  )
    .bind(gatewayOrderId, no, order.total, expiresAt, now, now, no, now)
    .run();
  if (!intent.meta.changes) throw new HttpError(503, "QRIS sedang diproses. Coba lagi nanti atau bayar di kasir.");
  const charge = await requestCharge(env, key, no, order.total, gatewayOrderId);
  return json({ data: { qrString: charge.qrString, amount: order.total, expiresAt } }, 201);
}

/**
 * Settles the order for a verified QRIS payment. Returns `paid_duplicate` when the money was captured
 * but the order cannot take it (a cashier settled it first, or it was refunded): the charge is kept
 * in that state so it can be refunded in Midtrans instead of silently disappearing.
 */
async function settleCharge(env: Env, orderNo: number, paymentRef: string): Promise<"paid" | "paid_duplicate"> {
  try {
    const settled = await settleOrder(env, orderNo, { method: "qris", cashReceived: null, paidBy: "QRIS Midtrans", paymentRef });
    if (!settled.alreadyPaid) return "paid";
    // A repeated or concurrent delivery of the same notification finds its own payment already recorded.
    const row = await env.DB.prepare("SELECT payment_ref FROM orders WHERE no = ?").bind(orderNo).first<{ payment_ref: string | null }>();
    return row?.payment_ref === paymentRef ? "paid" : "paid_duplicate";
  } catch (error) {
    const row = await env.DB.prepare("SELECT payment_status FROM orders WHERE no = ?").bind(orderNo).first<{ payment_status: string }>();
    if (error instanceof HttpError && row?.payment_status === "refunded") return "paid_duplicate";
    throw error;
  }
}

/** POST /api/payments/midtrans/notify — Midtrans HTTP notification (server-to-server). */
async function handleNotification({ request, env }: RouteContext): Promise<Response> {
  const key = serverKey(env);
  if (!key) throw new HttpError(404, "Endpoint tidak ditemukan.");
  const body = await readJsonObject(request);
  const { order_id: orderId, status_code: statusCode, gross_amount: grossAmount, signature_key: signature } = body;
  if (typeof orderId !== "string" || typeof statusCode !== "string" || typeof grossAmount !== "string" || typeof signature !== "string") {
    throw new HttpError(400, "Notifikasi tidak valid.");
  }
  if (!(await safeEqual(await sha512Hex(`${orderId}${statusCode}${grossAmount}${key}`), signature))) {
    throw new HttpError(401, "Signature tidak valid.");
  }

  const charge = await env.DB.prepare("SELECT gateway_order_id, order_no, amount, status FROM payment_charges WHERE gateway_order_id = ?")
    .bind(orderId)
    .first<{ gateway_order_id: string; order_no: number; amount: number; status: string }>();
  if (!charge) {
    if (orderId.startsWith("WAKRO-")) {
      console.error("QRIS notification has no matching charge", orderId);
      throw new HttpError(503, "Transaksi QRIS belum tersedia untuk diproses.");
    }
    return json({ data: { ignored: true } });
  }
  // Midtrans repeats notifications; a charge that already reached a paid state is done.
  if (charge.status === "paid" || charge.status === "paid_duplicate") return json({ data: { received: true } });

  // Never trust the notification body for the outcome: re-read the transaction from Midtrans.
  const status = parseStatus(await midtrans(env, key, `/v2/${encodeURIComponent(orderId)}/status`));
  const amount = Number.parseFloat(status.grossAmount ?? "NaN");
  const now = Date.now();

  if (PAID_STATUSES[status.transactionStatus] && status.fraudStatus !== "deny") {
    if (status.orderId !== orderId || amount !== charge.amount) {
      console.error("Midtrans amount/order mismatch", orderId, status.grossAmount, charge.amount);
      return json({ data: { ignored: true } });
    }
    const outcome = await settleCharge(env, charge.order_no, status.transactionId ?? orderId);
    if (outcome === "paid_duplicate") {
      console.error("QRIS payment captured for an order that was already settled; refund it in Midtrans", orderId, charge.order_no);
    }
    await env.DB.prepare("UPDATE payment_charges SET status = ?, transaction_id = ?, updated_at = ? WHERE gateway_order_id = ?")
      .bind(outcome, status.transactionId ?? null, now, orderId)
      .run();
  } else if (FAILED_STATUSES[status.transactionStatus]) {
    await env.DB.prepare("UPDATE payment_charges SET status = ?, updated_at = ? WHERE gateway_order_id = ? AND status = 'pending'")
      .bind(status.transactionStatus === "expire" ? "expired" : "failed", now, orderId)
      .run();
  }
  return json({ data: { received: true } });
}

export const paymentRoutes: Route[] = [
  publicGet("/api/public/payments", async ({ env }) => json({ data: { qris: serverKey(env) !== null } })),
  publicPost("/api/public/orders/:no(\\d{1,15})/qris", startQris),
  // Server-to-server callback: authenticated by the Midtrans signature, not by a browser origin.
  publicPost("/api/payments/midtrans/notify", handleNotification, false),
];
