import { expect, request as newRequest, test as setup } from "@playwright/test";
import { E2E } from "../env.mjs";
import { authFile, ROLES, type Role } from "./helpers";
import { UAT } from "./uat-env.mjs";

async function bootstrap(baseURL: string) {
  const ctx = await newRequest.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const res = await ctx.post("/api/setup/bootstrap", { headers: { "X-Bootstrap-Secret": E2E.bootstrapSecret }, data: E2E.admin });
  expect([200, 201, 409]).toContain(res.status());
  return ctx;
}

async function login(baseURL: string, username: string, password: string, file: string) {
  const ctx = await newRequest.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const res = await ctx.post("/api/auth/login", { data: { username, password } });
  expect(res.status(), `login ${username}`).toBe(200);
  await ctx.storageState({ path: file });
  await ctx.dispose();
}

setup("buat akun admin & staf per peran, simpan sesi", async ({ baseURL }) => {
  const base = baseURL ?? "";
  const admin = await bootstrap(base);
  await login(base, E2E.admin.username, E2E.admin.password, authFile("admin"));
  const adminCtx = await newRequest.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base }, storageState: authFile("admin") });
  for (const role of ROLES.filter((r): r is Exclude<Role, "admin"> => r !== "admin")) {
    const { username, name } = UAT.staff[role];
    const apiRole = role === "kasir2" ? "kasir" : role;
    const res = await adminCtx.post("/api/staff", {
      data: { username, name, role: apiRole, password: UAT.password, confirmPassword: E2E.admin.password },
    });
    expect([201, 409], await res.text()).toContain(res.status());
    await login(base, username, UAT.password, authFile(role));
  }
  await adminCtx.dispose();
  await admin.dispose();
  // The QRIS-off instance only serves anonymous customers; it just needs to exist.
  await (await bootstrap(`http://127.0.0.1:${UAT.plainPort}`)).dispose();
});
