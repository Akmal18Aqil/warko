import { execSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { type APIRequestContext, type Browser, type BrowserContext, expect, request as newRequest, type Page } from "@playwright/test";
import { UAT } from "./uat-env.mjs";

declare global {
  interface Window {
    __prints: string[];
    __oscStarts: number;
  }
}

export const ROLES = ["admin", "kasir", "kasir2", "dapur", "manajer", "pelayan"] as const;
export type Role = (typeof ROLES)[number];

export const BASE = `http://127.0.0.1:${UAT.qrisPort}`;
export const PLAIN_BASE = `http://127.0.0.1:${UAT.plainPort}`;
export const MOCK_BASE = `http://127.0.0.1:${UAT.mockPort}`;

export function authFile(role: Role): string {
  return fileURLToPath(new URL(`../uat-results/.auth/${role}.json`, import.meta.url));
}

/** Seeded catalog (uat/seed.sql). */
export const MENU = {
  nasgor: { barcode: "UAT-NASGOR", name: "Nasi Goreng WakRo", price: 25000 },
  esteh: { barcode: "UAT-ESTEH", name: "Es Teh Manis", price: 5000 },
  mieayam: { barcode: "UAT-MIEAYAM", name: "Mie Ayam", price: 18000 },
  geprek: { barcode: "UAT-GEPREK", name: "Ayam Geprek", price: 20000 },
  tahu: { barcode: "UAT-TAHU", name: "Tahu Isi", price: 3000 },
  pisang: { barcode: "UAT-PISANG", name: "Pisang Goreng", price: 4000 },
  kerupuk: { barcode: "UAT-KERUPUK", name: "Kerupuk", price: 2000 },
} as const;
export type MenuKey = keyof typeof MENU;

/** Default pricing: PPN 11%, no service charge. */
export function totalOf(subtotal: number): number {
  return subtotal + Math.round((subtotal * 11) / 100);
}

/** "Rp 33.300" as a regex that tolerates the no-break space Intl puts after "Rp". */
export function rp(amount: number): RegExp {
  return new RegExp(`Rp\\s?${amount.toLocaleString("id-ID").replace(/\./g, "\\.")}`);
}

const opened: BrowserContext[] = [];

/** Every browser context a case opens is closed after it (register with `test.afterEach(closeOpened)`). */
export async function closeOpened(): Promise<void> {
  await Promise.all(opened.splice(0).map((ctx) => ctx.close().catch(() => undefined)));
}

export async function newContext(browser: Browser, options: Parameters<Browser["newContext"]>[0] = {}): Promise<BrowserContext> {
  const ctx = await browser.newContext({ baseURL: BASE, locale: "id-ID", timezoneId: "Asia/Jakarta", ...options });
  opened.push(ctx);
  return ctx;
}

export async function staffContext(
  browser: Browser,
  role: Role,
  options: Parameters<Browser["newContext"]>[0] = {},
): Promise<BrowserContext> {
  return newContext(browser, { storageState: authFile(role), ...options });
}

export async function staffPage(
  browser: Browser,
  role: Role,
  path: string,
  options: Parameters<Browser["newContext"]>[0] = {},
): Promise<Page> {
  const page = await (await staffContext(browser, role, options)).newPage();
  await page.goto(path);
  return page;
}

export async function apiAs(role: Role | null, baseURL = BASE): Promise<APIRequestContext> {
  return newRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
    ...(role ? { storageState: authFile(role) } : {}),
  });
}

export type Line = { key: MenuKey; qty: number; note?: string };
export type PlacedOrder = { no: number; key: string; total: number };

/** Places a self-order exactly like the customer page does (pay-later, client-generated secret key). */
export async function placeSelfOrder(tableId: string, lines: Line[], customerName = "Tamu UAT"): Promise<PlacedOrder> {
  const ctx = await apiAs(null);
  const key = randomUUID().replace(/-/g, "");
  const subtotal = lines.reduce((sum, l) => sum + MENU[l.key].price * l.qty, 0);
  const res = await ctx.post("/api/public/orders", {
    data: {
      tableId,
      customerName,
      paymentChoice: "pay-later",
      expectedTotal: totalOf(subtotal),
      clientRef: key,
      items: lines.map((l) => ({ barcode: MENU[l.key].barcode, qty: l.qty, ...(l.note ? { note: l.note } : {}) })),
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const body = await res.json();
  await ctx.dispose();
  return { no: body.data.no, key, total: body.data.total };
}

/** Order created by staff through the API (POS / waiter), optionally paid on creation. */
export async function placeStaffOrder(
  role: Role,
  options: { tableId?: string; lines: Line[]; source?: "pos" | "waiter"; cashReceived?: number; customerName?: string },
): Promise<PlacedOrder> {
  const ctx = await apiAs(role);
  const subtotal = options.lines.reduce((sum, l) => sum + MENU[l.key].price * l.qty, 0);
  const paid = options.cashReceived !== undefined;
  const res = await ctx.post("/api/orders", {
    data: {
      orderType: options.tableId ? "meja" : "bawa-pulang",
      ...(options.tableId ? { tableId: options.tableId } : {}),
      source: options.source ?? "pos",
      customerName: options.customerName ?? "Walk-in UAT",
      paymentChoice: paid ? "paid-now" : "pay-later",
      kitchenStatus: "queued",
      expectedTotal: totalOf(subtotal),
      clientRef: randomUUID().replace(/-/g, ""),
      ...(paid ? { method: "tunai", cashReceived: options.cashReceived } : {}),
      items: options.lines.map((l) => ({ barcode: MENU[l.key].barcode, qty: l.qty, ...(l.note ? { note: l.note } : {}) })),
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const body = await res.json();
  await ctx.dispose();
  return { no: body.data.no, key: "", total: body.data.total };
}

export async function getOrder(no: number) {
  const ctx = await apiAs("admin");
  const res = await ctx.get(`/api/orders/${no}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  await ctx.dispose();
  return body.data;
}

/** Operational orders as staff screens load them. */
export async function listOrders(): Promise<
  { no: number; total: number; paymentStatus: string; kitchenStatus: string; tableId: string | null; method: string | null }[]
> {
  const ctx = await apiAs("admin");
  const res = await ctx.get("/api/orders");
  expect(res.status(), await res.text()).toBe(200);
  const body = await res.json();
  await ctx.dispose();
  return body.data;
}

export async function productStock(key: MenuKey): Promise<number | null> {
  const ctx = await apiAs(null);
  const res = await ctx.get("/api/public/menu");
  const body = await res.json();
  await ctx.dispose();
  const product = body.data.products.find((p: { barcode?: string; id?: string }) => (p.barcode ?? p.id) === MENU[key].barcode);
  return product.stock ?? null;
}

export async function setStock(key: MenuKey, qty: number, role: Role = "admin") {
  const ctx = await apiAs(role);
  const res = await ctx.post(`/api/products/${MENU[key].barcode}/stock`, { data: { mode: "set", qty } });
  expect(res.status(), await res.text()).toBe(200);
  await ctx.dispose();
}

export async function setKitchen(no: number, kitchenStatus: "preparing" | "ready" | "served", role: Role = "dapur") {
  const ctx = await apiAs(role);
  const res = await ctx.patch(`/api/orders/${no}/status`, { data: { kitchenStatus } });
  expect(res.status(), await res.text()).toBe(200);
  await ctx.dispose();
}

export async function settleCash(no: number, cashReceived: number, role: Role = "kasir") {
  const ctx = await apiAs(role);
  const res = await ctx.post(`/api/orders/${no}/payment`, { data: { method: "tunai", cashReceived } });
  const body = await res.json();
  await ctx.dispose();
  return { status: res.status(), body };
}

/** Customer phone: a mobile context on the table's QR URL. */
export async function customerPhone(browser: Browser, tableId: string | null, baseURL = BASE): Promise<Page> {
  const ctx = await newContext(browser, { baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(tableId ? `/order/${tableId}` : "/order");
  return page;
}

export async function addOnPhone(page: Page, key: MenuKey, times = 1) {
  for (let i = 0; i < times; i++)
    await page
      .getByRole("button", { name: `Tambah ${MENU[key].name}` })
      .first()
      .click();
}

export async function openCart(page: Page) {
  await page.getByRole("button", { name: /Lihat Keranjang/ }).click();
}

/** Places an order from the phone UI and returns its number. */
export async function orderOnPhone(page: Page, lines: Line[], pay: "cashier" | "qris" = "cashier"): Promise<number> {
  for (const l of lines) await addOnPhone(page, l.key, l.qty);
  await openCart(page);
  for (const l of lines) if (l.note) await page.getByLabel(`Catatan ${MENU[l.key].name}`).fill(l.note);
  await page.getByRole("button", { name: pay === "cashier" ? "Pesan & Bayar Tunai di Kasir" : /Bayar Sekarang via QRIS/ }).click();
  const heading = page.getByRole("heading", { name: /^Pesanan #\d+$/ }).first();
  await expect(heading).toBeVisible();
  return Number((await heading.textContent())?.match(/\d+/)?.[0]);
}

export async function mockControl(body: Record<string, unknown>) {
  const ctx = await newRequest.newContext();
  const res = await ctx.post(`${MOCK_BASE}/__control`, { data: body });
  expect(res.status()).toBe(200);
  await ctx.dispose();
}

export async function mockCharges(): Promise<{ orderId: string; amount: number; status: string }[]> {
  const ctx = await newRequest.newContext();
  const res = await ctx.get(`${MOCK_BASE}/__charges`);
  const body = await res.json();
  await ctx.dispose();
  return body;
}

/** Runs SQL against the live QRIS instance's local D1 (to fast-forward clocks the UI cannot reach). */
export function d1(sql: string): string {
  const apiDir = fileURLToPath(new URL("../../api/", import.meta.url));
  return execSync(
    `pnpm exec wrangler d1 execute DB --local --persist-to .wrangler/uat-qris --json --command "${sql.replace(/"/g, '\\"')}"`,
    {
      cwd: apiDir,
      encoding: "utf8",
    },
  );
}

/** Latest mock charge of an order (gateway ids are `WAKRO-<no>-<uuid>`). */
export async function chargeFor(no: number) {
  const charges = (await mockCharges()).filter((c) => c.orderId.startsWith(`WAKRO-${no}-`));
  expect(charges.length, `charge for #${no}`).toBeGreaterThan(0);
  return charges[charges.length - 1];
}

/** Sends a Midtrans HTTP notification; the signature is valid unless `signature` overrides it. */
export async function notifyMidtrans(orderId: string, grossAmount: string, options: { statusCode?: string; signature?: string } = {}) {
  const statusCode = options.statusCode ?? "200";
  const signature =
    options.signature ?? createHash("sha512").update(`${orderId}${statusCode}${grossAmount}${UAT.midtransKey}`).digest("hex");
  const ctx = await newRequest.newContext();
  const res = await ctx.post(`${BASE}/api/payments/midtrans/notify`, {
    data: {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: "settlement",
    },
  });
  const out = { status: res.status(), body: await res.text() };
  await ctx.dispose();
  return out;
}

/** Counts Web Audio oscillators started in a page (the kitchen bell is synthesized). */
export const AUDIO_PROBE = `(() => {
  window.__oscStarts = 0;
  const C = window.AudioContext;
  if (!C) return;
  const orig = C.prototype.createOscillator;
  C.prototype.createOscillator = function () {
    const osc = orig.call(this);
    const start = osc.start.bind(osc);
    osc.start = (...a) => { window.__oscStarts++; return start(...a); };
    return osc;
  };
})();`;

/** Records window.print() calls and the print layer's text at that moment. */
export const PRINT_PROBE = `(() => {
  window.__prints = [];
  window.print = () => { window.__prints.push(document.getElementById('print-root')?.textContent ?? ''); };
})();`;
