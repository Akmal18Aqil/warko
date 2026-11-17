import { expect, test } from "@playwright/test";
import { closeOpened, MENU, rp, staffPage, totalOf } from "../helpers";

test.afterEach(closeOpened);

// Runs first: every later cash case needs the shift this file opens.
test("KSR-02 tunai ditolak tanpa shift", async ({ browser }) => {
  const page = await staffPage(browser, "kasir", "/");
  await page.getByRole("button", { name: new RegExp(`^${MENU.esteh.name}, Rp .*Tambahkan ke pesanan$`) }).click();
  await page.getByRole("button", { name: /^Bayar Rp/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: /^Tunai/ })).toBeDisabled();
  await expect(dialog.getByText("Buka shift di Laci Kas untuk menerima tunai")).toBeVisible();
  await expect(dialog.getByText(rp(totalOf(MENU.esteh.price))).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Batal" }).click();
  await page.getByRole("button", { name: "Kosongkan pesanan" }).click();
});

test("KSR-01 buka shift dengan modal awal Rp 200.000", async ({ browser }) => {
  const page = await staffPage(browser, "kasir", "/laci-kas");
  await page.getByRole("button", { name: "Buka Shift Baru" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/modal awal/i).fill("200000");
  await dialog.getByRole("button", { name: "Buka Shift Sekarang" }).click();
  await expect(page.getByText("Shift Aktif")).toBeVisible();
  await expect(page.getByText("Jamie Kasir").first()).toBeVisible();
  await expect(page.getByText(rp(200000)).first()).toBeVisible();
});
