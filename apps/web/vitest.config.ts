import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: unit tests cover pure logic and need none of the app plugins.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
