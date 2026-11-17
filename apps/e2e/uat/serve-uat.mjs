// UAT stack: the Worker twice on fresh local D1 databases (QRIS via a Midtrans mock, and QRIS off) + the mock.
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { E2E } from "../env.mjs";
import { startMidtransMock } from "./midtrans-mock.mjs";
import { UAT } from "./uat-env.mjs";

const apiDir = fileURLToPath(new URL("../../api/", import.meta.url));
const seedFile = fileURLToPath(new URL("./seed.sql", import.meta.url));
const run = (command) => execSync(command, { cwd: apiDir, stdio: "inherit" });

if (!process.env.E2E_SKIP_BUILD) run("pnpm --filter @wakro/web build");

const instances = [
  {
    port: UAT.qrisPort,
    persist: ".wrangler/uat-qris",
    vars: [`MIDTRANS_SERVER_KEY:${UAT.midtransKey}`, `MIDTRANS_API_BASE:http://127.0.0.1:${UAT.mockPort}`],
  },
  { port: UAT.plainPort, persist: ".wrangler/uat-plain", vars: [] },
];

startMidtransMock(UAT.mockPort);
const children = instances.map(({ port, persist, vars }) => {
  rmSync(new URL(`../../api/${persist}`, import.meta.url), { recursive: true, force: true });
  run(`pnpm exec wrangler d1 migrations apply DB --local --persist-to ${persist}`);
  run(`pnpm exec wrangler d1 execute DB --local --persist-to ${persist} --file "${seedFile}"`);
  const args = ["exec", "wrangler", "dev", "--local", "--port", String(port), "--persist-to", persist];
  for (const v of [`SESSION_SECRET:${E2E.sessionSecret}`, `BOOTSTRAP_SECRET:${E2E.bootstrapSecret}`, ...vars]) args.push("--var", v);
  args.push("--show-interactive-dev-session=false");
  return spawn("pnpm", args, { cwd: apiDir, stdio: "inherit", shell: process.platform === "win32" });
});

const stop = () => {
  for (const child of children) child.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) child.on("exit", (code) => process.exit(code ?? 0));
