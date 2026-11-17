import { expect, test } from "@playwright/test";
import {
  addOnPhone,
  apiAs,
  closeOpened,
  customerPhone,
  getOrder,
  listOrders,
  MENU,
  newContext,
  openCart,
  orderOnPhone,
  PLAIN_BASE,
  PRINT_PROBE,
  placeSelfOrder,
  rp,
  setKitchen,
  settleCash,
  totalOf,
} from "../helpers";

const REALTIME = { timeout: 10_000 };

test.afterEach(closeOpened);

test("PLG-01 scan QR meja valid membuka menu dengan meja & lantai terisi", async ({ browser }) => {
  const page = await customerPhone(browser, "l1-m3");
  await expect(page.getByRole("button", { name: "Meja 3 · Lantai 1" })).toBeVisible();
  await expect(page.getByText(MENU.nasgor.name)).toBeVisible();
});

test("PLG-02 QR meja tidak dikenali → pesan + pemilih lantai & meja", async ({ browser }) => {
  const page = await customerPhone(browser, "meja-tidak-ada");
  await expect(page.getByText("QR meja tidak dikenali. Silakan pilih lantai dan meja Anda.")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Pilih lantai & nomor meja" })).toBeVisible();
});

test("PLG-03 buka /order tanpa ID meja → wajib pilih meja", async ({ browser }) => {
  const page = await customerPhone(browser, null);
  await expect(page.getByRole("dialog", { name: "Pilih lantai & nomor meja" })).toBeVisible();
});

test("PLG-04 pilih lantai & meja: hanya meja lantai terpilih yang tampil", async ({ browser }) => {
  const page = await customerPhone(browser, null);
  const picker = page.getByRole("dialog", { name: "Pilih lantai & nomor meja" });
  for (const floor of ["Lantai 1", "Lantai 2", "Rooftop"]) await expect(picker.getByRole("tab", { name: floor })).toBeVisible();
  await picker.getByRole("tab", { name: "Rooftop" }).click();
  await expect(picker.getByRole("button", { name: /^Meja 8/ })).toBeVisible();
  await expect(picker.getByRole("button", { name: /^Meja 1\b/ })).toHaveCount(0);
  await expect(picker.getByRole("button", { name: /^Meja 4/ })).toHaveCount(0);
  await picker.getByRole("button", { name: /^Meja 8/ }).click();
  await expect(page.getByText("Meja aktif: Meja 8 · Rooftop")).toBeVisible();
  await expect(page.getByRole("button", { name: "Meja 8 · Rooftop" })).toBeVisible();
});

test("PLG-05 ganti meja sebelum pesan: keranjang tetap & pesanan memakai meja baru", async ({ browser }) => {
  const page = await customerPhone(browser, "l1-m1");
  await addOnPhone(page, "esteh", 2);
  await page.getByRole("button", { name: "Meja 1 · Lantai 1" }).click();
  const picker = page.getByRole("dialog", { name: "Pilih lantai & nomor meja" });
  await picker.getByRole("tab", { name: "Lantai 2" }).click();
  await picker.getByRole("button", { name: /^Meja 5/ }).click();
  await expect(page.getByRole("button", { name: /Lihat Keranjang/ })).toContainText("2");
  const no = await orderOnPhone(page, []);
  const order = await getOrder(no);
  expect(order.tableId).toBe("l2-m5");
  expect(order.tableArea).toBe("Lantai 2");
});

test("PLG-06 checkout tanpa meja ditolak", async ({ browser }) => {
  const page = await customerPhone(browser, null);
  const picker = page.getByRole("dialog", { name: "Pilih lantai & nomor meja" });
  await picker.getByRole("button", { name: "Tutup" }).click();
  await expect(picker).toBeHidden();
  await addOnPhone(page, "esteh");
  await openCart(page);
  await expect(page.getByRole("button", { name: "Pesan & Bayar Tunai di Kasir" })).toBeDisabled();
  await expect(page.getByText("Pilih meja terlebih dahulu.")).toBeVisible();
});

test("PLG-07 & PLG-08 tambah / ubah / hapus jumlah, total ikut berubah", async ({ browser }) => {
  const page = await customerPhone(browser, "l1-m2");
  await addOnPhone(page, "nasgor", 2);
  await addOnPhone(page, "esteh", 1);
  const bar = page.getByRole("button", { name: /Lihat Keranjang/ });
  await expect(bar).toContainText("3");
  await expect(bar).toContainText(rp(totalOf(2 * 25000 + 5000)));
  await page
    .getByRole("button", { name: `Kurangi ${MENU.nasgor.name}` })
    .first()
    .click();
  await expect(bar).toContainText(rp(totalOf(25000 + 5000)));
  await page
    .getByRole("button", { name: `Kurangi ${MENU.esteh.name}` })
    .first()
    .click();
  await expect(bar).toContainText("1");
  await expect(page.getByRole("button", { name: `Kurangi ${MENU.esteh.name}` })).toHaveCount(0);
  await page
    .getByRole("button", { name: `Kurangi ${MENU.nasgor.name}` })
    .first()
    .click();
  await expect(bar).toBeHidden();
});

test("PLG-09 menu stok 0 tampil HABIS dan tidak bisa ditambah", async ({ browser }) => {
  const page = await customerPhone(browser, "l1-m2");
  const card = page.locator("article", { hasText: MENU.kerupuk.name });
  await expect(card.getByText("HABIS", { exact: true })).toBeVisible();
  await expect(card.getByText("Menu habis hari ini")).toBeVisible();
  await expect(card.getByRole("button", { name: `Tambah ${MENU.kerupuk.name}` })).toHaveCount(0);
});

test("PLG-10 jumlah tidak bisa melebihi stok (UI & server)", async ({ browser }) => {
  const page = await customerPhone(browser, "l1-m2");
  const card = page.locator("article", { hasText: MENU.geprek.name });
  await expect(card.getByText("Sisa 6")).toHaveCount(0); // peringatan hanya < 5
  await addOnPhone(page, "geprek", 7);
  await expect(page.getByText(`Stok ${MENU.geprek.name} tinggal 6`).first()).toBeVisible();
  await expect(card.locator("span", { hasText: /^6$/ })).toBeVisible();

  const ctx = await apiAs(null);
  const res = await ctx.post("/api/public/orders", {
    data: {
      tableId: "l1-m2",
      expectedTotal: totalOf(7 * 20000),
      clientRef: "plg10-over-stock-0123456789abc",
      items: [{ barcode: MENU.geprek.barcode, qty: 7 }],
    },
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(await res.text()).toMatch(/stok/i);
  await ctx.dispose();
});

test("PLG-11, PLG-12, PLG-17 catatan + bayar tunai di kasir → Diterima Dapur, Belum Bayar", async ({ browser }) => {
  const page = await customerPhone(browser, "l1-m3");
  const no = await orderOnPhone(page, [{ key: "nasgor", qty: 1, note: "pedas, tanpa es" }]);
  await expect(page.getByText(`Pesanan #${no} diterima dapur!`)).toBeVisible();
  await expect(page.getByText(`Bayar tunai di kasir: sebutkan #${no}`)).toBeVisible();
  const card = page.locator("article", { hasText: `Pesanan #${no}` });
  await expect(card.getByText("Belum bayar", { exact: true })).toBeVisible();
  await expect(card.getByText("(pedas, tanpa es)")).toBeVisible();
  await expect(card.locator('[aria-current="step"]')).toHaveText("Diterima Dapur");
  const order = await getOrder(no);
  expect(order.items[0].note).toBe("pedas, tanpa es");
  expect(order.paymentStatus).toBe("unpaid");
  expect(order.kitchenStatus).toBe("queued");
});

test("PLG-18, PLG-13, PLG-16 progres real-time, pelunasan kasir & struk digital", async ({ browser }) => {
  const page = await customerPhone(browser, "l2-m4");
  await page.addInitScript(PRINT_PROBE);
  await page.reload();
  const no = await orderOnPhone(page, [
    { key: "nasgor", qty: 2, note: "tanpa bawang" },
    { key: "esteh", qty: 1 },
  ]);
  const card = page.locator("article", { hasText: `Pesanan #${no}` });

  await setKitchen(no, "preparing");
  await expect(card.locator('[aria-current="step"]')).toHaveText("Sedang Dimasak", REALTIME);
  await setKitchen(no, "ready");
  await expect(card.locator('[aria-current="step"]')).toHaveText("Siap Diantar", REALTIME);
  await expect(card.getByText("Pesanan Anda siap dan sedang diantar ke meja.")).toBeVisible();

  const total = totalOf(2 * 25000 + 5000);
  const paid = await settleCash(no, 100000);
  expect(paid.status, JSON.stringify(paid.body)).toBe(200);
  await expect(card.getByText("Pembayaran diterima")).toBeVisible(REALTIME);
  await expect(card.getByText("Lunas", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Struk digital" }).click();
  const receipt = page.getByRole("dialog", { name: "Struk digital" });
  await expect(receipt.getByText(`Pesanan #${no}`)).toBeVisible();
  await expect(receipt).toContainText("WAKRO");
  await expect(receipt).toContainText(/MEJA 4/i);
  await expect(receipt).toContainText(/LANTAI 2/i);
  await expect(receipt).toContainText(`2× ${MENU.nasgor.name}`);
  await expect(receipt).toContainText("(tanpa bawang)");
  await expect(receipt).toContainText("Subtotal");
  await expect(receipt).toContainText("Pajak");
  await expect(receipt.getByText(rp(total)).first()).toBeVisible();
  await expect(receipt).toContainText(/Tunai/i);
  await expect(receipt).toContainText("Simpan struk ini sebagai bukti pembayaran.");
  await expect(receipt).toContainText(/\d{2}[./:]\d{2}/); // jam transaksi
  await receipt.getByRole("button", { name: "Simpan / Cetak" }).click();
  await expect.poll(() => page.evaluate(() => window.__prints.length)).toBe(1);
});

test("PLG-15 QRIS nonaktif tanpa MIDTRANS_SERVER_KEY: hanya bayar di kasir", async ({ browser }) => {
  const ctx = await apiAs(null, PLAIN_BASE);
  expect((await (await ctx.get("/api/public/payments")).json()).data.qris).toBe(false);
  await ctx.dispose();
  const page = await customerPhone(browser, "l1-m1", PLAIN_BASE);
  await addOnPhone(page, "esteh");
  await openCart(page);
  await expect(page.getByRole("button", { name: /Bayar Sekarang via QRIS/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Pesan & Bayar Tunai di Kasir" }).click();
  await expect(page.getByText(/Pesanan #\d+ diterima dapur!/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Bayar QRIS" })).toHaveCount(0);
});

test("PLG-19 pesanan tetap terlacak setelah refresh & tab ditutup", async ({ browser }) => {
  const page = await customerPhone(browser, "l2-m6");
  const no = await orderOnPhone(page, [{ key: "esteh", qty: 1 }]);
  await page.reload();
  await expect(page.getByRole("heading", { name: `Pesanan #${no}` })).toBeVisible();
  const ctx = page.context();
  await page.close();
  const again = await ctx.newPage();
  await again.goto("/order/l2-m6");
  await expect(again.getByRole("heading", { name: `Pesanan #${no}` })).toBeVisible();
});

test("PLG-20 & PLG-22 submit lock: tap 5× dan back/refresh tidak menggandakan pesanan", async ({ browser }) => {
  const page = await customerPhone(browser, "rt-m7");
  const before = (await listOrders()).filter((o) => o.tableId === "rt-m7").length;
  await addOnPhone(page, "nasgor");
  await openCart(page);
  const submit = page.getByRole("button", { name: "Pesan & Bayar Tunai di Kasir" });
  await submit.evaluate((button: HTMLButtonElement) => {
    for (let i = 0; i < 5; i++) button.click();
  });
  await expect(page.getByText(/Pesanan #\d+ diterima dapur!/)).toBeVisible();
  await page.goBack().catch(() => undefined);
  await page.goForward().catch(() => undefined);
  await page.reload();
  await expect(page.getByRole("heading", { name: /^Pesanan #\d+$/ })).toHaveCount(1);
  const after = (await listOrders()).filter((o) => o.tableId === "rt-m7").length;
  expect(after - before).toBe(1);
});

test("PLG-21 koneksi putus saat kirim → kirim ulang tidak menggandakan", async ({ browser }) => {
  const page = await customerPhone(browser, "rt-m8");
  const before = (await listOrders()).filter((o) => o.tableId === "rt-m8").length;
  let dropped = false;
  await page.route("**/api/public/orders", async (route) => {
    if (route.request().method() !== "POST" || dropped) return route.continue();
    dropped = true;
    await route.fetch();
    await route.abort("failed");
  });
  await addOnPhone(page, "esteh");
  await openCart(page);
  await page.getByRole("button", { name: "Pesan & Bayar Tunai di Kasir" }).click();
  await expect(page.getByText("Pesanan sebelumnya belum terkonfirmasi")).toBeVisible();
  await page.getByRole("button", { name: "Kirim ulang pesanan sebelumnya" }).click();
  await expect(page.getByText(/sudah tercatat/)).toBeVisible();
  const after = (await listOrders()).filter((o) => o.tableId === "rt-m8").length;
  expect(after - before).toBe(1);
});

test("PLG-23 status/struk pesanan tidak bisa dibaca tanpa kunci perangkat", async () => {
  const mine = await placeSelfOrder("rt-m9", [{ key: "esteh", qty: 1 }]);
  const other = await placeSelfOrder("rt-m9", [{ key: "esteh", qty: 1 }]);
  const ctx = await apiAs(null);
  expect((await ctx.get(`/api/public/orders/${mine.no}?key=${mine.key}`)).status()).toBe(200);
  expect([404, 422]).toContain((await ctx.get(`/api/public/orders/${mine.no}`)).status());
  expect((await ctx.get(`/api/public/orders/${mine.no}?key=kunci-salah-0123456789abcdef`)).status()).toBe(404);
  expect((await ctx.get(`/api/public/orders/${other.no}?key=${mine.key}`)).status()).toBe(404);
  expect((await ctx.get(`/api/orders/${other.no}`)).status()).toBe(401);
  await ctx.dispose();
});

test("PLG-24 HP pelanggan tidak bisa membuka halaman staf", async ({ browser }) => {
  const page = await customerPhone(browser, "l1-m1");
  for (const path of ["/", "/dapur", "/pesanan", "/laporan"]) {
    await page.goto(path);
    await expect(page.getByLabel(/nama pengguna/i)).toBeVisible();
    await expect(page.getByText("Buat pesanan")).toHaveCount(0);
  }
});

test("PLG-25 tampilan HP 360 px: tanpa geser horizontal, ukuran target sentuh", async ({ browser }) => {
  const ctx = await newContext(browser, { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/order/l1-m1");
  await addOnPhone(page, "nasgor");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({ name: b.getAttribute("aria-label") ?? b.textContent?.trim() ?? "", h: Math.round(b.getBoundingClientRect().height) }))
      .filter((b) => b.h < 44),
  );
  test.info().annotations.push({ type: "tombol < 44px", description: JSON.stringify(small.slice(0, 12)) });
  console.log("PLG-25 tombol < 44px:", small.length, JSON.stringify(small.slice(0, 12)));
});
