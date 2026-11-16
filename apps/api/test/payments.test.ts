import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, randomRef, readJson, resetDb, seedCategory, seedProduct, seedTable, sha512Hex, signIn } from "./helpers";

const SERVER_KEY = "SB-Mid-server-test-key";
const GATEWAY_ID = "WAKRO-1-1000";

type Charge = { status: string; transaction_id: string | null };

async function createUnpaidOrder(): Promise<{ no: number; staffSession: string }> {
  const { session } = await signIn("kasir");
  const { data } = await readJson(
    await api("/api/orders", { session, body: { orderType: "bawa-pulang", items: [{ barcode: "A1", qty: 1 }], expectedTotal: 11_100 } }),
  );
  await env.DB.prepare(
    `INSERT INTO payment_charges (gateway_order_id, order_no, amount, qr_string, status, expires_at, created_at, updated_at)
     VALUES (?, ?, 11100, 'qr', 'pending', ?, ?, ?)`,
  )
    .bind(GATEWAY_ID, data.no, Date.now() + 600_000, Date.now(), Date.now())
    .run();
  return { no: data.no, staffSession: session };
}

async function notify(body: Record<string, unknown> = {}, signKey = SERVER_KEY): Promise<Response> {
  const payload = { order_id: GATEWAY_ID, status_code: "200", gross_amount: "11100.00", ...body };
  const signature_key = await sha512Hex(`${payload.order_id}${payload.status_code}${payload.gross_amount}${signKey}`);
  return api("/api/payments/midtrans/notify", { body: { ...payload, signature_key }, headers: { Origin: "" } });
}

function mockMidtransStatus(status: Record<string, unknown>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    Response.json({
      order_id: GATEWAY_ID,
      transaction_status: "settlement",
      transaction_id: "tx-1",
      gross_amount: "11100.00",
      fraud_status: "accept",
      ...status,
    }),
  );
}

const charge = async () =>
  (await env.DB.prepare("SELECT status, transaction_id FROM payment_charges WHERE gateway_order_id = ?").bind(GATEWAY_ID).first<Charge>())!;

const order = (no: number) =>
  env.DB.prepare("SELECT payment_status, method, payment_ref FROM orders WHERE no = ?").bind(no).first<{ payment_status: string; method: string | null; payment_ref: string | null }>();

beforeEach(async () => {
  await resetDb();
  await seedCategory();
  await seedProduct("A1", { price: 10_000 });
  await seedTable();
});

afterEach(() => vi.restoreAllMocks());

describe("Midtrans notification", () => {
  it("rejects a bad signature without calling Midtrans", async () => {
    await createUnpaidOrder();
    const fetchSpy = mockMidtransStatus({});
    const response = await notify({}, "another-server-key");
    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await charge()).status).toBe("pending");
  });

  it("acknowledges notifications for charges it does not know", async () => {
    const fetchSpy = mockMidtransStatus({});
    const response = await notify({ order_id: "SOMEONE-ELSE" });
    expect(response.status).toBe(200);
    expect((await readJson(response)).data).toEqual({ ignored: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requests a retry for an unknown WAKRO charge", async () => {
    expect((await notify()).status).toBe(503);
  });

  it("settles the order after re-reading the transaction, and tolerates a repeated delivery", async () => {
    const { no } = await createUnpaidOrder();
    const fetchSpy = mockMidtransStatus({});
    expect((await notify()).status).toBe(200);
    expect(await order(no)).toEqual({ payment_status: "paid", method: "qris", payment_ref: "tx-1" });
    expect(await charge()).toEqual({ status: "paid", transaction_id: "tx-1" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    expect((await notify()).status).toBe(200);
    expect((await charge()).status).toBe("paid");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps a QRIS payment for an order a cashier already settled as paid_duplicate", async () => {
    const { no, staffSession } = await createUnpaidOrder();
    const cash = await api(`/api/orders/${no}/payment`, { session: staffSession, body: { method: "tunai", cashReceived: 20_000 } });
    expect(cash.status).toBe(200);
    mockMidtransStatus({});

    const response = await notify();
    expect(response.status).toBe(200);
    expect(await charge()).toEqual({ status: "paid_duplicate", transaction_id: "tx-1" });
    expect(await order(no)).toMatchObject({ payment_status: "paid", method: "tunai" });
  });

  it("acknowledges a payment for a refunded order and flags it for refund", async () => {
    const { no } = await createUnpaidOrder();
    await env.DB.prepare("UPDATE orders SET payment_status = 'refunded' WHERE no = ?").bind(no).run();
    mockMidtransStatus({});
    const response = await notify();
    expect(response.status).toBe(200);
    expect((await charge()).status).toBe("paid_duplicate");
    expect((await order(no))!.payment_status).toBe("refunded");
  });

  it("ignores a settlement whose amount differs from the charge", async () => {
    const { no } = await createUnpaidOrder();
    mockMidtransStatus({ gross_amount: "1.00" });
    expect((await notify()).status).toBe(200);
    expect((await charge()).status).toBe("pending");
    expect((await order(no))!.payment_status).toBe("unpaid");
  });

  it("marks expired charges", async () => {
    await createUnpaidOrder();
    mockMidtransStatus({ transaction_status: "expire" });
    expect((await notify()).status).toBe(200);
    expect((await charge()).status).toBe("expired");
  });

  it("answers 502 when Midtrans returns an unusable status body", async () => {
    await createUnpaidOrder();
    mockMidtransStatus({ transaction_status: 42 });
    expect((await notify()).status).toBe(502);
    expect((await charge()).status).toBe("pending");
  });
});

describe("self-order QRIS", () => {
  it("creates a charge for a self-order and reuses the pending QR", async () => {
    await seedTable("table-9", "Meja 9");
    const key = randomRef();
    const placed = await api("/api/public/orders", {
      body: { tableId: "table-9", clientRef: key, items: [{ itemId: "A1", qty: 1 }], expectedTotal: 11_100 },
    });
    expect(placed.status).toBe(201);
    const { data } = await readJson(placed);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({ status_code: "201", qr_string: "000201-QR", transaction_id: "tx-9" }, { status: 201 }),
    );
    const first = await api(`/api/public/orders/${data.no}/qris`, { body: { key } });
    expect(first.status).toBe(201);
    expect((await readJson(first)).data).toMatchObject({ qrString: "000201-QR", amount: 11_100 });
    const second = await api(`/api/public/orders/${data.no}/qris`, { body: { key } });
    expect(second.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("persists the charge before contacting Midtrans and avoids a second charge after a timeout", async () => {
    await seedTable("table-timeout", "Meja Timeout");
    const key = randomRef();
    const placed = await api("/api/public/orders", {
      body: { tableId: "table-timeout", clientRef: key, items: [{ itemId: "A1", qty: 1 }], expectedTotal: 11_100 },
    });
    const { data } = await readJson(placed);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body)) as { transaction_details: { order_id: string } };
      const row = await env.DB.prepare("SELECT status, qr_string FROM payment_charges WHERE gateway_order_id = ?")
        .bind(request.transaction_details.order_id).first<{ status: string; qr_string: string }>();
      expect(row).toEqual({ status: "pending", qr_string: "" });
      throw new Error("timeout");
    });
    expect((await api(`/api/public/orders/${data.no}/qris`, { body: { key } })).status).toBe(500);
    expect((await api(`/api/public/orders/${data.no}/qris`, { body: { key } })).status).toBe(503);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("records a notification received before the charge request returns", async () => {
    await seedTable("table-early", "Meja Early");
    const key = randomRef();
    const placed = await api("/api/public/orders", {
      body: { tableId: "table-early", clientRef: key, items: [{ itemId: "A1", qty: 1 }], expectedTotal: 11_100 },
    });
    const { data } = await readJson(placed);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as { transaction_details: { order_id: string } };
        const response = await notify({ order_id: payload.transaction_details.order_id });
        expect(response.status).toBe(200);
        return Response.json({ status_code: "201", qr_string: "qr", transaction_id: "tx-early" }, { status: 201 });
      }
      const gatewayId = await env.DB.prepare("SELECT gateway_order_id FROM payment_charges WHERE order_no = ?")
        .bind(data.no).first<{ gateway_order_id: string }>();
      return Response.json({ order_id: gatewayId!.gateway_order_id, transaction_status: "settlement", transaction_id: "tx-early", gross_amount: "11100.00", fraud_status: "accept" });
    });
    expect((await api(`/api/public/orders/${data.no}/qris`, { body: { key } })).status).toBe(201);
    expect(await order(data.no)).toMatchObject({ payment_status: "paid", method: "qris", payment_ref: "tx-early" });
    const stored = await env.DB.prepare("SELECT status, transaction_id FROM payment_charges WHERE order_no = ?").bind(data.no).first();
    expect(stored).toEqual({ status: "paid", transaction_id: "tx-early" });
  });
});
