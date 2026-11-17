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

test("switching between takeaway and dine-in keeps the order being built", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Burger Keju, Rp .*Tambahkan ke pesanan$/ }).click();
  const ticket = page.getByRole("region", { name: "Pesanan saat ini" });
  await expect(ticket.getByText("Burger Keju")).toBeVisible();

  await ticket.getByRole("button", { name: "Makan di tempat" }).click();
  await expect(ticket.getByText("Burger Keju")).toBeVisible();
  await ticket.getByLabel("Pilih meja").selectOption({ label: "Meja 01" });
  await expect(ticket.getByText("Burger Keju")).toBeVisible();
  await ticket.getByRole("button", { name: "Bawa pulang" }).click();
  await expect(ticket.getByText("Burger Keju")).toBeVisible();
  await expect(ticket.getByText(/^1 item dipilih · Bawa pulang$/)).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 412, height: 839 }, isMobile: true, hasTouch: true });

  test("the cashier reaches the order from the cart bar and takes exact cash", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Burger Keju, Rp .*Tambahkan ke pesanan$/ }).click();
    await expect(page.getByRole("button", { name: /^Burger Keju, Rp .*Tambah satu porsi lagi/ })).toContainText("1 di pesanan");

    await page.getByRole("button", { name: /Lihat pesanan$/ }).click();
    await page
      .getByRole("dialog", { name: "Pesanan saat ini" })
      .getByRole("button", { name: /^Bayar Rp/ })
      .click();

    const payment = page.getByRole("dialog", { name: "Terima pembayaran" });
    await payment.getByRole("button", { name: "Uang pas" }).click();
    await payment.getByRole("button", { name: "Selesaikan pembayaran" }).click();
    await expect(page.getByText(/^Pesanan #\d+ · /)).toBeVisible();
    // The paid order clears the cart, so the bar disappears.
    await expect(page.getByRole("button", { name: /Lihat pesanan$/ })).toHaveCount(0);
  });
});
