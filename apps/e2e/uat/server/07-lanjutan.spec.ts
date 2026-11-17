import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import {
  apiAs,
  BASE,
  chargeFor,
  closeOpened,
  customerPhone,
  d1,
  getOrder,
  mockControl,
  newContext,
  notifyMidtrans,
  orderOnPhone,
  placeSelfOrder,
  rp,
  staffPage,
} from "../helpers";

const REALTIME = { timeout: 10_000 };
test.afterEach(closeOpened);

const ZXING = fileURLToPath(new URL("../../../web/node_modules/@zxing/library/umd/index.min.js", import.meta.url));

type ZXingGlobal = {
  HTMLCanvasElementLuminanceSource: new (canvas: HTMLCanvasElement) => unknown;
  HybridBinarizer: new (source: unknown) => unknown;
  BinaryBitmap: new (binarizer: unknown) => unknown;
  QRCodeReader: new () => { decode(bitmap: unknown): { getText(): string } };
};

/** Decodes a QR image (data URL or same-page URL) with ZXing inside the page. */
async function decodeQr(page: Page, src: string): Promise<string> {
  await page.addScriptTag({ path: ZXING });
  return page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    // UMD global injected by addScriptTag above; only the decoder classes used here are typed.
    const Z = (window as unknown as { ZXing: ZXingGlobal }).ZXing;
    const source = new Z.HTMLCanvasElementLuminanceSource(canvas);
    return new Z.QRCodeReader().decode(new Z.BinaryBitmap(new Z.HybridBinarizer(source))).getText();
  }, src);
}

async function startQris(no: number, key: string) {
  const ctx = await apiAs(null);
  const res = await ctx.post(`/api/public/orders/${no}/qris`, { data: { key } });
  const out = { status: res.status(), body: await res.json() };
  await ctx.dispose();
  return out;
}

test("ADV-PG-01 & ADV-PG-02 QRIS dinamis: nominal = total, berlaku 15 menit, lunas otomatis via notifikasi", async ({ browser }) => {
  const phone = await customerPhone(browser, "l1-m29");
  const no = await orderOnPhone(phone, [{ key: "nasgor", qty: 2 }], "qris");
  const order = await getOrder(no);
  const modal = phone.getByRole("dialog", { name: `Bayar QRIS · Pesanan #${no}` });
  const img = modal.getByRole("img", { name: "Kode QRIS pembayaran" });
  await expect(img).toBeVisible();
  await expect(modal.getByText(rp(order.total))).toBeVisible();
  const charge = await chargeFor(no);
  expect(charge.amount).toBe(order.total);
  const validText = (await modal.getByText(/Berlaku sampai/).textContent()) ?? "";
  const [hh, mm] = (validText.match(/(\d{2})[.:](\d{2})/)?.slice(1) ?? []).map(Number);
  const nowJkt = new Date(Date.now() + 7 * 3600_000);
  const minutes = (hh * 60 + mm - (nowJkt.getUTCHours() * 60 + nowJkt.getUTCMinutes()) + 1440) % 1440;
  expect(minutes).toBeGreaterThanOrEqual(14);
  expect(minutes).toBeLessThanOrEqual(15);
  expect(await decodeQr(phone, (await img.getAttribute("src")) ?? "")).toContain(charge.orderId);

  await mockControl({ orderId: charge.orderId, status: "settlement" });
  expect((await notifyMidtrans(charge.orderId, `${charge.amount}.00`)).status).toBe(200);
  await expect(phone.getByText(`Pembayaran QRIS pesanan #${no} diterima!`)).toBeVisible(REALTIME);
  await expect(modal).toBeHidden();
  expect((await getOrder(no)).paymentStatus).toBe("paid");
});

test("ADV-PG-03 notifikasi dengan signature palsu ditolak", async () => {
  const order = await placeSelfOrder("l2-m30", [{ key: "esteh", qty: 1 }]);
  expect((await startQris(order.no, order.key)).status).toBe(201);
  const charge = await chargeFor(order.no);
  await mockControl({ orderId: charge.orderId, status: "settlement" });
  const res = await notifyMidtrans(charge.orderId, `${charge.amount}.00`, { signature: "0".repeat(128) });
  expect(res.status).toBe(401);
  expect((await getOrder(order.no)).paymentStatus).toBe("unpaid");
});

test("ADV-PG-04 nominal di Midtrans berbeda → tidak dilunasi", async () => {
  const order = await placeSelfOrder("l2-m30", [{ key: "esteh", qty: 1 }]);
  await startQris(order.no, order.key);
  const charge = await chargeFor(order.no);
  await mockControl({ orderId: charge.orderId, status: "settlement", grossAmount: 1000 });
  expect((await notifyMidtrans(charge.orderId, "1000.00")).status).toBe(200);
  expect((await getOrder(order.no)).paymentStatus).toBe("unpaid");
});

test("ADV-PG-05 status pending / deny / expire tidak melunasi", async () => {
  const order = await placeSelfOrder("l2-m30", [{ key: "esteh", qty: 1 }]);
  await startQris(order.no, order.key);
  const charge = await chargeFor(order.no);
  for (const status of ["pending", "deny", "expire"]) {
    await mockControl({ orderId: charge.orderId, status });
    expect((await notifyMidtrans(charge.orderId, `${charge.amount}.00`, { statusCode: status === "pending" ? "201" : "202" })).status).toBe(
      200,
    );
    expect((await getOrder(order.no)).paymentStatus, status).toBe("unpaid");
  }
  // Charge yang gagal/kedaluwarsa tidak dipakai lagi: QR baru dibuat.
  const again = await startQris(order.no, order.key);
  expect(again.status).toBe(201);
  expect((await chargeFor(order.no)).orderId).not.toBe(charge.orderId);
});

test("ADV-PG-06 notifikasi settlement ganda → lunas sekali", async () => {
  const order = await placeSelfOrder("rt-m28", [{ key: "esteh", qty: 1 }]);
  await startQris(order.no, order.key);
  const charge = await chargeFor(order.no);
  await mockControl({ orderId: charge.orderId, status: "settlement" });
  const results = await Promise.all([1, 2, 3].map(() => notifyMidtrans(charge.orderId, `${charge.amount}.00`)));
  expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
  const first = await getOrder(order.no);
  expect(first.paymentStatus).toBe("paid");
  expect((await notifyMidtrans(charge.orderId, `${charge.amount}.00`)).status).toBe(200);
  expect((await getOrder(order.no)).paidAt).toBe(first.paidAt);
  const owner = await apiAs("manajer");
  const from = first.paidAt - 60_000;
  const rows: { no: number }[] = (await (await owner.get(`/api/reports/orders?from=${from}&to=${from + 120_000}&limit=500`)).json()).data;
  expect(rows.filter((r) => r.no === order.no)).toHaveLength(1);
  await owner.dispose();
});

test("ADV-PG-07 QR kedaluwarsa (15 menit) → QR baru dibuat otomatis", async () => {
  const order = await placeSelfOrder("rt-m28", [{ key: "esteh", qty: 1 }]);
  const first = await startQris(order.no, order.key);
  expect(first.status).toBe(201);
  const reused = await startQris(order.no, order.key);
  expect(reused.status).toBe(200);
  expect(reused.body.data.qrString).toBe(first.body.data.qrString);
  const old = await chargeFor(order.no);
  d1(`UPDATE payment_charges SET expires_at = 1 WHERE gateway_order_id = '${old.orderId}'`);
  const renewed = await startQris(order.no, order.key);
  expect(renewed.status).toBe(201);
  expect(renewed.body.data.qrString).not.toBe(first.body.data.qrString);
  expect(renewed.body.data.expiresAt - Date.now()).toBeGreaterThan(14 * 60_000);
});

test("ADV-PG-08 gateway mati → pesan bayar di kasir, pesanan tetap ke dapur", async ({ browser }) => {
  await mockControl({ down: true });
  try {
    const dapur = await staffPage(browser, "dapur", "/dapur");
    const phone = await customerPhone(browser, "l1-m29");
    await phone.getByRole("button", { name: "Tambah Es Teh Manis" }).click();
    await phone.getByRole("button", { name: /Lihat Keranjang/ }).click();
    await phone.getByRole("button", { name: "Bayar Sekarang via QRIS" }).click();
    await expect(phone.getByText(/tidak tersedia/i).first()).toBeVisible();
    await expect(phone.getByText(/tetap diproses dapur dan bisa dibayar tunai di kasir/)).toBeVisible();
    const no = Number(
      (
        await phone
          .getByRole("heading", { name: /^Pesanan #\d+$/ })
          .first()
          .textContent()
      )?.match(/\d+/)?.[0],
    );
    await expect(dapur.locator(".service-ticket", { has: dapur.getByText(`#${no}`, { exact: true }) })).toBeVisible(REALTIME);
  } finally {
    await mockControl({ down: false });
  }
});

test("ADV-QR-01, ADV-QR-02, ADV-QR-03, ADV-QR-05 QR tiap meja unik, terbaca, domain benar, tautan bisa disalin", async ({ browser }) => {
  const page = await staffPage(browser, "kasir", "/meja", { permissions: ["clipboard-read", "clipboard-write"] });
  const ctx = await apiAs(null);
  const tables: { id: string; name: string }[] = (await (await ctx.get("/api/public/menu")).json()).data.tables;
  await ctx.dispose();
  const decoded = new Set<string>();
  for (const table of tables.slice(0, 6)) {
    await page.getByRole("button", { name: `QR ${table.name}`, exact: true }).click();
    const modal = page.getByRole("dialog", { name: `QR Order · ${table.name}` });
    const img = modal.getByRole("img", { name: `QR ${table.name}` });
    await expect(img).toBeVisible();
    const text = await decodeQr(page, (await img.getAttribute("src")) ?? "");
    expect(text).toBe(`${BASE}/order/${table.id}`);
    await expect(modal.getByText(text)).toBeVisible();
    decoded.add(text);
    if (table === tables[0]) {
      await modal.getByRole("button", { name: "Salin link" }).click();
      await expect(modal.getByText("Tersalin!")).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
    }
    await modal.getByRole("button", { name: "Tutup" }).first().click();
  }
  expect(decoded.size).toBe(Math.min(6, tables.length));
  test.info().annotations.push({ type: "contoh isi QR", description: [...decoded][0] });
  const phone = await (await newContext(browser)).newPage();
  await phone.goto([...decoded][0]);
  await expect(phone.getByRole("button", { name: new RegExp(`^${tables[0].name} · `) })).toBeVisible();
});

test("ADV-QR-04 QR tetap valid setelah meja diganti nama/lantai", async ({ browser }) => {
  const admin = await apiAs("admin");
  const update = (name: string, area: string) => admin.put("/api/resources/tables/rt-m7", { data: { name, seats: 4, area } });
  const res = await update("Meja 7 VIP", "Lantai 2");
  expect(res.status(), await res.text()).toBe(200);
  const phone = await (await newContext(browser)).newPage();
  await phone.goto("/order/rt-m7");
  await expect(phone.getByRole("button", { name: "Meja 7 VIP · Lantai 2" })).toBeVisible();
  expect((await update("Meja 7", "Rooftop")).status()).toBe(200);
  await admin.dispose();
});

test("KSR-24 cetak QR satu lantai → lembar stiker berisi QR yang benar", async ({ browser }) => {
  const page = await staffPage(browser, "kasir", "/meja");
  await page
    .getByRole("tablist", { name: "Filter lantai" })
    .getByRole("tab", { name: /^Lantai 2/ })
    .click();
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "Cetak QR Lantai 2" }).click()]);
  await popup.addInitScript(() => {
    window.print = () => undefined;
  });
  await expect(popup.locator("figure.sticker").first()).toBeVisible();
  const ctx = await apiAs(null);
  const floor = ((await (await ctx.get("/api/public/menu")).json()).data.tables as { id: string; area: string }[]).filter(
    (t) => t.area === "Lantai 2",
  );
  await ctx.dispose();
  await expect(popup.locator("figure.sticker")).toHaveCount(floor.length);
  const src = (await popup.locator("figure.sticker img").first().getAttribute("src")) ?? "";
  const text = await decodeQr(popup, src);
  expect(floor.map((t) => `${BASE}/order/${t.id}`)).toContain(text);
});
