import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { type APIResponse, expect, type Page, test } from "@playwright/test";
import {
  apiAs,
  closeOpened,
  MENU,
  newContext,
  PRINT_PROBE,
  placeSelfOrder,
  productStock,
  rp,
  setStock,
  settleCash,
  staffContext,
  staffPage,
} from "../helpers";
import { UAT } from "../uat-env.mjs";

type Xlsx = {
  read(data: Buffer): { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: { sheet_to_csv(sheet: unknown): string };
};
// xlsx belongs to the web app (its exporter), not to this package: load it from there, typed by the subset used here.
const XLSX = createRequire(new URL("../../../web/package.json", import.meta.url))("xlsx") as Xlsx;

const REALTIME = { timeout: 10_000 };
test.afterEach(closeOpened);

type ReportOrder = {
  no: number;
  total: number;
  paymentStatus: string;
  paidAt: number | null;
  method: string | null;
  items: { name: string; qty: number; price: number }[];
};

/** Midnight today and tomorrow in Asia/Jakarta (UTC+7, no DST). */
function todayRange(): { from: number; to: number } {
  const offset = 7 * 3600_000;
  const from = Math.floor((Date.now() + offset) / 86_400_000) * 86_400_000 - offset;
  return { from, to: from + 86_400_000 };
}

async function expectedToday() {
  const { from, to } = todayRange();
  const ctx = await apiAs("manajer");
  const rows: ReportOrder[] = [];
  let cursor: string | null = null;
  do {
    const res: APIResponse = await ctx.get(
      `/api/reports/orders?from=${from}&to=${to}&limit=500${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    expect(res.status(), await res.text()).toBe(200);
    const body: { data: ReportOrder[]; nextCursor?: string | null } = await res.json();
    rows.push(...body.data);
    cursor = body.nextCursor ?? null;
  } while (cursor);
  await ctx.dispose();
  const paid = rows.filter((o) => o.paymentStatus === "paid" && o.paidAt !== null && o.paidAt >= from && o.paidAt < to);
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const qty = new Map<string, number>();
  for (const o of paid) for (const i of o.items) qty.set(i.name, (qty.get(i.name) ?? 0) + i.qty);
  const top = [...qty.entries()].sort((a, b) => b[1] - a[1]);
  return {
    paid,
    revenue,
    count: paid.length,
    average: paid.length ? Math.round(revenue / paid.length) : 0,
    top,
    unpaid: rows.filter((o) => o.paymentStatus !== "paid"),
  };
}

async function metric(page: Page, label: string): Promise<string> {
  const strip = page.getByRole("region", { name: "Ringkasan penjualan" });
  const cell = strip.locator("div", { has: page.getByText(label, { exact: true }) }).last();
  return (await cell.textContent())?.replace(label, "").trim() ?? "";
}

test("OWN-01 login owner langsung ke Dashboard Owner", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await page.goto("/");
  await page.getByLabel(/nama pengguna/i).fill(UAT.staff.manajer.username);
  await page.getByLabel(/kata sandi/i).fill(UAT.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/laporan$/);
  await expect(page.getByText("Dashboard Owner").first()).toBeVisible();
});

test("OWN-02…05 omset, jumlah & rata-rata transaksi, produk terlaris sesuai data lunas", async ({ browser }) => {
  const page = await staffPage(browser, "manajer", "/laporan");
  await page.getByRole("button", { name: "Muat ulang laporan" }).click();
  const exp = await expectedToday();
  expect(exp.count).toBeGreaterThan(0);
  expect(exp.unpaid.length).toBeGreaterThan(0); // ada pesanan belum bayar yang tidak boleh ikut dihitung
  await expect.poll(() => metric(page, "Total omset")).toMatch(rp(exp.revenue));
  expect(await metric(page, "Jumlah transaksi")).toContain(String(exp.count));
  expect(await metric(page, "Rata-rata transaksi")).toMatch(rp(exp.average));
  expect(await metric(page, "Produk terlaris")).toContain(exp.top[0][0]);
  const top = page.getByRole("region", { name: "Produk terlaris" });
  await expect(top.getByText(exp.top[0][0]).first()).toBeVisible();
  await expect(top).toContainText(`${exp.top[0][1]} porsi`);
});

test("OWN-06 metrik ikut bertambah saat kasir menerima pembayaran baru", async ({ browser }) => {
  const page = await staffPage(browser, "manajer", "/laporan");
  const before = await expectedToday();
  await expect.poll(() => metric(page, "Total omset")).toMatch(rp(before.revenue));
  const order = await placeSelfOrder("l1-m18", [{ key: "nasgor", qty: 1 }]);
  expect((await settleCash(order.no, order.total)).status).toBe(200);
  await expect.poll(() => metric(page, "Total omset"), REALTIME).toMatch(rp(before.revenue + order.total));
  expect(await metric(page, "Jumlah transaksi")).toContain(String(before.count + 1));
});

test("OWN-07 & OWN-08 grafik interaktif dan periode laporan", async ({ browser }) => {
  const page = await staffPage(browser, "manajer", "/laporan");
  const chart = page.getByRole("region", { name: "Grafik omset" });
  await expect(chart.getByText("Grafik omset per jam")).toBeVisible();
  const exp = await expectedToday();
  const hour = new Date((exp.paid[0].paidAt ?? 0) + 7 * 3600_000).getUTCHours().toString().padStart(2, "0");
  const bar = chart.locator(`[title^="${hour}:00 — "]`);
  await expect(bar).toHaveCount(1);
  await bar.hover();
  expect(await bar.getAttribute("title")).toMatch(/Rp\s?[\d.]+ · \d+ transaksi/);
  for (const preset of ["7 hari", "30 hari", "Bulan ini"]) {
    await page.getByRole("tablist", { name: "Periode laporan" }).getByRole("tab", { name: preset }).click();
    await expect(chart.getByText("Grafik omset per hari")).toBeVisible();
    await expect.poll(() => metric(page, "Total omset")).toMatch(rp(exp.revenue));
  }
  await page.getByRole("tablist", { name: "Periode laporan" }).getByRole("tab", { name: "Pilih tanggal" }).click();
  await expect(page.getByLabel("Dari tanggal")).toBeVisible();
  await expect(page.getByLabel("Sampai tanggal")).toBeVisible();
});

test("OWN-09 periode tanpa transaksi menampilkan pesan kosong", async ({ browser }) => {
  const page = await staffPage(browser, "manajer", "/laporan");
  await page.getByRole("tablist", { name: "Periode laporan" }).getByRole("tab", { name: "Pilih tanggal" }).click();
  await page.getByLabel("Dari tanggal").fill("2025-01-01");
  await page.getByLabel("Sampai tanggal").fill("2025-01-02");
  await expect(page.getByText("Belum ada penjualan pada periode ini").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "CSV" })).toBeDisabled();
});

test("OWN-10…13 owner atur stok: set, peringatan < 5, tidak boleh negatif, berhenti lacak", async ({ browser }) => {
  const page = await staffPage(browser, "manajer", "/produk");
  await expect(page.getByText("Peran Anda hanya dapat mengubah stok.", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: `Atur stok ${MENU.tahu.name}` }).click();
  let modal = page.getByRole("dialog", { name: `Stok siap jual · ${MENU.tahu.name}` });
  await modal.getByRole("button", { name: "Atur jumlah" }).click();
  await modal.getByLabel("Jumlah porsi tersedia").fill("6");
  await modal.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(`Stok ${MENU.tahu.name} diperbarui.`)).toBeVisible();
  expect(await productStock("tahu")).toBe(6);

  await page.getByRole("button", { name: `Atur stok ${MENU.tahu.name}` }).click();
  modal = page.getByRole("dialog", { name: `Stok siap jual · ${MENU.tahu.name}` });
  await modal.getByRole("button", { name: "Tambah / kurangi" }).click();
  await modal.getByLabel("Perubahan (contoh 10 atau -2)").fill("-2");
  await expect(modal.getByText("Stok menjadi: 4 porsi")).toBeVisible();
  await modal.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/menu stok menipis \(< 5 porsi\)/)).toBeVisible();
  const reports = await staffPage(browser, "manajer", "/laporan");
  await expect(reports.getByText("Sisa stok produk jadi")).toBeVisible();
  await expect(reports.locator("li, div", { hasText: MENU.tahu.name }).filter({ hasText: "Sisa 4" }).first()).toBeVisible();
  const customer = await (await newContext(browser)).newPage();
  await customer.goto("/order/l1-m1");
  await expect(customer.locator("article", { hasText: MENU.tahu.name }).getByText("Sisa 4")).toBeVisible();

  await page.getByRole("button", { name: `Atur stok ${MENU.tahu.name}` }).click();
  modal = page.getByRole("dialog", { name: `Stok siap jual · ${MENU.tahu.name}` });
  await modal.getByRole("button", { name: "Tambah / kurangi" }).click();
  await modal.getByLabel("Perubahan (contoh 10 atau -2)").fill("-10");
  await expect(modal.getByText("Stok menjadi: tidak boleh negatif")).toBeVisible();
  await expect(modal.getByRole("button", { name: "Simpan" })).toBeDisabled();
  await modal.getByRole("button", { name: "Batal" }).click();
  const api = await apiAs("manajer");
  expect((await api.post(`/api/products/${MENU.tahu.barcode}/stock`, { data: { mode: "add", qty: -10 } })).status()).toBeGreaterThanOrEqual(
    400,
  );
  await api.dispose();
  expect(await productStock("tahu")).toBe(4);

  await page.getByRole("button", { name: `Atur stok ${MENU.esteh.name}` }).click();
  modal = page.getByRole("dialog", { name: `Stok siap jual · ${MENU.esteh.name}` });
  await modal.getByRole("button", { name: "Atur jumlah" }).click();
  await modal.getByLabel("Jumlah porsi tersedia").fill("30");
  await modal.getByRole("button", { name: "Simpan" }).click();
  expect(await productStock("esteh")).toBe(30);
  await page.getByRole("button", { name: `Atur stok ${MENU.esteh.name}` }).click();
  modal = page.getByRole("dialog", { name: `Stok siap jual · ${MENU.esteh.name}` });
  await modal.getByRole("button", { name: "Berhenti lacak" }).click();
  await expect(page.getByText(`${MENU.esteh.name} tidak lagi dilacak stoknya.`)).toBeVisible();
  expect(await productStock("esteh")).toBeNull();
});

test("OWN-14…16 stok berkurang otomatis, HABIS di 0 (terkunci), terbuka lagi setelah ditambah", async ({ browser }) => {
  await setStock("tahu", 6, "manajer");
  const owner = await staffPage(browser, "manajer", "/produk");
  await placeSelfOrder("l1-m19", [{ key: "tahu", qty: 2 }]);
  expect(await productStock("tahu")).toBe(4);
  await expect(owner.getByText(/menu stok menipis/)).toBeVisible(REALTIME);
  await placeSelfOrder("l1-m19", [{ key: "tahu", qty: 4 }]);
  expect(await productStock("tahu")).toBe(0);
  await expect(owner.getByText(/menu HABIS \(terkunci di menu pelanggan & kasir\)/)).toBeVisible(REALTIME);

  const phone = await (await newContext(browser)).newPage();
  await phone.goto("/order/l1-m19");
  await expect(phone.locator("article", { hasText: MENU.tahu.name }).getByText("Menu habis hari ini")).toBeVisible();
  const pos = await staffPage(browser, "kasir", "/");
  await expect(pos.getByRole("button", { name: new RegExp(`^${MENU.tahu.name}, habis`) })).toBeDisabled();
  const ctx = await apiAs(null);
  const rejected = await ctx.post("/api/public/orders", {
    data: {
      tableId: "l1-m19",
      expectedTotal: 3330,
      clientRef: "own15-habis-0123456789abcdef",
      items: [{ barcode: MENU.tahu.barcode, qty: 1 }],
    },
  });
  expect(rejected.status()).toBeGreaterThanOrEqual(400);
  await ctx.dispose();

  await setStock("tahu", 10, "manajer");
  await phone.reload();
  await expect(phone.getByRole("button", { name: `Tambah ${MENU.tahu.name}` })).toBeVisible();
  await pos.reload();
  await expect(pos.getByRole("button", { name: new RegExp(`^${MENU.tahu.name}, Rp .*Tambahkan ke pesanan$`) })).toBeEnabled();
});

test("OWN-17…20 riwayat transaksi, ekspor CSV, Excel, Cetak/PDF", async ({ browser }) => {
  const ctx = await staffContext(browser, "manajer", { acceptDownloads: true });
  await ctx.addInitScript(PRINT_PROBE);
  const page = await ctx.newPage();
  await page.goto("/laporan");
  const exp = await expectedToday();
  const history = page.getByRole("region", { name: "Riwayat transaksi" });
  await expect(history.getByRole("heading", { name: `Riwayat transaksi (${exp.count})` })).toBeVisible();
  for (const column of ["No", "Dibayar", "Meja", "Metode", "Kasir", "Item", "Total"]) {
    await expect(history.getByRole("columnheader", { name: column })).toBeVisible();
  }
  await expect(history.locator("tbody tr")).toHaveCount(exp.count);
  const sample = exp.paid[0];
  await expect(history.locator("tbody tr").filter({ has: page.getByRole("cell", { name: `#${sample.no}`, exact: true }) })).toContainText(
    rp(sample.total),
  );

  const [csvDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "CSV" }).click()]);
  const csv = readFileSync(await csvDownload.path(), "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM agar Excel membaca UTF-8
  const lines = csv
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);
  test.info().annotations.push({ type: "CSV header", description: lines[0] });
  expect(lines[0]).toContain(";");
  expect(lines.length - 1).toBe(exp.count);
  expect(csv).toContain(String(sample.no));
  expect(csv).toContain(String(sample.total));

  const [xlsxDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Excel" }).click()]);
  expect(xlsxDownload.suggestedFilename()).toMatch(/\.xlsx$/);
  const book = XLSX.read(readFileSync(await xlsxDownload.path()));
  const sheetText = book.SheetNames.map((n) => XLSX.utils.sheet_to_csv(book.Sheets[n])).join("\n");
  test.info().annotations.push({ type: "Excel sheets", description: book.SheetNames.join(", ") });
  expect(sheetText).toContain(String(sample.no));
  expect(sheetText).toContain(String(sample.total));

  await page.getByRole("button", { name: "Cetak / PDF" }).click();
  await expect.poll(() => page.evaluate(() => window.__prints.length)).toBe(1);
  expect(await page.evaluate(() => window.__prints[0])).toContain("Laporan Penjualan");
});

test("OWN-21 & OWN-22 owner: POS & dapur terkunci, Pesanan & Meja hanya lihat, aksi kasir ditolak server", async ({ browser }) => {
  const page = await staffPage(browser, "manajer", "/laporan");
  await page.goto("/");
  await expect(page).toHaveURL(/\/laporan$/);
  for (const path of ["/dapur", "/pelayan"]) {
    await page.goto(path);
    await expect(page.getByText("Akses Terkunci untuk Peran Ini")).toBeVisible();
  }
  await page.goto("/pesanan");
  await expect(page.getByRole("heading", { name: "Pesanan" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Terima Bayar" })).toHaveCount(0);
  await page.goto("/meja");
  await expect(page.getByText("Peran Anda hanya dapat melihat meja.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tambah Meja" })).toHaveCount(0);
  await page.goto("/produk");
  await expect(page.getByRole("button", { name: /^Ubah produk/ })).toHaveCount(0);

  const order = await placeSelfOrder("l1-m18", [{ key: "esteh", qty: 1 }]);
  const api = await apiAs("manajer");
  expect((await api.post(`/api/orders/${order.no}/payment`, { data: { method: "tunai", cashReceived: 10000 } })).status()).toBe(403);
  expect(
    (
      await api.put("/api/pricing", { data: { taxEnabled: false, taxRate: 0, serviceChargeEnabled: false, serviceChargeRate: 0 } })
    ).status(),
  ).toBe(403);
  expect((await api.put("/api/resources/tables/meja-x", { data: { name: "Meja X", seats: 2, area: "Lantai 1" } })).status()).toBe(403);
  await api.dispose();
});
