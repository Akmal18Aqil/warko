// Minimal Midtrans Core API stand-in for UAT: QRIS charge + transaction status, steerable over /__control.

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

/** gateway order id -> { amount, status, grossOverride, transactionId } */
const charges = new Map();
let down = false;

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export function startMidtransMock(port) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://mock");
    if (url.pathname === "/__control" && req.method === "POST") {
      const body = await readBody(req);
      if (typeof body.down === "boolean") down = body.down;
      if (body.orderId) {
        const charge = charges.get(body.orderId);
        if (!charge) return send(res, 404, { error: "unknown charge" });
        if (body.status) charge.status = body.status;
        if (body.grossAmount !== undefined) charge.grossOverride = body.grossAmount;
      }
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/__charges")
      return send(
        res,
        200,
        [...charges.entries()].map(([orderId, c]) => ({ orderId, ...c })),
      );
    if (down) return send(res, 500, { status_code: "500", status_message: "mock down" });

    if (url.pathname === "/v2/charge" && req.method === "POST") {
      const body = await readBody(req);
      const orderId = body.transaction_details.order_id;
      const existing = charges.get(orderId);
      const charge = existing ?? {
        amount: body.transaction_details.gross_amount,
        status: "pending",
        grossOverride: null,
        transactionId: randomUUID(),
      };
      charges.set(orderId, charge);
      return send(res, 200, {
        status_code: "201",
        status_message: "QRIS transaction is created",
        transaction_id: charge.transactionId,
        order_id: orderId,
        qr_string: `00020101021226670016COM.MIDTRANS.MOCK${orderId}5204581253033605802ID6304ABCD`,
      });
    }
    const status = /^\/v2\/(.+)\/status$/.exec(url.pathname);
    if (status && req.method === "GET") {
      const orderId = decodeURIComponent(status[1]);
      const charge = charges.get(orderId);
      if (!charge) return send(res, 404, { status_code: "404", status_message: "not found" });
      const gross = charge.grossOverride ?? charge.amount;
      return send(res, 200, {
        status_code: charge.status === "settlement" ? "200" : "201",
        order_id: orderId,
        transaction_id: charge.transactionId,
        transaction_status: charge.status,
        gross_amount: `${Number(gross).toFixed(2)}`,
        fraud_status: "accept",
      });
    }
    send(res, 404, { status_code: "404" });
  });
  server.listen(port, "127.0.0.1");
  return server;
}
