import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import puppeteer from "puppeteer";

const base = process.env.KASA_TEST_URL;
const secret = process.env.KASA_TEST_BOOTSTRAP_SECRET;
if (!base || !secret) throw new Error("Set KASA_TEST_URL and KASA_TEST_BOOTSTRAP_SECRET for an isolated local Worker.");
const url = new URL(base);
if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
  throw new Error("This test only runs against an isolated local Worker.");
}
const username = `test-${randomBytes(6).toString("hex")}`;
const password = randomBytes(24).toString("base64url");
const setup = await fetch(new URL("/api/setup/bootstrap", url), {
  method: "POST",
  headers: { Origin: url.origin, "Content-Type": "application/json", "X-Bootstrap-Secret": secret },
  body: JSON.stringify({ username, password, name: "Test Admin" }),
});
if (setup.status !== 201) throw new Error(`Local bootstrap failed: ${setup.status}`);

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(url.origin, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const button = document.querySelector('button[type="submit"]');
    return button && !button.disabled;
  });
  await page.type('input[autocomplete="username"]', username);
  await page.type('input[autocomplete="current-password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForSelector('button[aria-label="Menu akun Test Admin"]');
  const account = 'button[aria-label="Menu akun Test Admin"]';
  await page.click(account);
  await page.waitForSelector("#account-menu", { visible: true });
  assert.equal(await page.$eval(account, (element) => element.getAttribute("aria-expanded")), "true");
  assert.equal(await page.evaluate(async () => (await fetch("/api/auth/session")).status), 200);
  if (process.env.KASA_TEST_SCREENSHOT) await page.screenshot({ path: process.env.KASA_TEST_SCREENSHOT });
  await page.keyboard.press("Escape");
  assert.equal(await page.$("#account-menu"), null);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Menu akun Test Admin");
  await page.click(account);
  await page.click("main");
  assert.equal(await page.$("#account-menu"), null);
  await page.click('button[title="Klik untuk ganti peran atau masuk staf lain"]');
  await page.waitForSelector('[role="dialog"][aria-labelledby="remote-account-title"]', { visible: true });
  assert.equal(await page.evaluate(async () => (await fetch("/api/auth/session")).status), 200);
  await page.keyboard.press("Escape");
  assert.equal(await page.$('[aria-labelledby="remote-account-title"]'), null);
  await page.setViewport({ width: 390, height: 844 });
  await page.click(account);
  await page.waitForSelector("#account-menu", { visible: true });
  const fits = await page.$eval("#account-menu", (element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth;
  });
  assert.ok(fits, "Account menu must fit the viewport");
  await page.evaluate(() => [...document.querySelectorAll("#account-menu button")].find((button) => button.textContent?.includes("Keluar / ganti akun"))?.click());
  await page.waitForSelector('input[autocomplete="username"]', { visible: true });
  assert.equal(await page.evaluate(async () => (await fetch("/api/auth/session")).status), 401);
  assert.deepEqual(errors, []);
  console.log("Account menu opens without logout, supports Escape and outside click, and logs out only on request.");
} finally {
  await browser.close();
}
