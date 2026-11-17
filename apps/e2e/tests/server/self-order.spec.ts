import { expect, test } from "@playwright/test";

test("a self-order whose response was lost is recovered without a duplicate", async ({ page }) => {
  await page.goto("/order/meja-e2e");
  await expect(page.getByText("Nasi Goreng Uji")).toBeVisible();

  // The first submit reaches the server and is stored, but its response never arrives.
  let dropped = false;
  await page.route("**/api/public/orders", async (route) => {
    if (route.request().method() !== "POST" || dropped) return route.continue();
    dropped = true;
    await route.fetch();
    await route.abort("failed");
  });

  await page.getByRole("button", { name: "Tambah Nasi Goreng Uji" }).click();
  await page.getByRole("button", { name: /Lihat Keranjang/ }).click();
  await page.getByRole("button", { name: "Pesan & Bayar Tunai di Kasir" }).click();
  await expect(page.getByText("Pesanan sebelumnya belum terkonfirmasi")).toBeVisible();
  // The cart sheet closes once the unconfirmed payload has been stored.
  await expect(page.getByRole("dialog")).toBeHidden();

  // New orders stay blocked until the earlier one is confirmed.
  await page.getByRole("button", { name: "Tambah Nasi Goreng Uji" }).click();
  await page.getByRole("button", { name: /Lihat Keranjang/ }).click();
  await page.getByRole("button", { name: "Pesan & Bayar Tunai di Kasir" }).click();
  await expect(page.getByText(/Pastikan dulu pesanan sebelumnya/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Tutup" }).click();

  await page.getByRole("button", { name: "Kirim ulang pesanan sebelumnya" }).click();
  await expect(page.getByText(/sudah tercatat/)).toBeVisible();
  await expect(page.getByText("Pesanan sebelumnya belum terkonfirmasi")).toBeHidden();
  // Exactly one order was stored, and the second cart is still waiting.
  await expect(page.getByRole("heading", { name: /^Pesanan #\d+$/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /1 .*Lihat Keranjang/ })).toBeVisible();
});
