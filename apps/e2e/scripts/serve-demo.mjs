// Serves the local (browser-only) demo build for end-to-end tests.
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { E2E } from "../env.mjs";

const webDir = fileURLToPath(new URL("../../web/", import.meta.url));
const outDir = "dist-demo";
if (!process.env.E2E_SKIP_BUILD) execSync(`pnpm exec vite build --outDir ${outDir}`, { cwd: webDir, stdio: "inherit" });

const server = spawn("pnpm", ["exec", "vite", "preview", "--outDir", outDir, "--port", String(E2E.demoPort), "--strictPort"], {
  cwd: webDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});
const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
