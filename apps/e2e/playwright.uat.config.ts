import { defineConfig, devices } from "@playwright/test";
import { E2E } from "./env.mjs";
import { UAT } from "./uat/uat-env.mjs";

const qrisURL = `http://127.0.0.1:${UAT.qrisPort}`;
const demoURL = `http://127.0.0.1:${E2E.demoPort}`;

// UAT per peran (docs/SKEMA-PENGUJIAN.md). Satu database bersama yang dibangun berurutan: jalankan serial, tanpa retry.
export default defineConfig({
  testDir: "./uat",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: "uat-results/results.json" }]],
  outputDir: "uat-results/artifacts",
  use: { trace: "retain-on-failure", screenshot: "only-on-failure", locale: "id-ID", timezoneId: "Asia/Jakarta" },
  projects: [
    { name: "uat-setup", testMatch: /setup\.ts/, use: { baseURL: qrisURL } },
    {
      name: "uat",
      testMatch: /server\/.*\.spec\.ts/,
      dependencies: ["uat-setup"],
      use: { ...devices["Desktop Chrome"], baseURL: qrisURL },
    },
    { name: "uat-demo", testMatch: /demo\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"], baseURL: demoURL } },
  ],
  webServer: [
    {
      command: "node uat/serve-uat.mjs",
      url: `http://127.0.0.1:${UAT.plainPort}/api/public/menu`,
      timeout: 300_000,
      reuseExistingServer: false,
    },
    { command: "node scripts/serve-demo.mjs", url: demoURL, timeout: 180_000, reuseExistingServer: false },
  ],
});
