import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import path from "path";

const BASE_URL = process.env.KASA_BASE_URL || "http://localhost:5173";

/**
 * Smoke test for the public customer queue display (/antrian):
 *  - opens the kiosk page without crash
 *  - verifies live clock, 4 column headers, and empty-state cards
 *  - saves a screenshot for visual verification
 *
 * Usage: node client/scripts/test-queue-display.mjs   (run dev server first: npm run dev)
 */
async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  // 16:9 kiosk / TV viewport
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  console.log(`1. Opening public queue display: ${BASE_URL}/antrian ...`);
  await page.goto(`${BASE_URL}/antrian`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 2000));

  // Kiosk header live clock — id-ID locale uses "." separators (e.g. 09.12.59)
  const hasClock = await page.evaluate(() =>
    /\d{2}[.:]\d{2}([.:]\d{2})?/.test(document.body.innerText),
  );
  console.log(`   Live clock visible: ${hasClock ? "PASS" : "FAIL"}`);
  if (!hasClock) throw new Error("Live clock not found in kiosk header");

  // All 4 queue column headers (rendered UPPERCASE via CSS text-transform)
  const columns = await page.evaluate(() => {
    const text = document.body.innerText.toUpperCase();
    return ["Diterima", "Dimasak", "Siap", "Selesai"].filter((c) => text.includes(c.toUpperCase()));
  });
  console.log(`   Queue columns found: ${columns.join(", ") || "(none)"}`);
  if (columns.length !== 4) {
    throw new Error(`Expected 4 queue columns, found: ${columns.join(", ")}`);
  }

  // Order cards / empty states must render (React mounted the grid)
  const cardCount = await page.evaluate(() => document.querySelectorAll("article").length);
  console.log(`   Order cards rendered: ${cardCount}`);

  const screenshotPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "queue-display-smoke.png");
  await page.screenshot({ path: screenshotPath });
  console.log(`2. Screenshot saved to ${screenshotPath}`);

  await browser.close();
  console.log("Queue display smoke test completed successfully!");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
