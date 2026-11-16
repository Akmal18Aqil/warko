import { execSync } from "node:child_process";

execSync("pnpm run build", {
  stdio: "inherit",
  env: { ...process.env, VITE_DATA_SOURCE: "remote" },
});
