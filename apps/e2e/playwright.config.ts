import { defineConfig, devices } from "@playwright/test";
import { E2E } from "./env.mjs";

const apiURL = `http://127.0.0.1:${E2E.apiPort}`;
const demoURL = `http://127.0.0.1:${E2E.demoPort}`;

export default defineConfig({
  testDir: "./tests",
  // The flows share one database and build on each other's data (orders, shifts),
  // so a retry would start from the failed attempt's state: run once, serially.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { trace: "retain-on-failure", locale: "id-ID", timezoneId: "Asia/Jakarta" },
  projects: [
    { name: "setup", testMatch: /setup\.ts/, use: { baseURL: apiURL } },
    { name: "server", testMatch: /server\/.*\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"], baseURL: apiURL } },
    { name: "demo", testMatch: /demo\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"], baseURL: demoURL } },
  ],
  webServer: [
    { command: "node scripts/serve-api.mjs", url: `${apiURL}/api/public/menu`, timeout: 180_000, reuseExistingServer: false },
    { command: "node scripts/serve-demo.mjs", url: demoURL, timeout: 180_000, reuseExistingServer: false },
  ],
});
