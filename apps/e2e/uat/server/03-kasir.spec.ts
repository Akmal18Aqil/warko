import { expect, type Page, test } from "@playwright/test";
import {
  apiAs,
  closeOpened,
  getOrder,
  listOrders,
  MENU,
  PRINT_PROBE,
  placeSelfOrder,
  productStock,
  rp,
  setKitchen,
  settleCash,
  staffContext,
  staffPage,
  totalOf,
} from "../helpers";

const REALTIME = { timeout: 10_000 };
test.afterEach(closeOpened);

const tableCard = (page: Page, name: string) => page.locator("article", { has: page.getByRole("heading", { name, exact: true }) });
const addToPos = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name}, Rp .*(Tambahkan|Tambah satu porsi lagi) ke pesanan$`) }).click();
const lastToastNo = async (page: Page, pattern: RegExp) =>
  Number((await page.getByText(pattern).first().textContent())?.match(/#(\d+)/)?.[1]);

async function cashSales(page: Page): Promise<number> {
  await page.goto("/laci-kas");
  const metrics = page.getByRole("region", { name: "Ringkasan kas shift berjalan" });
  await expect(metrics).toBeVisible();
  const text = ((await metrics.textContent()) ?? "").replace(/\s+/g, " ");
  const match = /Penjualan Tunai Shift\s*Rp\s?([\d.]+)/i.exec(text);
  expect(match, text).not.toBeNull();
  return Number(match?.[1].replace(/\./g, ""));
}

test("KSR-03 denah meja difilter per lantai, ringkasan kosong/terisi benar", async ({ browser }) => {
  const page = await staffPage(browser, "kasir", "/meja");
  const ctx = await apiAs(null);
  const tables: { id: string; area: string }[] = (await (await ctx.get("/api/public/menu")).json()).data.tables;
  await ctx.dispose();
  const filter = page.getByRole("tablist", { name: "Filter lantai" });
  await expect(filter.getByRole("tab", { name: `Semua (${tables.length})` })).toBeVisible();
  for (const floor of ["Lantai 1", "Lantai 2", "Rooftop"]) {
    const n = tables.filter((t) => t.area === floor).length;
    await filter.getByRole("tab", { name: `${floor} (${n})` }).click();
    await expect(page.getByText(`${n} meja di ${floor}`)).toBeVisible();
    await expect(page.locator("main article").filter({ has: page.locator("h3 button") })).toHaveCount(n);
    const free = await page.getByText(/^\d+ kosong$/).textContent();
    const busy = await page.getByText(/^\d+ terisi$/).textContent();
    expect(Number(free?.match(/\d+/)?.[0]) + Number(busy?.match(/\d+/)?.[0])).toBe(n);
  }
});

test("KSR-04…07 status meja real-time: hijau kosong, amber terisi, kembali kosong hanya jika lunas & diantar", async ({ browser }) => {
  const page = await staffPage(browser, "kasir", "/meja");
  const card = tableCard(page, "Meja 13");
  await expect(card.getByText("Kosong", { exact: true })).toBeVisible();
  await expect(card).toHaveClass(/border-success/);

  const first = await placeSelfOrder("l1-m13", [{ key: "esteh", qty: 1 }]);
  await expect(card.getByText("Terisi", { exact: true })).toBeVisible(REALTIME);
  await expect(card).toHaveClass(/border-warning/);

  // Diantar tapi belum bayar → tetap terisi.
  await setKitchen(first.no, "served");
  await page.waitForTimeout(6000);
  await expect(card.getByText("Terisi", { exact: true })).toBeVisible();
  // Lunas & diantar → kosong.
  expect((await settleCash(first.no, first.total)).status).toBe(200);
  await expect(card.getByText("Kosong", { exact: true })).toBeVisible(REALTIME);

  // Lunas tapi belum diantar → tetap terisi.
  const second = await placeSelfOrder("l1-m13", [{ key: "esteh", qty: 1 }]);
  expect((await settleCash(second.no, second.total)).status).toBe(200);
  await expect(card.getByText("Terisi", { exact: true })).toBeVisible(REALTIME);
  await setKitchen(second.no, "served");
  await expect(card.getByText("Kosong", { exact: true })).toBeVisible(REALTIME);
});

test("KSR-08 takeaway bayar tunai: kembalian benar, lunas, stok berkurang", async ({ browser }) => {
  const ctx = await staffContext(browser, "kasir");
  await ctx.addInitScript(PRINT_PROBE);
  const page = await ctx.newPage();
  await page.goto("/");
  const stockBefore = await productStock("mieayam");
  await addToPos(page, MENU.mieayam.name);
  const cart = page.getByRole("region", { name: "Pesanan saat ini" });
  await cart.getByRole("button", { name: "Bawa pulang" }).click();
  const total = totalOf(MENU.mieayam.price);
  await page.getByRole("button", { name: /^Bayar Rp/ }).click();
  const dialog = page.getByRole("dialog", { name: "Terima pembayaran" });
  await dialog.getByRole("button", { name: /^Tunai/ }).click();
  await dialog.getByLabel(/uang yang diterima/i).fill("100000");
  await expect(dialog.getByText(rp(100000 - total))).toBeVisible();
  await dialog.getByRole("button", { name: "Selesaikan pembayaran" }).click();
  await expect(page.getByText("Pembayaran berhasil")).toBeVisible();
  await expect(page.getByText(new RegExp(`Kembalian ${rp(100000 - total).source}`))).toBeVisible();
  const no = await lastToastNo(page, /Pesanan #\d+ · Rp/);
  const order = await getOrder(no);
  expect(order.paymentStatus).toBe("paid");
  expect(order.method).toBe("tunai");
  expect(order.orderType).toBe("bawa-pulang");
  expect(order.cashReceived).toBe(100000);
  expect(order.kitchenStatus).toBe("queued");
  expect(await productStock("mieayam")).toBe((stockBefore ?? 0) - 1);

  // KSR-17 & KSR-19: cetak struk dari notifikasi pembayaran
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Cetak struk" }).first().click();
  await expect.poll(() => page.evaluate(() => window.__prints.length)).toBe(1);
  const printed = (await page.evaluate(() => window.__prints[0])).replace(/\s+/g, " ");
  for (const part of [
    "WAKRO",
    `PESANAN ${no}`,
    MENU.mieayam.name,
    "Pajak",
    "TOTAL",
    "Kasir: Jamie Kasir",
    "Simpan struk ini sebagai bukti pembayaran.",
  ]) {
    expect(printed, part).toContain(part);
  }
  expect(printed).toMatch(/BAWA PULANG|Takeaway/);
  expect(printed).toMatch(rp(total));
  expect(printed).toMatch(/Tunai/i);
  expect(printed).toMatch(rp(100000 - total));
  expect(printed).toMatch(/\d{2}[.:]\d{2}/);
});

test("KSR-09 walk-in makan di tempat + catatan, Kirim ke dapur (bayar nanti)", async ({ browser }) => {
  const page = await staffPage(browser, "kasir", "/");
  await addToPos(page, MENU.nasgor.name);
  const cart = page.getByRole("region", { name: "Pesanan saat ini" });
  await cart.getByRole("button", { name: "Makan di tempat" }).click();
  await cart.getByLabel("Pilih meja").selectOption({ label: "Meja 14" });
  await cart.getByRole("button", { name: "+ Catatan" }).click();
  await cart.getByLabel(`Catatan untuk ${MENU.nasgor.name}`).fill("tidak pedas");
  await cart.getByRole("button", { name: "Simpan catatan" }).click();
  await page.getByRole("button", { name: "Kirim ke dapur" }).click();
  await expect(page.getByText(/Pesanan #\d+ dikirim ke dapur/)).toBeVisible();
  const no = await lastToastNo(page, /Pesanan #\d+ dikirim ke dapur/);
  const order = await getOrder(no);
  expect(order.paymentStatus).toBe("unpaid");
  expect(order.tableId).toBe("l2-m14");
  expect(order.items[0].note).toBe("tidak pedas");
  await page.goto("/meja");
  await expect(tableCard(page, "Meja 14").getByText("Terisi", { exact: true })).toBeVisible();
});

test("KSR-10 menu HABIS terkunci di POS", async ({ browser }) => {
  const page = await staffPage(browser, "kasir", "/");
  const button = page.getByRole("button", { name: new RegExp(`^${MENU.kerupuk.name}, habis`) });
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
});

test("KSR-11, KSR-14, KSR-20 diskon 10% + PPN, uang pas, cetak ulang dari Pesanan", async ({ browser }) => {
  const ctx = await staffContext(browser, "kasir");
  await ctx.addInitScript(PRINT_PROBE);
  const page = await ctx.newPage();
  await page.goto("/");
  await addToPos(page, MENU.nasgor.name);
  await addToPos(page, MENU.nasgor.name);
  const cart = page.getByRole("region", { name: "Pesanan saat ini" });
  await cart.getByRole("button", { name: "Bawa pulang" }).click();
  await cart.getByRole("button", { name: "+ Tambah diskon / promo" }).click();
  const discount = page.getByRole("dialog", { name: "Terapkan diskon / potongan" });
  await discount.getByRole("button", { name: "Persen (%)" }).click();
  await discount.getByLabel("Nilai diskon (%)").fill("10");
  await discount.getByRole("button", { name: "Terapkan diskon" }).click();
  // 50.000 − 5.000 = 45.000; PPN 11% = 4.950; total 49.950
  await expect(cart).toContainText(rp(5000));
  await expect(cart).toContainText(rp(4950));
  await page.getByRole("button", { name: "Bayar Rp 49.950" }).click();
  const dialog = page.getByRole("dialog", { name: "Terima pembayaran" });
  await dialog.getByRole("button", { name: /^Tunai/ }).click();
  await dialog.getByRole("button", { name: "Uang pas" }).click();
  await expect(dialog.getByLabel(/uang yang diterima/i)).toHaveValue(/49\.?950/);
  await expect(dialog.getByRole("button", { name: rp(50000) })).toBeVisible();
  await dialog.getByRole("button", { name: "Selesaikan pembayaran" }).click();
  const no = await lastToastNo(page, /Pesanan #\d+ · Rp/);
  const order = await getOrder(no);
  expect([order.subtotal, order.discount, order.tax, order.total]).toEqual([45000, 5000, 4950, 49950]); // subtotal server = setelah diskon

  await page.goto("/pesanan");
  await page.getByRole("tab", { name: /^Semua/ }).click();
  await page.getByRole("button", { name: `Cetak struk pesanan ${no}` }).click();
  await expect.poll(() => page.evaluate(() => window.__prints.length)).toBe(1);
  const printed = (await page.evaluate(() => window.__prints[0])).replace(/\s+/g, " ");
  expect(printed).toContain(`PESANAN ${no}`);
  expect(printed).toContain("Diskon");
  expect(printed).toMatch(rp(49950));
});

test("KSR-12, KSR-13, KSR-15 terima tunai pesanan QR meja dari halaman Pesanan", async ({ browser }) => {
  const page = await staffPage(browser, "kasir", "/");
  const before = await cashSales(page);
  const order = await placeSelfOrder("l2-m15", [
    { key: "nasgor", qty: 1 },
    { key: "esteh", qty: 1 },
  ]);
  const countBefore = (await listOrders()).length;
  await page.goto("/pesanan");
  await page.getByRole("tab", { name: /^Belum Bayar/ }).click();
  await page.getByLabel("Cari pesanan").fill(String(order.no));
  const row = page.getByRole("row", { name: new RegExp(`#?${order.no}\\b`) });
  await expect(row).toBeVisible(REALTIME);
  await row.getByRole("button", { name: "Terima Bayar" }).click();
  const dialog = page.getByRole("dialog", { name: "Terima pembayaran" });
  await dialog.getByRole("button", { name: /^Tunai/ }).click();
  // KSR-13 uang kurang
  await dialog.getByLabel(/uang yang diterima/i).fill("1000");
  await expect(dialog.getByText(/Kurang: Rp/)).toBeVisible();
  await expect(dialog.getByText("Uang tunai masih kurang")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Selesaikan pembayaran" })).toBeDisabled();
  await dialog.getByLabel(/uang yang diterima/i).fill("50000");
  await dialog.getByRole("button", { name: "Selesaikan pembayaran" }).click();
  await expect(page.getByText("Pembayaran berhasil")).toBeVisible();
  await page.getByRole("tab", { name: /^Semua/ }).click();
  await expect(page.getByRole("row", { name: new RegExp(`#?${order.no}\\b`) }).getByText("Lunas · Tunai")).toBeVisible();
  const after = await getOrder(order.no);
  expect(after.paymentStatus).toBe("paid");
  expect((await listOrders()).length).toBe(countBefore);
  expect(await cashSales(page)).toBe(before + order.total);
});

test("KSR-16 dua kasir menerima bayar pesanan yang sama → tercatat sekali", async ({ browser }) => {
  const order = await placeSelfOrder("rt-m16", [{ key: "esteh", qty: 2 }]);
  const a = await staffPage(browser, "kasir", "/pesanan");
  const b = await staffPage(browser, "kasir2", "/pesanan");
  const before = await cashSales(await staffPage(browser, "kasir", "/laci-kas"));
  for (const page of [a, b]) {
    await page.getByLabel("Cari pesanan").fill(String(order.no));
    await expect(page.getByRole("row", { name: new RegExp(`#?${order.no}\\b`) })).toBeVisible(REALTIME);
    await page
      .getByRole("row", { name: new RegExp(`#?${order.no}\\b`) })
      .getByRole("button", { name: "Terima Bayar" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Terima pembayaran" });
    await dialog.getByRole("button", { name: /^Tunai/ }).click();
    await dialog.getByRole("button", { name: "Uang pas" }).click();
  }
  await Promise.all(
    [a, b].map((page) =>
      page.getByRole("dialog", { name: "Terima pembayaran" }).getByRole("button", { name: "Selesaikan pembayaran" }).click(),
    ),
  );
  await expect(a.getByText(/Pembayaran berhasil|sudah lunas sebelumnya/).first()).toBeVisible();
  await expect(b.getByText(/Pembayaran berhasil|sudah lunas sebelumnya/).first()).toBeVisible();
  const messages = [
    await a
      .getByText(/Pembayaran berhasil|sudah lunas sebelumnya/)
      .first()
      .textContent(),
    await b
      .getByText(/Pembayaran berhasil|sudah lunas sebelumnya/)
      .first()
      .textContent(),
  ];
  expect(messages.filter((m) => m?.includes("sudah lunas sebelumnya"))).toHaveLength(1);
  expect(await cashSales(a)).toBe(before + order.total);
});

test("KSR-21 printer Bluetooth tidak tersedia → pesan gagal, transaksi tetap tersimpan", async ({ browser }) => {
  const ctx = await staffContext(browser, "kasir");
  // Tanpa printer terdekat, pemilih perangkat Chrome berakhir dengan NotFoundError.
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "bluetooth", {
      value: {
        requestDevice: () =>
          Promise.reject(Object.assign(new Error("User cancelled the requestDevice() chooser."), { name: "NotFoundError" })),
      },
    });
  });
  const page = await ctx.newPage();
  await page.goto("/pengaturan");
  await page.getByRole("button", { name: "Thermal Bluetooth (ESC/POS)" }).click();
  await expect(page.getByText("Driver printer diubah ke: Thermal Bluetooth (ESC/POS)")).toBeVisible();
  await page.goto("/");
  await addToPos(page, MENU.esteh.name);
  await page.getByRole("region", { name: "Pesanan saat ini" }).getByRole("button", { name: "Bawa pulang" }).click();
  await page.getByRole("button", { name: /^Bayar Rp/ }).click();
  const dialog = page.getByRole("dialog", { name: "Terima pembayaran" });
  await dialog.getByRole("button", { name: /^Tunai/ }).click();
  await dialog.getByRole("button", { name: "Uang pas" }).click();
  await dialog.getByRole("button", { name: "Selesaikan pembayaran" }).click();
  const no = await lastToastNo(page, /Pesanan #\d+ · Rp/);
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Cetak struk" }).first().click();
  await expect(page.getByText("Pemilihan printer Bluetooth dibatalkan.")).toBeVisible();
  expect((await getOrder(no)).paymentStatus).toBe("paid");
});

test("KSR-22 tambah meja Rooftop → muncul di denah & pilihan pelanggan", async ({ browser }) => {
  const page = await staffPage(browser, "kasir", "/meja");
  await page.getByRole("button", { name: "Tambah Meja" }).click();
  const dialog = page.getByRole("dialog", { name: "Tambah meja baru" });
  await dialog.getByLabel("Nama / nomor meja").fill("Meja 20");
  await dialog.getByLabel("Lantai / area").fill("Rooftop");
  await dialog.getByRole("button", { name: "Simpan meja" }).click();
  await expect(page.getByText('Meja "Meja 20" berhasil ditambahkan ke area "Rooftop"')).toBeVisible();
  await page
    .getByRole("tablist", { name: "Filter lantai" })
    .getByRole("tab", { name: /^Rooftop/ })
    .click();
  await expect(tableCard(page, "Meja 20")).toBeVisible();
  const ctx = await apiAs(null);
  const tables: { name: string; area: string }[] = (await (await ctx.get("/api/public/menu")).json()).data.tables;
  await ctx.dispose();
  expect(tables).toContainEqual(expect.objectContaining({ name: "Meja 20", area: "Rooftop" }));
});

test("KSR-23 meja dengan pesanan aktif/belum bayar tidak bisa dihapus", async ({ browser }) => {
  await placeSelfOrder("rt-m17", [{ key: "esteh", qty: 1 }]);
  const page = await staffPage(browser, "kasir", "/meja");
  await expect(tableCard(page, "Meja 17").getByText("Terisi", { exact: true })).toBeVisible(REALTIME);
  await page.getByRole("button", { name: "Ubah Meja 17" }).click();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Hapus meja" }).click();
  const confirm = page.getByRole("dialog").filter({ hasText: 'Yakin ingin menghapus "Meja 17"?' });
  if (await confirm.isVisible().catch(() => false)) await confirm.getByRole("button", { name: /Hapus/ }).last().click();
  await expect(page.getByText(/Meja masih memiliki pesanan aktif atau belum dibayar|Gagal menghapus meja/).first()).toBeVisible();
  const api = await apiAs("kasir");
  const res = await api.delete("/api/resources/tables/rt-m17");
  expect(res.status()).toBe(409);
  expect(await res.text()).toMatch(/pesanan/i);
  await api.dispose();
});

test("KSR-25 klik Selesaikan pembayaran berulang → satu pesanan & satu pembayaran", async ({ browser }) => {
  const page = await staffPage(browser, "kasir", "/");
  const before = (await listOrders()).length;
  await addToPos(page, MENU.esteh.name);
  await page.getByRole("region", { name: "Pesanan saat ini" }).getByRole("button", { name: "Bawa pulang" }).click();
  await page.getByRole("button", { name: /^Bayar Rp/ }).click();
  const dialog = page.getByRole("dialog", { name: "Terima pembayaran" });
  await dialog.getByRole("button", { name: /^Tunai/ }).click();
  await dialog.getByRole("button", { name: "Uang pas" }).click();
  await dialog.getByRole("button", { name: "Selesaikan pembayaran" }).evaluate((button: HTMLButtonElement) => {
    for (let i = 0; i < 5; i++) button.click();
  });
  await expect(page.getByText("Pembayaran berhasil")).toBeVisible();
  await page.waitForTimeout(1500);
  expect((await listOrders()).length - before).toBe(1);
});
