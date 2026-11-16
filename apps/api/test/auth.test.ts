import { createExecutionContext, createScheduledController, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "../src/crypto";
import worker from "../src/index";
import { api, readJson, resetDb, signIn } from "./helpers";

const PASSWORD = "correct-horse-battery";

async function createUser(username: string): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO staff (id, username, name, role, title, description, avatar_color, initials, password_hash, created_at, updated_at)
     VALUES (?, ?, 'Kasir Uji', 'kasir', '', '', '', 'KU', ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), username, await hashPassword(PASSWORD), now, now)
    .run();
}

const login = (username: string, password: string, ip = "203.0.113.7") =>
  api("/api/auth/login", { body: { username, password }, headers: { "CF-Connecting-IP": ip } });

beforeEach(resetDb);

describe("login", () => {
  it("signs in with the right password", async () => {
    await createUser("sari");
    const response = await login("sari", PASSWORD);
    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
  });

  it("answers unknown users and wrong passwords identically", async () => {
    await createUser("sari");
    const wrong = await login("sari", "wrong-password-123");
    const unknown = await login("ghost", "wrong-password-123");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await readJson(unknown)).toEqual(await readJson(wrong));
  });

  it("locks an account after five failures, even for the right password", async () => {
    await createUser("sari");
    for (let i = 0; i < 5; i++) expect((await login("sari", "wrong-password-123")).status).toBe(401);
    const blocked = await login("sari", PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("900");
  });

  it("counts parallel guesses, so a burst cannot get past the limit", async () => {
    await createUser("sari");
    const responses = await Promise.all(Array.from({ length: 10 }, () => login("sari", "wrong-password-123")));
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 401)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(5);
  });

  it("clears the counter after a successful login", async () => {
    await createUser("sari");
    for (let i = 0; i < 4; i++) await login("sari", "wrong-password-123");
    expect((await login("sari", PASSWORD)).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login("sari", "wrong-password-123")).status).toBe(401);
  });
});

describe("request guards", () => {
  it("requires a session", async () => {
    expect((await api("/api/orders")).status).toBe(401);
  });

  it("enforces roles per route", async () => {
    const { session } = await signIn("dapur");
    const response = await api("/api/orders", {
      session,
      body: { orderType: "bawa-pulang", items: [{ barcode: "X", qty: 1 }], expectedTotal: 0 },
    });
    expect(response.status).toBe(403);
  });

  it("rejects cross-origin writes", async () => {
    const { session } = await signIn("kasir");
    const response = await api("/api/orders", { session, body: {}, headers: { Origin: "https://evil.example" } });
    expect(response.status).toBe(403);
  });

  it("answers 405 with an Allow header and 404 for unknown paths", async () => {
    const { session } = await signIn("kasir");
    const wrongMethod = await api("/api/bootstrap", { session, method: "DELETE" });
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("Allow")).toBe("GET");
    expect((await api("/api/nope", { session })).status).toBe(404);
  });
});

describe("staff list", () => {
  it("shows login names to admins only", async () => {
    const admin = await signIn("admin");
    const cashier = await signIn("kasir");
    const asAdmin = await readJson(await api("/api/staff", { session: admin.session }));
    expect(asAdmin.data.every((s: { username?: string }) => typeof s.username === "string")).toBe(true);
    const asCashier = await readJson(await api("/api/staff", { session: cashier.session }));
    expect(asCashier.data).toHaveLength(2);
    expect(asCashier.data.some((s: Record<string, unknown>) => "username" in s)).toBe(false);
  });
});

describe("scheduled cleanup", () => {
  it("purges expired sessions and stale throttle counters", async () => {
    const { id } = await signIn("kasir");
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO sessions (id_hash, staff_id, created_at, expires_at) VALUES ('expired', ?, ?, ?)").bind(
        id,
        now - 100_000,
        now - 1,
      ),
      env.DB.prepare("INSERT INTO auth_throttle (key, failures, window_start) VALUES ('stale', 3, ?)").bind(now - 16 * 60_000),
      env.DB.prepare("INSERT INTO auth_throttle (key, failures, window_start) VALUES ('fresh', 1, ?)").bind(now),
    ]);
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController(), env, ctx);
    await waitOnExecutionContext(ctx);

    const sessions = await env.DB.prepare("SELECT id_hash FROM sessions").all<{ id_hash: string }>();
    expect(sessions.results.map((r) => r.id_hash)).not.toContain("expired");
    expect(sessions.results).toHaveLength(1);
    const keys = await env.DB.prepare("SELECT key FROM auth_throttle").all<{ key: string }>();
    expect(keys.results.map((r) => r.key)).toEqual(["fresh"]);
  });
});
