import { expect, test } from "@playwright/test";
import { addToCart, goTo, signIn } from "./helpers";

// Nasi Goreng Uji costs Rp 30.000; default pricing adds 11% tax.
const NASI_TOTAL = "Rp 33.300";

test("cash needs an open shift, is attributed to it and reconciles at close", async ({ page }) => {
  await signIn(page);

  await test.step("cash is unavailable while no shift is open", async () => {
    await addToCart(page, "Nasi Goreng Uji");
    await page.getByRole("button", { name: `Bayar ${NASI_TOTAL}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: /^Tunai/ })).toBeDisabled();
    await expect(dialog.getByText("Buka shift di Laci Kas untuk menerima tunai")).toBeVisible();
    await dialog.getByRole("button", { name: "Batal" }).click();
  });

  await test.step("open a shift with Rp 100.000 float", async () => {
    await goTo(page, "Laci Kas");
    await page.getByRole("button", { name: "Buka Shift Baru" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/modal awal/i).fill("100000");
    await dialog.getByRole("button", { name: "Buka Shift Sekarang" }).click();
    await expect(page.getByText("Shift Aktif")).toBeVisible();
  });

  await test.step("take a cash payment", async () => {
    await goTo(page, "Pesanan baru");
    await page.getByRole("button", { name: `Bayar ${NASI_TOTAL}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: /^Tunai/ })).toBeEnabled();
    await dialog.getByLabel(/uang yang diterima/i).fill("50000");
    await dialog.getByRole("button", { name: "Selesaikan pembayaran" }).click();
    await expect(page.getByText("Pembayaran berhasil")).toBeVisible();
    // Intl id-ID currency text has a no-break space after "Rp"; accessible names normalize it, raw text does not.
    await expect(page.getByText(/Kembalian Rp\s16\.700/)).toBeVisible();
  });

  await test.step("close the shift: expected cash = float + cash sales", async () => {
    await goTo(page, "Laci Kas");
    await page.getByRole("button", { name: "Tutup Shift (Z-Report)" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Ganti ke Input Manual" }).click();
    await dialog.getByLabel(/total fisik uang di laci/i).fill("133300");
    await dialog.getByRole("button", { name: "Tutup Shift & Buat Z-Report" }).click();
    const report = page.getByRole("dialog");
    await expect(report.getByText("Laporan Penutupan Shift (Z-Report)")).toBeVisible();
    await expect(report.getByText("Rp 133.300").first()).toBeVisible();
  });
});

test("an order moves through the kitchen", async ({ page }) => {
  await signIn(page);
  await addToCart(page, "Es Teh Uji");
  await page.getByRole("button", { name: "Kirim ke dapur" }).click();
  await expect(page.getByText(/dikirim ke dapur/i)).toBeVisible();

  await goTo(page, "Dapur (KDS)");
  const ticket = page.locator(".service-ticket", { hasText: "Es Teh Uji" }).first();
  await ticket.getByRole("button", { name: "Mulai masak" }).click();
  await ticket.getByRole("button", { name: "Selesai & siap" }).click();
  await ticket.getByRole("button", { name: "Sudah diantar ke tamu" }).click();
  await expect(page.getByText(/sudah diantar/i).first()).toBeVisible();
});
