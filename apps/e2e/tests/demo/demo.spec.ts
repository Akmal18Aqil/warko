import { expect, test } from "@playwright/test";

test("demo mode is labelled, ready for cash sales, and resets", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Data contoh tersimpan hanya di browser ini", { exact: false })).toBeVisible();
  await expect(page.getByText("Mode Demo").first()).toBeVisible();

  // The demo opens with a shift, so cash is accepted straight away.
  await page.getByRole("button", { name: /^Burger Keju, Rp .*Tambahkan ke pesanan$/ }).click();
  await page.getByRole("button", { name: /^Bayar Rp/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/uang yang diterima/i).fill("100000");
  await dialog.getByRole("button", { name: "Selesaikan pembayaran" }).click();
  const toast = page.getByText(/^Pesanan #\d+ · /);
  await expect(toast).toBeVisible();
  const orderNo = (await toast.textContent())?.match(/#(\d+)/)?.[1];

  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reset semua data demo" }).click();
  await expect(page.getByText("Buat pesanan")).toBeVisible();
  await page.getByRole("link", { name: "Laporan", exact: true }).click();
  await expect(page.getByText(/Riwayat transaksi/)).toBeVisible();
  await expect(page.getByText(`#${orderNo}`, { exact: true })).toHaveCount(0);
});
