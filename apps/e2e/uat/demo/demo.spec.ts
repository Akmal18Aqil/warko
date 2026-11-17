import { expect, test } from "@playwright/test";

test("PLG-14 [L] bayar QRIS simulasi demo → lunas + struk digital", async ({ page }) => {
  await page.goto("/order");
  const picker = page.getByRole("dialog", { name: "Pilih lantai & nomor meja" });
  await picker.getByRole("button").filter({ hasText: /kursi/ }).first().click();
  await page
    .getByRole("button", { name: /^Tambah / })
    .first()
    .click();
  await page.getByRole("button", { name: /Lihat Keranjang/ }).click();
  await page.getByRole("button", { name: "Bayar Sekarang via QRIS (demo)" }).click();
  const modal = page.getByRole("dialog").filter({ hasText: "Simulasi QRIS (mode demo lokal)" });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Simulasikan pembayaran berhasil" }).click();
  await expect(page.getByText(/Pesanan #\d+ lunas \(simulasi QRIS demo\)\./)).toBeVisible();
  // Struk digital terbuka otomatis setelah lunas.
  const receipt = page.getByRole("dialog", { name: "Struk digital" });
  await expect(receipt).toContainText(/QRIS/);
  await receipt.getByRole("button", { name: "Tutup" }).first().click();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: /^Pesanan #\d+$/ }) })
    .first();
  await expect(card.getByText("Lunas", { exact: true })).toBeVisible();
});

test("SEC-07 [L] ganti staf dengan PIN: salah ditolak, benar masuk ke modul peran", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /PIN/ }).first().click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("button").filter({ hasText: "Chef Junaedi" }).first().click();
  await page.keyboard.type("9999");
  await expect(page.getByText(/PIN tidak sesuai!|PIN salah!/).first()).toBeVisible();
  await page.waitForTimeout(800); // kolom PIN dikosongkan 600 ms setelah PIN salah
  await page.keyboard.type("3333");
  await expect(page).toHaveURL(/\/dapur$/);
  await expect(page.getByText("Layar Dapur (KDS)").first()).toBeVisible();
});

test("NFR-07 [L] reset demo menghapus data dan memuat ulang", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Burger Keju, Rp .*Tambahkan ke pesanan$/ }).click();
  await page.getByRole("button", { name: /^Bayar Rp/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/uang yang diterima/i).fill("100000");
  await dialog.getByRole("button", { name: "Selesaikan pembayaran" }).click();
  const no = (await page.getByText(/^Pesanan #\d+ · /).textContent())?.match(/#(\d+)/)?.[1];
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reset semua data demo" }).click();
  await expect(page.getByText("Buat pesanan")).toBeVisible();
  await page.getByRole("link", { name: "Laporan", exact: true }).click();
  await expect(page.getByText(/Riwayat transaksi/)).toBeVisible();
  await expect(page.getByText(`#${no}`, { exact: true })).toHaveCount(0);
});
