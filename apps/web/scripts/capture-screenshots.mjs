// Captures the screenshots used by the README and the product brochure into <repo>/docs/images.
// Start the app first (`pnpm --filter @wakro/web dev`), then run:
//   node apps/web/scripts/capture-screenshots.mjs            (BASE_URL defaults to http://localhost:5173)
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(scriptDir, "../../../docs/images");
const baseUrl = (process.env.BASE_URL ?? "http://localhost:5173").replace(/\/$/, "");

fs.mkdirSync(outDir, { recursive: true });

const DESKTOP = { width: 1366, height: 768 };
const PHONE = { width: 420, height: 860 };

const pages = [
  { name: "01-pos-kasir.png", route: "/", size: DESKTOP },
  { name: "02-dapur-kds.png", route: "/dapur", size: DESKTOP },
  { name: "03-daftar-pesanan.png", route: "/pesanan", size: DESKTOP },
  { name: "04-manajemen-meja.png", route: "/meja", size: DESKTOP },
  { name: "05-katalog-produk.png", route: "/produk", size: DESKTOP },
  { name: "06-laporan-penjualan.png", route: "/laporan", size: DESKTOP },
  { name: "07-pengaturan-shift.png", route: "/pengaturan", size: DESKTOP },
  { name: "08-self-order-qr.png", route: "/order/meja-01", size: PHONE },
  { name: "09-mode-pelayan.png", route: "/pelayan", size: DESKTOP },
  { name: "10-laci-kas.png", route: "/laci-kas", size: DESKTOP },
];

/** Opens a modal from a page by clicking buttons by visible text, screenshotting after each step. */
const modalFlows = [
  {
    route: "/produk",
    steps: [
      { click: ["Kelola Kategori"], name: "11-kelola-kategori.png" },
      { click: ["Hapus kategori"], name: "12-verifikasi-dua-langkah.png", matchTitle: true },
    ],
  },
  {
    route: "/produk",
    steps: [
      { click: ["Tambah baru", "Ubah"], name: "16-upload-image-produk-local.png" },
      { click: ["Cari"], exact: true, name: "17-cari-gambar-google.png" },
      { click: ["Galeri"], exact: true, name: "18-galeri-kuliner.png" },
    ],
  },
  {
    route: "/",
    steps: [
      { click: ["Server Lokal", "Pair HP"], name: "13-pusat-jaringan-pelayan.png" },
      { click: ["Layar dapur"], name: "14-pusat-jaringan-dapur.png" },
    ],
  },
  {
    route: "/pengaturan",
    steps: [{ click: ["Panduan penerapan"], name: "15-panduan-server-lokal.png" }],
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function open(page, route, size) {
  await page.setViewport({ ...size, deviceScaleFactor: 2 });
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle0", timeout: 15000 });
  await sleep(1500);
}

async function shot(page, name) {
  const target = path.join(outDir, name);
  await page.screenshot({ path: target });
  console.log(`Saved ${target}`);
}

/**
 * Clicks the last button/tab whose text (or aria-label/title, when `matchTitle`) contains one of `labels`
 * (case-insensitive); with `exact` the whole text must equal a label.
 */
async function clickButton(page, labels, { matchTitle = false, exact = false } = {}) {
  const handle = await page.evaluateHandle(
    (wanted, byTitle, whole) => {
      const lowered = wanted.map((label) => label.toLowerCase());
      const candidates = [...document.querySelectorAll("button, [role='tab']")];
      const matches = candidates.filter((el) => {
        const raw = byTitle ? el.getAttribute("aria-label") ?? el.getAttribute("title") ?? "" : el.textContent ?? "";
        const text = raw.trim().toLowerCase();
        return lowered.some((label) => (whole ? text === label : text.includes(label)));
      });
      return matches.at(-1) ?? null;
    },
    labels,
    matchTitle,
    exact,
  );
  const element = handle.asElement();
  if (!element) throw new Error(`Button not found: ${labels.join(" / ")}`);
  await element.click();
  await sleep(1000);
}

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));

  // The first visit lets the local database seed itself.
  await open(page, "/", DESKTOP);

  for (const item of pages) {
    try {
      await open(page, item.route, item.size);
      await shot(page, item.name);
    } catch (error) {
      console.error(`Failed to capture ${item.route}:`, error.message);
    }
  }

  for (const flow of modalFlows) {
    try {
      await open(page, flow.route, DESKTOP);
      for (const step of flow.steps) {
        await clickButton(page, step.click, step);
        await shot(page, step.name);
      }
    } catch (error) {
      console.error(`Failed modal flow on ${flow.route}:`, error.message);
    }
  }
} finally {
  await browser.close();
}
console.log("Done.");
