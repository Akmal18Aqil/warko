import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(fileURLToPath(new URL("./migrations", import.meta.url)));
  return {
    plugins: [
      cloudflareTest({
        main: "./src/index.ts",
        miniflare: {
          compatibilityDate: "2026-11-16",
          d1Databases: ["DB"],
          bindings: {
            TEST_MIGRATIONS: migrations,
            SESSION_SECRET: "test-session-secret-test-session-secret",
            PIN_PEPPER: "test-pin-pepper-test-pin-pepper-0000",
            BOOTSTRAP_SECRET: "test-bootstrap-secret-test-bootstrap-secret",
            MIDTRANS_SERVER_KEY: "SB-Mid-server-test-key",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/setup.ts"],
      // Every file shares one D1 database and wipes it between tests.
      fileParallelism: false,
    },
  };
});
