// Starts the Worker (API + remote-mode web build) on a fresh local D1 for end-to-end tests.
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { E2E } from "../env.mjs";

const apiDir = fileURLToPath(new URL("../../api/", import.meta.url));
const seedFile = fileURLToPath(new URL("../seed.sql", import.meta.url));
const persist = ".wrangler/e2e";
const run = (command, cwd = apiDir) => execSync(command, { cwd, stdio: "inherit" });

if (!process.env.E2E_SKIP_BUILD) run("pnpm --filter @wakro/web build");
rmSync(new URL(`../../api/${persist}`, import.meta.url), { recursive: true, force: true });
run(`pnpm exec wrangler d1 migrations apply DB --local --persist-to ${persist}`);
run(`pnpm exec wrangler d1 execute DB --local --persist-to ${persist} --file "${seedFile}"`);

const server = spawn(
  "pnpm",
  [
    "exec",
    "wrangler",
    "dev",
    "--local",
    "--port",
    String(E2E.apiPort),
    "--persist-to",
    persist,
    "--var",
    `SESSION_SECRET:${E2E.sessionSecret}`,
    "--var",
    `BOOTSTRAP_SECRET:${E2E.bootstrapSecret}`,
    "--show-interactive-dev-session=false",
  ],
  { cwd: apiDir, stdio: "inherit", shell: process.platform === "win32" },
);
const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
