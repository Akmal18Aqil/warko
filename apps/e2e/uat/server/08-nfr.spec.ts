import { setTimeout as sleep } from "node:timers/promises";
import { type Browser, chromium, devices, expect, firefox, type Page, test, webkit } from "@playwright/test";
import {
  apiAs,
  authFile,
  BASE,
  closeOpened,
  customerPhone,
  listOrders,
  MENU,
  newContext,
  orderOnPhone,
  staffPage,
  totalOf,
} from "../helpers";

test.afterEach(closeOpened);

const ticket = (page: Page, no: number) => page.locator(".service-ticket", { has: page.getByText(`#${no}`, { exact: true }) });

async function waitMs(start: number, check: () => Promise<boolean>, limit = 15_000): Promise<number> {
  while (Date.now() - start < limit) {
    if (await check()) return Date.now() - start;
    await sleep(200);
  }
  return Number.POSITIVE_INFINITY;
}

test("NFR-01 latensi sinkronisasi antar perangkat ≤ 10 detik", async ({ browser }) => {
  const dapur = await staffPage(browser, "dapur", "/dapur");
  const kasir = await staffPage(browser, "kasir", "/meja");
  const owner = await staffPage(browser, "manajer", "/pesanan");
  await expect(dapur.getByRole("tab", { name: /^Semua/ })).toBeVisible();
  await expect(kasir.getByRole("heading", { name: "Meja 9", exact: true })).toBeVisible();
  const samples: Record<string, number[]> = { dapur: [], kasir: [], owner: [] };
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    const ctx = await apiAs(null);
    const res = await ctx.post("/api/public/orders", {
      data: {
        tableId: "rt-m9",
        expectedTotal: totalOf(5000),
        clientRef: `nfr01-${i}-${start}-abcdefghijkl`,
        items: [{ barcode: MENU.esteh.barcode, qty: 1 }],
      },
    });
    const no: number = (await res.json()).data.no;
    await ctx.dispose();
    const [d, k, o] = await Promise.all([
      waitMs(start, async () => (await ticket(dapur, no).count()) > 0),
      waitMs(
        start,
        async () =>
          (await kasir
            .locator("article", { has: kasir.getByRole("heading", { name: "Meja 9", exact: true }) })
            .getByText(`#${no}`)
            .count()) > 0,
      ),
      waitMs(start, async () => (await owner.getByText(`#${no}`).count()) > 0),
    ]);
    samples.dapur.push(d);
    samples.kasir.push(k);
    samples.owner.push(o);
  }
  test.info().annotations.push({ type: "latensi ms", description: JSON.stringify(samples) });
  console.log("NFR-01 latensi ms", JSON.stringify(samples));
  for (const values of Object.values(samples)) for (const v of values) expect(v).toBeLessThanOrEqual(10_000);
});

test("NFR-02 jam sibuk: 20 pesanan dari 5 HP bersamaan → tidak ada yang hilang/dobel", async ({ browser }) => {
  const tables = ["l1-m1", "l1-m2", "l2-m4", "l2-m5", "rt-m10"];
  const before = new Set((await listOrders()).map((o) => o.no));
  const started = Date.now();
  const results = await Promise.all(
    tables.flatMap((tableId, phone) =>
      [0, 1, 2, 3].map(async (n) => {
        const ctx = await apiAs(null);
        const res = await ctx.post("/api/public/orders", {
          data: {
            tableId,
            expectedTotal: totalOf(25000 + 5000),
            clientRef: `nfr02-${phone}-${n}-${started}-abcdefgh`,
            items: [
              { barcode: MENU.nasgor.barcode, qty: 1 },
              { barcode: MENU.esteh.barcode, qty: 1 },
            ],
          },
        });
        const out = {
          status: res.status(),
          no: res.ok() ? ((await res.json()).data.no as number) : null,
          body: res.ok() ? "" : await res.text(),
        };
        await ctx.dispose();
        return out;
      }),
    ),
  );
  const elapsed = Date.now() - started;
  test.info().annotations.push({ type: "durasi ms", description: String(elapsed) });
  const failed = results.filter((r) => r.status !== 201);
  expect(failed, JSON.stringify(failed)).toEqual([]);
  const nos = results.map((r) => r.no);
  expect(new Set(nos).size).toBe(20);
  const after = (await listOrders()).filter((o) => !before.has(o.no));
  expect(after.map((o) => o.no).sort((a, b) => a - b)).toEqual([...nos].sort((a, b) => (a ?? 0) - (b ?? 0)));
  const dapur = await staffPage(browser, "dapur", "/dapur");
  for (const no of nos) await expect(ticket(dapur, no ?? 0)).toHaveCount(1);
});

test("NFR-03 koneksi lemah (Slow 3G): pesanan tetap terkirim", async ({ browser }) => {
  const phone = await customerPhone(browser, "l2-m5");
  const cdp = await phone.context().newCDPSession(phone);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 2000,
    downloadThroughput: (500 * 1024) / 8,
    uploadThroughput: (500 * 1024) / 8,
  });
  const start = Date.now();
  await phone.reload();
  const no = await orderOnPhone(phone, [{ key: "esteh", qty: 1 }]);
  const elapsed = Date.now() - start;
  test.info().annotations.push({ type: "durasi muat+pesan Slow 3G (ms)", description: String(elapsed) });
  expect(no).toBeGreaterThan(0);
  expect((await listOrders()).filter((o) => o.no === no)).toHaveLength(1);
});

// Satu meja per mesin: batas server 6 pesanan/meja/menit.
for (const [name, launcher, device, tableId] of [
  ["WebKit (Safari iOS)", webkit, devices["iPhone 13"], "l2-m27"],
  ["Firefox Android", firefox, { ...devices["Pixel 7"], isMobile: false }, "rt-m25"],
  ["Chrome Android", chromium, devices["Pixel 7"], "l1-m26"],
] as const) {
  test(`NFR-04 pelanggan di ${name}: pesan & pantau status`, async () => {
    const browser = await launcher.launch();
    try {
      const ctx = await browser.newContext({ ...device, baseURL: BASE, locale: "id-ID" });
      const page = await ctx.newPage();
      await page.goto(`/order/${tableId}`);
      const no = await orderOnPhone(page, [{ key: "esteh", qty: 1, note: "tanpa es" }]);
      await expect(page.locator("article", { hasText: `Pesanan #${no}` }).locator('[aria-current="step"]')).toHaveText("Diterima Dapur");
    } finally {
      await browser.close();
    }
  });
}

test("NFR-04 staf di Microsoft Edge: POS & KDS terbuka", async () => {
  let browser: Browser;
  try {
    browser = await chromium.launch({ channel: "msedge" });
  } catch (error) {
    test.skip(true, `Edge tidak terpasang: ${error}`);
    return;
  }
  try {
    const ctx = await browser.newContext({ baseURL: BASE, storageState: authFile("kasir") });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByText("Buat pesanan")).toBeVisible();
    await page.goto("/dapur");
    await expect(page.getByText("Layar Dapur (KDS)").first()).toBeVisible();
  } finally {
    await browser.close();
  }
});

test("NFR-05 responsif: tanpa geser horizontal di HP, tablet, desktop", async ({ browser }) => {
  const cases: [string, "kasir" | "dapur" | "manajer", string, { width: number; height: number }, boolean][] = [
    ["Kasir HP", "kasir", "/", { width: 412, height: 839 }, true],
    ["Kasir tablet", "kasir", "/", { width: 820, height: 1180 }, true],
    ["Kasir desktop", "kasir", "/", { width: 1366, height: 768 }, false],
    ["Kasir meja HP", "kasir", "/meja", { width: 412, height: 839 }, true],
    ["Kasir pesanan HP", "kasir", "/pesanan", { width: 412, height: 839 }, true],
    ["Dapur tablet landscape", "dapur", "/dapur", { width: 1180, height: 820 }, true],
    ["Owner HP", "manajer", "/laporan", { width: 390, height: 844 }, true],
    ["Owner desktop", "manajer", "/laporan", { width: 1366, height: 768 }, false],
  ];
  const report: string[] = [];
  const overflowing: string[] = [];
  for (const [label, role, path, viewport, touch] of cases) {
    const page = await (
      await newContext(browser, { storageState: authFile(role), viewport, isMobile: touch && viewport.width < 900, hasTouch: touch })
    ).newPage();
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const small = await page.evaluate(
      () =>
        [...document.querySelectorAll("button, a")].filter(
          (b) => (b as HTMLElement).offsetParent !== null && b.getBoundingClientRect().height < 44,
        ).length,
    );
    report.push(`${label}: overflow=${overflow}px, target<44px=${small}`);
    if (overflow > 0) overflowing.push(label);
  }
  test.info().annotations.push({ type: "responsif", description: report.join(" | ") });
  console.log("NFR-05", report.join("\n"));
  expect(overflowing).toEqual([]);
});

test("NFR-06 status tidak hanya dibedakan warna", async ({ browser }) => {
  const kasir = await staffPage(browser, "kasir", "/meja");
  await expect(kasir.getByText("Kosong", { exact: true }).first()).toBeVisible();
  await expect(kasir.getByText("Terisi", { exact: true }).first()).toBeVisible();
  const dapur = await staffPage(browser, "dapur", "/dapur");
  await expect(dapur.getByText(/^(LUNAS|BELUM BAYAR)$/).first()).toBeVisible();
  const phone = await customerPhone(browser, "l1-m1");
  await orderOnPhone(phone, [{ key: "esteh", qty: 1 }]);
  await expect(phone.getByText(/^(Lunas|Belum bayar)$/).first()).toBeVisible();
});
