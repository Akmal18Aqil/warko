import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import {
  AUDIO_PROBE,
  apiAs,
  chargeFor,
  closeOpened,
  customerPhone,
  getOrder,
  listOrders,
  MENU,
  mockControl,
  notifyMidtrans,
  orderOnPhone,
  PRINT_PROBE,
  placeStaffOrder,
  productStock,
  rp,
  setStock,
  staffContext,
  staffPage,
} from "../helpers";

const REALTIME = { timeout: 10_000 };
test.afterEach(closeOpened);

const ticket = (page: Page, no: number) => page.locator(".service-ticket", { has: page.getByText(`#${no}`, { exact: true }) });
const tableCard = (page: Page, name: string) => page.locator("article", { has: page.getByRole("heading", { name, exact: true }) });

async function revenue(page: Page): Promise<number> {
  const strip = page.getByRole("region", { name: "Ringkasan penjualan" });
  const text =
    (await strip
      .locator("div", { has: page.getByText("Total omset", { exact: true }) })
      .last()
      .textContent()) ?? "";
  return Number(text.replace("Total omset", "").replace(/[^\d]/g, ""));
}

test("INT-01 alur penuh tunai: Pelanggan → Dapur → Kasir → Owner pada 4 perangkat", async ({ browser }) => {
  const dapurCtx = await staffContext(browser, "dapur");
  await dapurCtx.addInitScript(AUDIO_PROBE);
  const dapur = await dapurCtx.newPage();
  await dapur.goto("/dapur");
  await dapur.getByRole("button", { name: "Aktifkan bel" }).click();
  const kasirCtx = await staffContext(browser, "kasir");
  await kasirCtx.addInitScript(PRINT_PROBE);
  const kasir = await kasirCtx.newPage();
  await kasir.goto("/meja");
  const owner = await staffPage(browser, "manajer", "/laporan");
  await expect.poll(() => revenue(owner)).toBeGreaterThan(0);
  const revenueBefore = await revenue(owner);
  const stockBefore = (await productStock("mieayam")) ?? 0;
  const bellsBefore = await dapur.evaluate(() => window.__oscStarts);

  // 1. Pelanggan
  const phone = await customerPhone(browser, "l2-m21");
  await expect(phone.getByRole("button", { name: "Meja 21 · Lantai 2" })).toBeVisible();
  const no = await orderOnPhone(phone, [{ key: "mieayam", qty: 2, note: "kuah dipisah" }]);
  const order = await getOrder(no);
  expect(await productStock("mieayam")).toBe(stockBefore - 2);
  const card = phone.locator("article", { hasText: `Pesanan #${no}` });

  // 2. Dapur
  await expect(dapur.getByText(`Pesanan baru #${no} · Meja 21 · Lantai 2`)).toBeVisible(REALTIME);
  expect(await dapur.evaluate(() => window.__oscStarts)).toBeGreaterThan(bellsBefore);
  const t = ticket(dapur, no);
  await expect(t).toContainText("kuah dipisah");
  await expect(t).toContainText("BELUM BAYAR");
  await t.getByRole("button", { name: "Mulai masak" }).click();
  await expect(card.locator('[aria-current="step"]')).toHaveText("Sedang Dimasak", REALTIME);
  await t.getByRole("button", { name: "Selesai & siap" }).click();
  await expect(card.locator('[aria-current="step"]')).toHaveText("Siap Diantar", REALTIME);
  await t.getByRole("button", { name: "Sudah diantar ke tamu" }).click();

  // 3. Kasir
  const meja = tableCard(kasir, "Meja 21");
  await expect(meja.getByText("Terisi", { exact: true })).toBeVisible(REALTIME);
  await expect(meja.getByRole("button", { name: /^Bayar Rp/ })).toContainText(rp(order.total));
  await meja.getByRole("button", { name: /^Bayar Rp/ }).click();
  const pay = kasir.getByRole("dialog", { name: "Terima pembayaran" });
  await pay.getByRole("button", { name: /^Tunai/ }).click();
  await pay.getByLabel(/uang yang diterima/i).fill("100000");
  await pay.getByRole("button", { name: "Selesaikan pembayaran" }).click();
  await expect(kasir.getByText("Pembayaran berhasil")).toBeVisible();
  await kasir.locator("[data-sonner-toast]").getByRole("button", { name: "Cetak struk" }).first().click();
  await expect.poll(() => kasir.evaluate(() => window.__prints.length)).toBe(1);
  expect(await kasir.evaluate(() => window.__prints[0])).toContain(`PESANAN ${no}`);
  await expect(meja.getByText("Kosong", { exact: true })).toBeVisible(REALTIME);
  await expect(card.getByText("Pembayaran diterima")).toBeVisible(REALTIME);

  // 4. Owner
  await expect.poll(() => revenue(owner), REALTIME).toBe(revenueBefore + order.total);
  await expect(
    owner
      .getByRole("region", { name: "Riwayat transaksi" })
      .locator("tbody tr")
      .filter({ has: owner.getByRole("cell", { name: `#${no}`, exact: true }) }),
  ).toBeVisible();
  const [csv] = await Promise.all([owner.waitForEvent("download"), owner.getByRole("button", { name: "CSV" }).click()]);
  expect(readFileSync(await csv.path(), "utf8")).toContain(String(no));
});

test("INT-02 alur penuh QRIS mandiri: lunas otomatis tanpa konfirmasi kasir", async ({ browser }) => {
  const dapur = await staffPage(browser, "dapur", "/dapur");
  const owner = await staffPage(browser, "manajer", "/laporan");
  await expect.poll(() => revenue(owner)).toBeGreaterThan(0);
  const revenueBefore = await revenue(owner);

  const phone = await customerPhone(browser, "rt-m22");
  const no = await orderOnPhone(phone, [{ key: "nasgor", qty: 1 }], "qris");
  const qris = phone.getByRole("dialog", { name: `Bayar QRIS · Pesanan #${no}` });
  await expect(qris.getByRole("img", { name: "Kode QRIS pembayaran" })).toBeVisible();
  await expect(ticket(dapur, no)).toContainText("BELUM BAYAR", REALTIME);

  const charge = await chargeFor(no);
  await mockControl({ orderId: charge.orderId, status: "settlement" });
  const res = await notifyMidtrans(charge.orderId, `${charge.amount}.00`);
  expect(res.status, res.body).toBe(200);

  await expect(phone.getByText(`Pembayaran QRIS pesanan #${no} diterima!`)).toBeVisible(REALTIME);
  // Struk digital terbuka otomatis setelah lunas.
  await expect(phone.getByRole("dialog", { name: "Struk digital" })).toContainText(/QRIS/);
  await expect(phone.locator("article", { hasText: `Pesanan #${no}` }).getByText("Lunas", { exact: true })).toBeAttached();
  await expect(ticket(dapur, no)).toContainText("LUNAS", REALTIME);
  const order = await getOrder(no);
  expect(order.method).toBe("qris");
  expect(order.paidBy).toBe("QRIS Midtrans");
  await expect.poll(() => revenue(owner), REALTIME).toBe(revenueBefore + order.total);
});

test("INT-03 dua pelanggan berebut stok terakhir: satu berhasil, satu ditolak utuh", async ({ browser }) => {
  await setStock("pisang", 1);
  const a = await customerPhone(browser, "l1-m23");
  const b = await customerPhone(browser, "l2-m24");
  for (const phone of [a, b]) {
    await phone.getByRole("button", { name: `Tambah ${MENU.pisang.name}` }).click();
    await phone.getByRole("button", { name: `Tambah ${MENU.esteh.name}` }).click();
    await phone.getByRole("button", { name: /Lihat Keranjang/ }).click();
  }
  const before = (await listOrders()).length;
  await Promise.all([a, b].map((p) => p.getByRole("button", { name: "Pesan & Bayar Tunai di Kasir" }).click()));
  const outcome = async (p: Page) =>
    (await p.getByText(/diterima dapur!/).count()) > 0
      ? "ok"
      : (await p.getByText(/stok|habis|tidak cukup/i).count()) > 0
        ? "rejected"
        : "pending";
  await expect.poll(async () => [await outcome(a), await outcome(b)].sort().join(","), REALTIME).toBe("ok,rejected");
  expect((await listOrders()).length - before).toBe(1);
  expect(await productStock("pisang")).toBe(0);
  const loser = (await outcome(a)) === "rejected" ? a : b;
  test.info().annotations.push({
    type: "pesan penolakan",
    description:
      (await loser
        .getByText(/stok|habis|tidak cukup/i)
        .first()
        .textContent()) ?? "",
  });
  await loser.reload();
  await expect(loser.locator("article", { hasText: MENU.pisang.name }).getByText("Menu habis hari ini")).toBeVisible();
  await expect(loser.getByRole("heading", { name: /^Pesanan #\d+$/ })).toHaveCount(0); // es teh tidak ikut tercatat sebagian
});

test("INT-04 kirim ulang dengan kunci sama dari dua perangkat → satu pesanan, satu tiket", async ({ browser }) => {
  const dapur = await staffPage(browser, "dapur", "/dapur");
  const kasir = await staffPage(browser, "kasir", "/pesanan");
  const clientRef = "int04-dedup-ref-0123456789abcdef";
  const body = { tableId: "rt-m25", expectedTotal: 5550, clientRef, items: [{ barcode: MENU.esteh.barcode, qty: 1 }] };
  const [c1, c2] = await Promise.all([apiAs(null), apiAs(null)]);
  const [r1, r2] = await Promise.all([c1.post("/api/public/orders", { data: body }), c2.post("/api/public/orders", { data: body })]);
  const [j1, j2] = [await r1.json(), await r2.json()];
  test.info().annotations.push({ type: "status", description: `${r1.status()} / ${r2.status()}` });
  const nos = [j1.data?.no, j2.data?.no].filter(Boolean);
  expect(new Set(nos).size).toBe(1);
  const r3 = await c1.post("/api/public/orders", { data: body });
  expect((await r3.json()).data.no).toBe(nos[0]);
  await Promise.all([c1.dispose(), c2.dispose()]);
  await expect(ticket(dapur, nos[0])).toHaveCount(1, REALTIME);
  await kasir.getByLabel("Cari pesanan").fill(String(nos[0]));
  await expect(kasir.getByRole("row", { name: new RegExp(`#?${nos[0]}\\b`) })).toHaveCount(1, REALTIME);
  expect((await listOrders()).filter((o) => o.tableId === "rt-m25")).toHaveLength(1);
});

test("INT-05 pesanan pelayan (bayar nanti) dilunasi kasir tanpa nomor baru", async ({ browser }) => {
  const waiter = await placeStaffOrder("pelayan", { tableId: "l1-m26", lines: [{ key: "nasgor", qty: 1 }], source: "waiter" });
  const kasir = await staffPage(browser, "kasir", "/pesanan");
  await kasir.getByLabel("Cari pesanan").fill(String(waiter.no));
  const row = kasir.getByRole("row", { name: new RegExp(`#?${waiter.no}\\b`) });
  await expect(row).toContainText("Pelayan", REALTIME);
  await row.getByRole("button", { name: "Terima Bayar" }).click();
  const pay = kasir.getByRole("dialog", { name: "Terima pembayaran" });
  await pay.getByRole("button", { name: /^Tunai/ }).click();
  await pay.getByRole("button", { name: "Uang pas" }).click();
  await pay.getByRole("button", { name: "Selesaikan pembayaran" }).click();
  await expect(kasir.getByText("Pembayaran berhasil")).toBeVisible();
  const order = await getOrder(waiter.no);
  expect(order.no).toBe(waiter.no);
  expect(order.source).toBe("waiter");
  expect(order.paymentStatus).toBe("paid");
  expect(order.paidBy).toBe("Jamie Kasir");
});
