import { expect, type Page, test } from "@playwright/test";
import {
  AUDIO_PROBE,
  apiAs,
  authFile,
  closeOpened,
  getOrder,
  listOrders,
  MENU,
  newContext,
  placeSelfOrder,
  placeStaffOrder,
  setKitchen,
  settleCash,
  staffPage,
} from "../helpers";
import { UAT } from "../uat-env.mjs";

const REALTIME = { timeout: 10_000 };

test.afterEach(closeOpened);
const ticket = (page: Page, no: number) => page.locator(".service-ticket", { has: page.getByText(`#${no}`, { exact: true }) });

test("DPR-01 login dapur langsung ke Layar Dapur", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  await page.goto("/");
  await page.getByLabel(/nama pengguna/i).fill(UAT.staff.dapur.username);
  await page.getByLabel(/kata sandi/i).fill(UAT.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dapur$/);
  await expect(page.getByText("Layar Dapur (KDS)").first()).toBeVisible();
});

test("DPR-02 & DPR-03 bel aktif dan berbunyi + toast saat pesanan baru masuk", async ({ browser }) => {
  const ctx = await newContext(browser, { storageState: authFile("dapur") });
  await ctx.addInitScript(AUDIO_PROBE);
  const page = await ctx.newPage();
  await page.goto("/dapur");
  await page.getByRole("button", { name: "Aktifkan bel" }).click();
  await expect(page.getByRole("button", { name: "Bel aktif" })).toBeVisible();
  await expect(page.getByText("Bel pesanan masuk aktif")).toBeVisible();
  const afterEnable = await page.evaluate(() => window.__oscStarts);
  expect(afterEnable).toBeGreaterThan(0);

  const order = await placeSelfOrder("l1-m1", [{ key: "esteh", qty: 2 }]);
  await expect(page.getByText(`Pesanan baru #${order.no} · Meja 1 · Lantai 1`)).toBeVisible(REALTIME);
  await expect(page.getByText("2 item · Belum bayar")).toBeVisible();
  expect(await page.evaluate(() => window.__oscStarts)).toBeGreaterThan(afterEnable);
});

test("DPR-04…08 kartu otomatis dari 3 sumber, FIFO, detail lengkap", async ({ browser }) => {
  const page = await staffPage(browser, "dapur", "/dapur");
  const self = await placeSelfOrder(
    "rt-m10",
    [
      { key: "nasgor", qty: 2, note: "pedas level 3" },
      { key: "esteh", qty: 1 },
    ],
    "Rina",
  );
  const pos = await placeStaffOrder("kasir", { lines: [{ key: "mieayam", qty: 1 }], cashReceived: 50000, customerName: "Walk-in" });
  const waiter = await placeStaffOrder("pelayan", { tableId: "l2-m6", lines: [{ key: "esteh", qty: 3 }], source: "waiter" });

  const t1 = ticket(page, self.no);
  const t2 = ticket(page, pos.no);
  const t3 = ticket(page, waiter.no);
  await expect(t1).toBeVisible(REALTIME);
  await expect(t2).toBeVisible(REALTIME);
  await expect(t3).toBeVisible(REALTIME);

  // DPR-04 asal pesanan
  await expect(t1).toContainText("QR Self-Order");
  await expect(t2).toContainText("Kasir POS");
  await expect(t3).toContainText("Pelayan: Budi Pelayan");
  // DPR-05 FIFO
  const pos1 = Number((await t1.getByText(/Urutan ke-\d+/).textContent())?.match(/\d+/)?.[0]);
  const pos2 = Number((await t2.getByText(/Urutan ke-\d+/).textContent())?.match(/\d+/)?.[0]);
  const pos3 = Number((await t3.getByText(/Urutan ke-\d+/).textContent())?.match(/\d+/)?.[0]);
  expect(pos1).toBeLessThan(pos2);
  expect(pos2).toBeLessThan(pos3);
  // DPR-06 menu & porsi, DPR-07 meja/lantai/takeaway, DPR-08 catatan & status bayar
  await expect(t1).toContainText(MENU.nasgor.name);
  await expect(t1).toContainText(/2\s*×|2x|×\s*2/);
  await expect(t1).toContainText("Meja 10");
  await expect(t1).toContainText(/Rooftop/i);
  await expect(t1).toContainText("pedas level 3");
  await expect(t1).toContainText("BELUM BAYAR");
  await expect(t2).toContainText("Takeaway");
  await expect(t2).toContainText("LUNAS");
  await expect(t3).toContainText(/Lantai 2/i);
});

test("DPR-09…11 Mulai masak → Selesai & siap → Sudah diantar, status pelanggan ikut", async ({ browser }) => {
  const page = await staffPage(browser, "dapur", "/dapur");
  const order = await placeSelfOrder("rt-m11", [{ key: "nasgor", qty: 1 }]);
  const card = ticket(page, order.no);
  await expect(card).toBeVisible(REALTIME);
  const customer = await apiAs(null);
  const status = async () => (await (await customer.get(`/api/public/orders/${order.no}?key=${order.key}`)).json()).data.kitchenStatus;

  await card.getByRole("button", { name: "Mulai masak" }).click();
  await expect(page.getByText(`Pesanan #${order.no} mulai dimasak`)).toBeVisible();
  expect(await status()).toBe("preparing");
  await page.getByRole("tab", { name: /^Dimasak/ }).click();
  await expect(card).toBeVisible();
  await page.getByRole("tab", { name: /^Semua/ }).click();

  await card.getByRole("button", { name: "Selesai & siap" }).click();
  await expect(page.getByText(`Pesanan #${order.no} selesai dan siap diantar`)).toBeVisible();
  expect(await status()).toBe("ready");

  await card.getByRole("button", { name: "Sudah diantar ke tamu" }).click();
  await expect(page.getByText(`Pesanan #${order.no} sudah diantar ke Meja 11 · Rooftop`)).toBeVisible();
  await expect(card).toHaveCount(0);
  expect(await status()).toBe("served");
  await customer.dispose();
});

test("DPR-12 dapur tidak mengubah status bayar", async () => {
  const order = await placeSelfOrder("rt-m12", [{ key: "esteh", qty: 1 }]);
  await setKitchen(order.no, "preparing");
  await setKitchen(order.no, "ready");
  await setKitchen(order.no, "served");
  const after = await getOrder(order.no);
  expect(after.kitchenStatus).toBe("served");
  expect(after.paymentStatus).toBe("unpaid");
  const dapur = await apiAs("dapur");
  const res = await dapur.post(`/api/orders/${order.no}/payment`, { data: { method: "tunai", cashReceived: 100000 } });
  expect(res.status()).toBe(403);
  await dapur.dispose();
});

test("DPR-13 pelunasan kasir saat dimasak → badge LUNAS tanpa mengubah status masak", async ({ browser }) => {
  const page = await staffPage(browser, "dapur", "/dapur");
  const order = await placeSelfOrder("l1-m2", [{ key: "nasgor", qty: 1 }]);
  await setKitchen(order.no, "preparing");
  const card = ticket(page, order.no);
  await expect(card).toContainText("BELUM BAYAR", REALTIME);
  expect((await settleCash(order.no, 50000)).status).toBe(200);
  await expect(card).toContainText("LUNAS", REALTIME);
  await expect(card.getByRole("button", { name: "Selesai & siap" })).toBeVisible();
  expect((await getOrder(order.no)).kitchenStatus).toBe("preparing");
});

test("DPR-14 filter tiket: jumlah sesuai status", async ({ browser }) => {
  const page = await staffPage(browser, "dapur", "/dapur");
  await expect(page.getByRole("tab", { name: /^Semua/ })).toBeVisible();
  await page.waitForTimeout(1500);
  const active = (await listOrders()).filter((o) => ["queued", "preparing", "ready"].includes(o.kitchenStatus));
  const count = (s: string) => active.filter((o) => o.kitchenStatus === s).length;
  await expect(page.getByRole("tab", { name: `Semua (${active.length})` })).toBeVisible();
  await expect(page.getByRole("tab", { name: `Diterima (${count("queued")})` })).toBeVisible();
  await expect(page.getByRole("tab", { name: `Dimasak (${count("preparing")})` })).toBeVisible();
  await expect(page.getByRole("tab", { name: `Siap (${count("ready")})` })).toBeVisible();
  await page.getByRole("tab", { name: /^Dimasak/ }).click();
  await expect(page.locator(".service-ticket")).toHaveCount(count("preparing"));
});

test("DPR-15 timer berjalan & tanda Prioritas! setelah 15 menit", async ({ browser }) => {
  const order = await placeSelfOrder("l1-m3", [{ key: "esteh", qty: 1 }]);
  const ctx = await newContext(browser, { storageState: authFile("dapur") });
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto("/dapur");
  const card = ticket(page, order.no);
  await expect(card).toContainText("Baru saja");
  await page.clock.fastForward("06:00");
  await expect(card).toContainText(/(?<!\d)6 mnt/);
  await page.clock.fastForward("10:00");
  await expect(card).toContainText(/1[56] mnt/);
  await expect(card.getByText("Prioritas!")).toBeVisible();
});

test("DPR-17 dua tablet dapur tetap sinkron", async ({ browser }) => {
  const a = await staffPage(browser, "dapur", "/dapur");
  const b = await staffPage(browser, "dapur", "/dapur");
  const order = await placeSelfOrder("l2-m4", [{ key: "esteh", qty: 1 }]);
  await expect(ticket(a, order.no)).toBeVisible(REALTIME);
  await expect(ticket(b, order.no)).toBeVisible(REALTIME);
  await ticket(a, order.no).getByRole("button", { name: "Mulai masak" }).click();
  await expect(ticket(b, order.no).getByRole("button", { name: "Selesai & siap" })).toBeVisible(REALTIME);
  // Tablet B menekan tombol lama bersamaan: status tidak boleh mundur.
  await ticket(b, order.no).getByRole("button", { name: "Selesai & siap" }).click();
  await ticket(a, order.no)
    .getByRole("button", { name: /Selesai & siap|Sudah diantar ke tamu/ })
    .click();
  await expect.poll(async () => (await getOrder(order.no)).kitchenStatus).toMatch(/ready|served/);
});

test("DPR-18 dapur tidak bisa membuka POS, laporan, produk", async ({ browser }) => {
  const page = await staffPage(browser, "dapur", "/dapur");
  await page.goto("/");
  await expect(page).toHaveURL(/\/dapur$/);
  for (const path of ["/laporan", "/produk", "/pesanan", "/laci-kas"]) {
    await page.goto(path);
    await expect(page.getByText("Akses Terkunci untuk Peran Ini")).toBeVisible();
  }
  await page.getByRole("button", { name: /Kembali ke Modul/ }).click();
  await expect(page).toHaveURL(/\/dapur$/);
});

test("DPR-16 antrean kosong menampilkan pesan", async ({ browser }) => {
  for (const o of await listOrders()) {
    if (["queued", "preparing", "ready"].includes(o.kitchenStatus)) await setKitchen(o.no, "served", "admin");
  }
  const page = await staffPage(browser, "dapur", "/dapur");
  await expect(page.getByText("Tidak ada tiket masak aktif")).toBeVisible();
});
