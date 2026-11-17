import { expect, request as newRequest, test } from "@playwright/test";
import { E2E } from "../../env.mjs";
import { apiAs, BASE, closeOpened, d1, MENU, newContext, placeSelfOrder, type Role, staffPage, totalOf } from "../helpers";
import { UAT } from "../uat-env.mjs";

test.afterEach(closeOpened);

const ROUTES = ["/", "/pesanan", "/meja", "/produk", "/laporan", "/laci-kas", "/pengaturan", "/dapur", "/pelayan"] as const;
const ALLOWED: Record<Exclude<Role, "kasir2">, readonly string[]> = {
  admin: ROUTES,
  kasir: ROUTES,
  manajer: ["/pesanan", "/meja", "/produk", "/laporan", "/laci-kas", "/pengaturan"],
  dapur: ["/dapur"],
  pelayan: ["/pelayan"],
};
const HOME: Record<Exclude<Role, "kasir2">, string> = { admin: "/", kasir: "/", manajer: "/laporan", dapur: "/dapur", pelayan: "/pelayan" };
const LOGIN: Record<Exclude<Role, "kasir2" | "admin">, { username: string; home: RegExp }> = {
  kasir: { username: UAT.staff.kasir.username, home: /\/$/ },
  manajer: { username: UAT.staff.manajer.username, home: /\/laporan$/ },
  dapur: { username: UAT.staff.dapur.username, home: /\/dapur$/ },
  pelayan: { username: UAT.staff.pelayan.username, home: /\/pelayan$/ },
};

async function createStaff(username: string, role = "kasir") {
  const admin = await apiAs("admin");
  const res = await admin.post("/api/staff", { data: { username, name: `Uji ${username}`, role, password: UAT.password } });
  expect([201, 409]).toContain(res.status());
  await admin.dispose();
}

test("SEC-01 tanpa login: halaman staf meminta login, API staf 401", async ({ browser }) => {
  const page = await (await newContext(browser)).newPage();
  for (const path of ["/", "/dapur", "/pesanan", "/laporan", "/produk", "/laci-kas"]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
    await expect(page.getByText("Buat pesanan")).toHaveCount(0);
  }
  const anon = await apiAs(null);
  for (const path of ["/api/bootstrap", "/api/orders", "/api/staff", "/api/resources/shifts", `/api/reports/orders?from=0&to=86400000`]) {
    expect((await anon.get(path)).status(), path).toBe(401);
  }
  await anon.dispose();
});

for (const [role, { username, home }] of Object.entries(LOGIN)) {
  test(`SEC-02 login ${role} masuk ke halaman bawaan perannya`, async ({ browser }) => {
    const page = await (await newContext(browser)).newPage();
    await page.goto("/");
    await page.getByLabel(/nama pengguna/i).fill(username);
    await page.getByLabel(/kata sandi/i).fill(UAT.password);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page.getByRole("button", { name: "Masuk" })).toHaveCount(0);
    await expect(page).toHaveURL(home);
    await expect(page.getByText("Akses Terkunci untuk Peran Ini")).toHaveCount(0);
  });
}

test("SEC-03 sandi salah & pengguna tak dikenal ditolak dengan pesan yang sama", async ({ browser }) => {
  await createStaff("salah1");
  const page = await (await newContext(browser)).newPage();
  await page.goto("/");
  await page.getByLabel(/nama pengguna/i).fill("salah1");
  await page.getByLabel(/kata sandi/i).fill("sandi-yang-salah-123");
  await page.getByRole("button", { name: "Masuk" }).click();
  const wrong = page.getByText("Nama pengguna atau kata sandi tidak benar.");
  await expect(wrong).toBeVisible();
  await page.getByLabel(/nama pengguna/i).fill("tidak-ada-orang");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(wrong).toBeVisible();
  const anon = await apiAs(null);
  const a = await anon.post("/api/auth/login", { data: { username: "salah1", password: "sandi-yang-salah-123" } });
  const b = await anon.post("/api/auth/login", { data: { username: "tidak-ada-orang", password: "sandi-yang-salah-123" } });
  expect([a.status(), await a.text()]).toEqual([b.status(), await b.text()]);
  await anon.dispose();
});

test("SEC-04 6× salah sandi → akun dikunci 15 menit (HTTP 429), sandi benar pun ditolak", async () => {
  await createStaff("kunci1");
  const anon = await apiAs(null);
  for (let i = 0; i < 5; i++) await anon.post("/api/auth/login", { data: { username: "kunci1", password: `salah-${i}-xxxxxxxx` } });
  const locked = await anon.post("/api/auth/login", { data: { username: "kunci1", password: UAT.password } });
  expect(locked.status()).toBe(429);
  expect(await locked.text()).toContain("Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.");
  expect(locked.headers()["retry-after"]).toBe("900");
  await anon.dispose();
});

test("SEC-05 logout lalu Back tidak membuka halaman staf", async ({ browser }) => {
  await createStaff("keluar1");
  const page = await (await newContext(browser)).newPage();
  await page.goto("/");
  await page.getByLabel(/nama pengguna/i).fill("keluar1");
  await page.getByLabel(/kata sandi/i).fill(UAT.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByText("Buat pesanan")).toBeVisible();
  await page.goto("/pesanan");
  await page.getByRole("button", { name: "Menu akun Uji keluar1" }).click();
  await page.getByRole("button", { name: "Keluar / ganti akun" }).click();
  await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
  const session = await page.request.get("/api/auth/session");
  expect(JSON.stringify(await session.json())).not.toContain("keluar1");
});

test("SEC-06 sesi berumur 12 jam dan ditolak setelah kedaluwarsa", async () => {
  await createStaff("sesi1");
  const ctx = await newRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
  const login = await ctx.post("/api/auth/login", { data: { username: "sesi1", password: UAT.password } });
  expect(login.status()).toBe(200);
  expect(login.headers()["set-cookie"]).toMatch(/Max-Age=43200/i);
  expect(login.headers()["set-cookie"]).toMatch(/HttpOnly/i);
  expect(login.headers()["set-cookie"]).toMatch(/SameSite=(Strict|Lax)/i);
  expect((await ctx.get("/api/bootstrap")).status()).toBe(200);
  d1("UPDATE sessions SET expires_at = 0 WHERE staff_id = (SELECT id FROM staff WHERE username = 'sesi1')");
  expect((await ctx.get("/api/bootstrap")).status()).toBe(401);
  await ctx.dispose();
});

test("SEC-08 matriks akses halaman per peran", async ({ browser }) => {
  const mismatches: string[] = [];
  for (const [role, allowed] of Object.entries(ALLOWED) as [Exclude<Role, "kasir2">, readonly string[]][]) {
    const page = await staffPage(browser, role, "/pengaturan");
    for (const path of ROUTES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/Memuat/)).toHaveCount(0);
      // "/" for a role without the cashier screen is a landing page: it goes to the role's own module.
      if (path === "/" && !allowed.includes("/")) {
        const home = new URL(page.url()).pathname;
        if (home !== HOME[role]) mismatches.push(`${role} /: dialihkan ke ${home}`);
        continue;
      }
      const locked = (await page.getByText("Akses Terkunci untuk Peran Ini").count()) > 0;
      if (locked === allowed.includes(path)) mismatches.push(`${role} ${path}: ${locked ? "terkunci" : "terbuka"}`);
    }
  }
  expect(mismatches).toEqual([]);
});

test("SEC-09 aksi di luar peran ditolak server (403) dan tulis lintas origin ditolak", async () => {
  const order = await placeSelfOrder("l2-m27", [{ key: "esteh", qty: 1 }]);
  const checks: [Role, "post" | "put" | "patch" | "delete", string, unknown, number][] = [
    ["dapur", "post", `/api/orders/${order.no}/payment`, { method: "tunai", cashReceived: 10000 }, 403],
    ["pelayan", "post", `/api/orders/${order.no}/payment`, { method: "tunai", cashReceived: 10000 }, 403],
    ["dapur", "put", "/api/resources/products/p-x", { name: "X", price: 1, category: "Makanan", kind: "Makanan" }, 403],
    [
      "manajer",
      "put",
      "/api/resources/products/p-nasgor",
      { name: "Nasi Goreng WakRo", price: 1, category: "Makanan", kind: "Makanan" },
      403,
    ],
    ["dapur", "post", `/api/products/${MENU.nasgor.barcode}/stock`, { mode: "set", qty: 1 }, 403],
    ["pelayan", "put", "/api/pricing", { taxEnabled: false, taxRate: 0, serviceChargeEnabled: false, serviceChargeRate: 0 }, 403],
    ["kasir", "post", "/api/staff", { username: "x1", name: "x", role: "admin", password: UAT.password }, 403],
    ["dapur", "post", "/api/orders", { orderType: "bawa-pulang", expectedTotal: 0, items: [{ barcode: MENU.esteh.barcode, qty: 1 }] }, 403],
  ];
  for (const [role, method, path, data, status] of checks) {
    const ctx = await apiAs(role);
    const res = await ctx[method](path, { data });
    expect(res.status(), `${role} ${method.toUpperCase()} ${path}`).toBe(status);
    await ctx.dispose();
  }
  const evil = await apiAs("kasir", BASE);
  const res = await evil.post(`/api/orders/${order.no}/payment`, {
    headers: { Origin: "https://evil.example" },
    data: { method: "tunai", cashReceived: 10000 },
  });
  expect(res.status()).toBe(403);
  await evil.dispose();
  const ctx = await apiAs("admin");
  expect((await (await ctx.get(`/api/orders/${order.no}`)).json()).data.paymentStatus).toBe("unpaid");
  await ctx.dispose();
});

test("SEC-10 harga/total dari klien tidak dipercaya server", async () => {
  const anon = await apiAs(null);
  const cheap = await anon.post("/api/public/orders", {
    data: {
      tableId: "rt-m28",
      expectedTotal: 1,
      clientRef: "sec10-cheap-0123456789abcdef",
      items: [{ barcode: MENU.nasgor.barcode, qty: 1 }],
    },
  });
  expect(cheap.status()).toBeGreaterThanOrEqual(400);
  expect(await cheap.text()).toContain("Total pesanan berubah");
  const withPrice = await anon.post("/api/public/orders", {
    data: {
      tableId: "rt-m28",
      expectedTotal: 1,
      clientRef: "sec10-price-0123456789abcdef",
      items: [{ barcode: MENU.nasgor.barcode, qty: 1, price: 1 }],
    },
  });
  expect(withPrice.status()).toBeGreaterThanOrEqual(400);
  const paidNow = await anon.post("/api/public/orders", {
    data: {
      tableId: "rt-m28",
      paymentChoice: "paid-now",
      expectedTotal: totalOf(25000),
      clientRef: "sec10-paid-0123456789abcdef",
      items: [{ barcode: MENU.nasgor.barcode, qty: 1 }],
    },
  });
  expect(paidNow.status()).toBe(422);
  await anon.dispose();
});

test("SEC-11 pesan menu HABIS langsung lewat API ditolak", async () => {
  const anon = await apiAs(null);
  const res = await anon.post("/api/public/orders", {
    data: {
      tableId: "rt-m28",
      expectedTotal: totalOf(2000),
      clientRef: "sec11-habis-0123456789abcdef",
      items: [{ barcode: MENU.kerupuk.barcode, qty: 1 }],
    },
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
  test.info().annotations.push({ type: "respons", description: `${res.status()} ${await res.text()}` });
  await anon.dispose();
});

test("SEC-13 bootstrap admin kedua & secret salah ditolak", async () => {
  const ctx = await newRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
  const again = await ctx.post("/api/setup/bootstrap", {
    headers: { "X-Bootstrap-Secret": E2E.bootstrapSecret },
    data: { username: "admin2", name: "x", password: UAT.password },
  });
  expect(again.status()).toBe(409);
  const wrong = await ctx.post("/api/setup/bootstrap", {
    headers: { "X-Bootstrap-Secret": "salah" },
    data: { username: "admin3", name: "x", password: UAT.password },
  });
  expect([401, 403, 409]).toContain(wrong.status());
  await ctx.dispose();
});
