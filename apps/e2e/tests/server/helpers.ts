import { expect, type Page } from "@playwright/test";
import { E2E } from "../../env.mjs";

export async function signIn(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel(/nama pengguna/i).fill(E2E.admin.username);
  await page.getByLabel(/kata sandi/i).fill(E2E.admin.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByText("Buat pesanan")).toBeVisible();
}

export async function addToCart(page: Page, product: string): Promise<void> {
  await page.getByRole("button", { name: new RegExp(`^${product}, Rp .*Tambahkan ke pesanan$`) }).click();
}

export async function goTo(page: Page, link: string): Promise<void> {
  await page.getByRole("link", { name: link, exact: true }).click();
}
