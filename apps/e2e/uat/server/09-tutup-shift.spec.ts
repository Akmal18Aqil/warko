import { expect, test } from "@playwright/test";
import { closeOpened, rp, staffPage } from "../helpers";

test.afterEach(closeOpened);

// Last on purpose: closes the shift every cash case above used.
test("INT-06 tutup shift: selisih kas dihitung dari modal + penjualan tunai", async ({ browser }) => {
  const page = await staffPage(browser, "kasir", "/laci-kas");
  const metrics = page.getByRole("region", { name: "Ringkasan kas shift berjalan" });
  const text = ((await metrics.textContent()) ?? "").replace(/\s+/g, " ");
  const drawer = Number(/Uang di Laci Saat Ini\s*Rp\s?([\d.]+)/i.exec(text)?.[1].replace(/\./g, ""));
  const sales = Number(/Penjualan Tunai Shift\s*Rp\s?([\d.]+)/i.exec(text)?.[1].replace(/\./g, ""));
  expect(drawer).toBe(200000 + sales);

  await page.getByRole("button", { name: "Tutup Shift (Z-Report)" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Ganti ke Input Manual" }).click();
  await dialog.getByLabel(/total fisik uang di laci/i).fill(String(drawer - 5000));
  await expect(dialog.getByText(/Minus -Rp\s?5\.000/)).toBeVisible();
  await dialog.getByLabel(/total fisik uang di laci/i).fill(String(drawer + 2000));
  await expect(dialog.getByText(/Surplus \+Rp\s?2\.000/)).toBeVisible();
  await dialog.getByLabel(/total fisik uang di laci/i).fill(String(drawer));
  await expect(dialog.getByText("Pas (Rp 0)")).toBeVisible();
  await dialog.getByRole("button", { name: "Tutup Shift & Buat Z-Report" }).click();
  const report = page.getByRole("dialog");
  await expect(report.getByText("Laporan Penutupan Shift (Z-Report)")).toBeVisible();
  await expect(report.getByText(rp(drawer)).first()).toBeVisible();
});
