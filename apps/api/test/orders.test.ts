import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { placeOrder } from "../src/orders";
import type { Env } from "../src/env";
import { api, randomRef, readJson, resetDb, seedCategory, seedProduct, seedTable, signIn } from "./helpers";

// Default pricing: 11% tax, no service charge. Two portions of a 10.000 menu = 20.000 + 2.200.
const TOTAL_FOR_TWO = 22_200;

function orderBody(extra: Record<string, unknown> = {}) {
  return {
    orderType: "bawa-pulang",
    items: [{ barcode: "A1", qty: 2 }],
    expectedTotal: TOTAL_FOR_TWO,
    ...extra,
  };
}

async function stockOf(barcode: string): Promise<number | null> {
  const row = await env.DB.prepare("SELECT stock FROM products WHERE barcode = ?").bind(barcode).first<{ stock: number | null }>();
  return row!.stock;
}

async function orderCount(): Promise<number> {
  return (await env.DB.prepare("SELECT COUNT(*) AS n FROM orders").first<{ n: number }>())!.n;
}

beforeEach(async () => {
  await resetDb();
  await seedCategory();
  await seedProduct("A1", { price: 10_000, stock: 5 });
  await seedProduct("B1", { price: 5_000 });
  await seedTable();
});

describe("placing orders", () => {
  it("prices the order on the server and decrements tracked stock", async () => {
    const { session } = await signIn("kasir");
    const response = await api("/api/orders", { session, body: orderBody() });
    expect(response.status).toBe(201);
    const { data, replayed } = await readJson(response);
    expect(replayed).toBe(false);
    expect(data).toMatchObject({ subtotal: 20_000, tax: 2_200, total: TOTAL_FOR_TWO, paymentStatus: "unpaid", kitchenStatus: "queued" });
    expect(data.items).toEqual([{ itemId: "A1", name: "Menu A1", qty: 2, price: 10_000, note: null }]);
    expect(await stockOf("A1")).toBe(3);
    const log = await env.DB.prepare("SELECT delta, stock_after, reason, order_no FROM stock_movements").first();
    expect(log).toEqual({ delta: -2, stock_after: 3, reason: "sale", order_no: data.no });
  });

  it.each([null, 5])("rejects an order when stock tracking changes after the read (stock=%s)", async (initialStock) => {
    await env.DB.prepare("UPDATE products SET stock = ? WHERE barcode = 'A1'").bind(initialStock).run();
    let batchCount = 0;
    const db = new Proxy(env.DB, {
      get(target, property) {
        if (property === "batch") {
          return async (statements: D1PreparedStatement[]) => {
            if (++batchCount === 2) {
              await target.prepare("UPDATE products SET stock = ? WHERE barcode = 'A1'")
                .bind(initialStock === null ? 5 : null).run();
            }
            return target.batch(statements);
          };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const input = {
      lines: [{ barcode: "A1", qty: 2, note: null }], discount: 0, orderType: "bawa-pulang" as const,
      tableId: null, tableName: null, guests: null, customerName: null, waiterId: null, waiterName: null,
      source: "pos" as const, paymentChoice: "pay-later" as const, kitchenStatus: "queued" as const,
      payment: null, expectedTotal: TOTAL_FOR_TWO, clientRefHash: null, staffName: null,
    };
    await expect(placeOrder({ ...env, DB: db } as Env, input)).rejects.toMatchObject({ status: 409 });
    expect(await orderCount()).toBe(0);
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM stock_movements").first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it("rejects an order whose expected total no longer matches", async () => {
    const { session } = await signIn("kasir");
    const response = await api("/api/orders", { session, body: orderBody({ expectedTotal: 20_000 }) });
    expect(response.status).toBe(409);
    expect(await orderCount()).toBe(0);
    expect(await stockOf("A1")).toBe(5);
  });

  it("refuses to oversell and leaves stock untouched", async () => {
    const { session } = await signIn("kasir");
    const response = await api("/api/orders", {
      session,
      body: orderBody({ items: [{ barcode: "A1", qty: 6 }], expectedTotal: 66_600 }),
    });
    expect(response.status).toBe(409);
    expect((await readJson(response)).message).toContain("Stok tidak mencukupi");
    expect(await stockOf("A1")).toBe(5);
    expect(await orderCount()).toBe(0);
  });

  it("answers a repeated clientRef with the first order instead of a duplicate", async () => {
    const { session } = await signIn("kasir");
    const clientRef = randomRef();
    const first = await api("/api/orders", { session, body: orderBody({ clientRef }) });
    const second = await api("/api/orders", { session, body: orderBody({ clientRef }) });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const a = await readJson(first);
    const b = await readJson(second);
    expect(b.replayed).toBe(true);
    expect(b.data.no).toBe(a.data.no);
    expect(await orderCount()).toBe(1);
    expect(await stockOf("A1")).toBe(3);
  });

  it("numbers concurrent orders without collisions", async () => {
    const { session } = await signIn("kasir");
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        api("/api/orders", { session, body: orderBody({ items: [{ barcode: "B1", qty: 1 }], expectedTotal: 5_550 }) }),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual(Array(6).fill(201));
    const numbers = (await Promise.all(responses.map(async (r) => (await readJson(r)).data.no))) as number[];
    expect(new Set(numbers).size).toBe(6);
    expect(Math.max(...numbers) - Math.min(...numbers)).toBe(5);
  });

  it("rejects a dine-in order for an inactive table without writing anything", async () => {
    await env.DB.prepare("UPDATE restaurant_tables SET active = 0").run();
    const { session } = await signIn("kasir");
    const response = await api("/api/orders", { session, body: orderBody({ orderType: "meja", tableId: "table-1" }) });
    expect(response.status).toBe(422);
    expect(await orderCount()).toBe(0);
    expect(await stockOf("A1")).toBe(5);
  });

  it("only lets admin and kasir give a discount", async () => {
    const waiter = await signIn("pelayan");
    const denied = await api("/api/orders", { session: waiter.session, body: orderBody({ discount: 5_000, expectedTotal: 16_650 }) });
    expect(denied.status).toBe(403);
    expect(await orderCount()).toBe(0);

    const cashier = await signIn("kasir");
    const allowed = await api("/api/orders", { session: cashier.session, body: orderBody({ discount: 5_000, expectedTotal: 16_650 }) });
    expect(allowed.status).toBe(201);
    expect((await readJson(allowed)).data).toMatchObject({ discount: 5_000, subtotal: 15_000, total: 16_650 });
  });

  it("lets a waiter order without a discount", async () => {
    const waiter = await signIn("pelayan");
    const response = await api("/api/orders", { session: waiter.session, body: orderBody({ source: "waiter" }) });
    expect(response.status).toBe(201);
    expect((await readJson(response)).data).toMatchObject({ waiterName: waiter.name, source: "waiter" });
  });
});

describe("public self-order retry", () => {
  it("replays the original order after a lost response even if its price changes", async () => {
    const clientRef = randomRef();
    const body = { tableId: "table-1", clientRef, items: [{ itemId: "A1", qty: 1 }], expectedTotal: 11_100 };
    const first = await api("/api/public/orders", { body });
    expect(first.status).toBe(201);
    const original = await readJson(first);
    await env.DB.prepare("UPDATE products SET price = 20000 WHERE barcode = 'A1'").run();
    const retry = await api("/api/public/orders", { body });
    expect(retry.status).toBe(200);
    const replay = await readJson(retry);
    expect(replay.replayed).toBe(true);
    expect(replay.data.no).toBe(original.data.no);
    expect(replay.data.total).toBe(11_100);
    expect(await orderCount()).toBe(1);
    expect(await stockOf("A1")).toBe(4);
  });
});

describe("kitchen status", () => {
  async function newOrder(): Promise<{ no: number; session: string }> {
    const { session } = await signIn("kasir");
    const { data } = await readJson(await api("/api/orders", { session, body: orderBody() }));
    return { no: data.no, session };
  }

  const setStatus = (session: string, no: number, kitchenStatus: string) =>
    api(`/api/orders/${no}/status`, { session, method: "PATCH", body: { kitchenStatus } });

  it("moves forward, including skipping steps", async () => {
    const { no, session } = await newOrder();
    expect((await setStatus(session, no, "preparing")).status).toBe(200);
    expect((await setStatus(session, no, "served")).status).toBe(200);
  });

  it("refuses to move backwards", async () => {
    const { no, session } = await newOrder();
    await setStatus(session, no, "ready");
    const response = await setStatus(session, no, "queued");
    expect(response.status).toBe(409);
    const row = await env.DB.prepare("SELECT kitchen_status FROM orders WHERE no = ?").bind(no).first();
    expect(row).toEqual({ kitchen_status: "ready" });
  });

  it("answers 404 for an unknown order", async () => {
    const { session } = await signIn("kasir");
    expect((await setStatus(session, 999_999, "ready")).status).toBe(404);
  });
});

describe("catalog", () => {
  it("looks a product up by barcode", async () => {
    const { session } = await signIn("pelayan");
    const found = await readJson(await api("/api/products?barcode=A1", { session }));
    expect(found.data).toMatchObject({ id: "A1", barcode: "A1", category: "Makanan Utama", price: 10_000, stock: 5 });
    expect((await readJson(await api("/api/products?barcode=NOPE", { session }))).data).toBeNull();
    expect((await api("/api/products", { session })).status).toBe(422);
  });

  it("logs stock adjustments with the delta the database applied", async () => {
    const { session } = await signIn("manajer");
    const set = await api("/api/products/A1/stock", { session, body: { mode: "set", qty: 9 } });
    expect(set.status).toBe(200);
    const add = await api("/api/products/A1/stock", { session, body: { mode: "add", qty: -4 } });
    expect(add.status).toBe(200);
    const { results } = await env.DB.prepare("SELECT delta, stock_after, reason FROM stock_movements ORDER BY id").all();
    expect(results).toEqual([
      { delta: 4, stock_after: 9, reason: "adjust" },
      { delta: -4, stock_after: 5, reason: "adjust" },
    ]);
    expect(await stockOf("A1")).toBe(5);
  });

  it("rejects an adjustment that would drive stock below zero", async () => {
    const { session } = await signIn("manajer");
    const response = await api("/api/products/A1/stock", { session, body: { mode: "add", qty: -6 } });
    expect(response.status).toBe(409);
    expect(await stockOf("A1")).toBe(5);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM stock_movements").first<{ n: number }>())!.n).toBe(0);
  });

  it("keeps category names unique regardless of case", async () => {
    const { session } = await signIn("admin");
    const response = await api("/api/resources/categories/cat-2", {
      session,
      method: "PUT",
      body: { name: "makanan utama", kind: "Makanan" },
    });
    expect(response.status).toBe(422);
    expect((await readJson(response)).errors.name).toBeDefined();
  });

  it("renames a category without touching its products", async () => {
    const { session } = await signIn("admin");
    const renamed = await api("/api/resources/categories/cat-1", { session, method: "PUT", body: { name: "Hidangan", kind: "Makanan" } });
    expect(renamed.status).toBe(200);
    const found = await readJson(await api("/api/products?barcode=A1", { session }));
    expect(found.data.category).toBe("Hidangan");
  });

  it("serves a single category and 404s for an unknown one", async () => {
    const { session } = await signIn("dapur");
    expect((await readJson(await api("/api/resources/categories/cat-1", { session }))).data.name).toBe("Makanan Utama");
    expect((await api("/api/resources/categories/missing", { session })).status).toBe(404);
  });
});
