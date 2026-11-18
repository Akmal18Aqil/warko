import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { api, cookiePair, readJson, resetDb, signIn } from "./helpers";

const ADMIN_PASSWORD = "Tangga-Biru-Malam-77";
const PIN = "482913";

type Admin = Awaited<ReturnType<typeof signIn>>;

async function newAdmin(): Promise<Admin> {
  return signIn("admin", "Admin Uji", ADMIN_PASSWORD);
}

/** Registers the "browser" behind `admin.session` as a device and returns its device cookie. */
async function registerDevice(admin: Admin, name = "Tablet kasir"): Promise<string> {
  const response = await api("/api/auth/devices", { session: admin.session, body: { name, password: ADMIN_PASSWORD } });
  expect(response.status).toBe(201);
  return cookiePair(response);
}

async function setPin(admin: Admin, staffId: string, pin: string | null = PIN): Promise<Response> {
  return api(`/api/staff/${staffId}/pin`, { method: "PUT", session: admin.session, body: { pin, password: ADMIN_PASSWORD } });
}

const pinLogin = (device: string, staffId: string, pin: string, ip = "203.0.113.9", session?: string) =>
  api("/api/auth/pin-login", {
    body: { staffId, pin },
    session: session ? `${device}; ${session}` : device,
    headers: { "CF-Connecting-IP": ip },
  });

beforeEach(resetDb);

describe("password confirmation and policy", () => {
  it("requires the actor's own password for every staff-management action", async () => {
    const admin = await newAdmin();
    const body = { username: "baru.kasir", name: "Kasir Baru", role: "kasir", password: "Kopi-Susu-Gula-91" };
    const missing = await api("/api/staff", { session: admin.session, body });
    expect(missing.status).toBe(422);
    expect((await readJson(missing)).errors.confirmPassword).toBeDefined();
    const wrong = await api("/api/staff", { session: admin.session, body: { ...body, confirmPassword: "salah-salah-salah" } });
    expect(wrong.status).toBe(403);
    const created = await api("/api/staff", { session: admin.session, body: { ...body, confirmPassword: ADMIN_PASSWORD } });
    expect(created.status).toBe(201);
    const { data } = await readJson(created);
    expect(data.hasPin).toBe(false);

    const noConfirmDelete = await api(`/api/staff/${data.id}`, { method: "DELETE", session: admin.session, body: {} });
    expect(noConfirmDelete.status).toBe(422);
    const noConfirmPatch = await api(`/api/staff/${data.id}`, { method: "PATCH", session: admin.session, body: { name: "Lain" } });
    expect(noConfirmPatch.status).toBe(422);
    const deleted = await api(`/api/staff/${data.id}`, {
      method: "DELETE",
      session: admin.session,
      body: { confirmPassword: ADMIN_PASSWORD },
    });
    expect(deleted.status).toBe(200);
  });

  it("rejects short and common passwords but accepts a strong one", async () => {
    const admin = await newAdmin();
    const create = (password: string) =>
      api("/api/staff", {
        session: admin.session,
        body: { username: "kasir.uji", name: "Kasir Uji", role: "kasir", password, confirmPassword: ADMIN_PASSWORD },
      });
    for (const weak of ["abc123", "Password1", "password123", "12345678", "iloveyou", "Qwerty123!"]) {
      const response = await create(weak);
      expect(response.status, weak).toBe(422);
      expect((await readJson(response)).errors.password).toBeDefined();
    }
    expect((await create("bukuhija")).status).toBe(201);
  });

  it("locks password confirmation after repeated wrong guesses", async () => {
    const admin = await newAdmin();
    const attempt = () => api("/api/auth/devices", { session: admin.session, body: { name: "Tablet", password: "salah-salah-salah" } });
    for (let i = 0; i < 5; i++) expect((await attempt()).status).toBe(403);
    expect((await attempt()).status).toBe(429);
  });
});

describe("device registration and PIN login", () => {
  it("logs in with a PIN only on a registered device, as a PIN session", async () => {
    const admin = await newAdmin();
    const cashier = await signIn("kasir");
    expect((await setPin(admin, cashier.id)).status).toBe(200);

    // Unregistered browser: no PIN login.
    expect((await pinLogin("", cashier.id, PIN)).status).toBe(403);

    const device = await registerDevice(admin);
    const status = await readJson(await api("/api/auth/device", { session: device }));
    expect(status.data.registered).toBe(true);
    expect(status.data.staff.map((s: { id: string }) => s.id)).toEqual([cashier.id]);
    expect(status.data.staff[0].username).toBeUndefined();

    const login = await pinLogin(device, cashier.id, PIN);
    expect(login.status).toBe(200);
    const setCookie = login.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Secure");
    const session = await readJson(await api("/api/auth/session", { session: cookiePair(login) }));
    expect(session.data.authMethod).toBe("pin");
    expect(session.data.hasPin).toBe(true);
  });

  it("answers wrong PIN, unknown staff and staff without a PIN identically", async () => {
    const admin = await newAdmin();
    const withPin = await signIn("kasir");
    const noPin = await signIn("pelayan");
    await setPin(admin, withPin.id);
    const device = await registerDevice(admin);
    const wrong = await pinLogin(device, withPin.id, "135790");
    const none = await pinLogin(device, noPin.id, PIN);
    const unknown = await pinLogin(device, crypto.randomUUID(), PIN);
    expect([wrong.status, none.status, unknown.status]).toEqual([401, 401, 401]);
    expect(await readJson(none)).toEqual(await readJson(wrong));
    expect(await readJson(unknown)).toEqual({ message: "PIN salah." });
    expect((await pinLogin(device, withPin.id, "12ab56")).status).toBe(422);
  });

  it("locks an account across IPs even for the right PIN", async () => {
    const admin = await newAdmin();
    const cashier = await signIn("kasir");
    await setPin(admin, cashier.id);
    const device = await registerDevice(admin);
    for (let i = 0; i < 5; i++) expect((await pinLogin(device, cashier.id, "135790", `198.51.100.${i + 1}`)).status).toBe(401);
    const blocked = await pinLogin(device, cashier.id, PIN, "198.51.100.200");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("900");
  });

  it("counts parallel PIN guesses atomically", async () => {
    const admin = await newAdmin();
    const cashier = await signIn("kasir");
    await setPin(admin, cashier.id);
    const device = await registerDevice(admin);
    const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => pinLogin(device, cashier.id, "135790", `192.0.2.${i + 1}`)));
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 401)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(5);
  });

  it("switching user replaces the previous session", async () => {
    const admin = await newAdmin();
    const first = await signIn("kasir");
    const second = await signIn("pelayan");
    await setPin(admin, first.id);
    await setPin(admin, second.id, "369258");
    const device = await registerDevice(admin);
    const one = cookiePair(await pinLogin(device, first.id, PIN));
    const two = await pinLogin(device, second.id, "369258", "203.0.113.9", one);
    expect(two.status).toBe(200);
    expect((await api("/api/auth/session", { session: one })).status).toBe(401);
    expect((await readJson(await api("/api/auth/session", { session: cookiePair(two) }))).data.id).toBe(second.id);
  });

  it("stores no PIN, device token or secret in the database or audit log", async () => {
    const admin = await newAdmin();
    const cashier = await signIn("kasir");
    await setPin(admin, cashier.id);
    const device = await registerDevice(admin);
    await pinLogin(device, cashier.id, "135790");
    await pinLogin(device, cashier.id, PIN);
    const staff = await env.DB.prepare("SELECT pin_hash FROM staff WHERE id = ?").bind(cashier.id).first<{ pin_hash: string }>();
    expect(staff?.pin_hash).toMatch(/^pin1\$sha256\$100000\$/);
    expect(staff?.pin_hash).not.toContain(PIN);
    const token = device.split("=")[1];
    const dump = JSON.stringify([
      (await env.DB.prepare("SELECT * FROM audit_log").all()).results,
      (await env.DB.prepare("SELECT * FROM devices").all()).results,
      (await env.DB.prepare("SELECT * FROM auth_throttle").all()).results,
    ]);
    for (const secret of [PIN, "135790", token, ADMIN_PASSWORD]) expect(dump).not.toContain(secret);
    const actions = (await env.DB.prepare("SELECT action, outcome FROM audit_log").all<{ action: string; outcome: string }>()).results;
    expect(actions).toContainEqual({ action: "pin.login", outcome: "failure" });
    expect(actions).toContainEqual({ action: "pin.login", outcome: "success" });
    expect(actions).toContainEqual({ action: "device.register", outcome: "success" });
  });

  it("rejects weak PINs and needs the admin password to set one", async () => {
    const admin = await newAdmin();
    const cashier = await signIn("kasir");
    for (const weak of ["000000", "123456", "654321"]) expect((await setPin(admin, cashier.id, weak)).status, weak).toBe(422);
    expect((await setPin(admin, cashier.id, "12345")).status).toBe(422);
    const wrong = await api(`/api/staff/${cashier.id}/pin`, {
      method: "PUT",
      session: admin.session,
      body: { pin: PIN, password: "salah-salah-salah" },
    });
    expect(wrong.status).toBe(403);
    const asCashier = await api(`/api/staff/${cashier.id}/pin`, {
      method: "PUT",
      session: cashier.session,
      body: { pin: PIN, password: "x" },
    });
    expect(asCashier.status).toBe(403);
  });
});

describe("PIN sessions never authorise security actions on their own", () => {
  it("still demands the password from an admin signed in by PIN", async () => {
    const admin = await newAdmin();
    const device = await registerDevice(admin);
    // Setting your own PIN revokes the old session; sign in again with the PIN.
    expect((await setPin(admin, admin.id)).status).toBe(200);
    const login = await pinLogin(device, admin.id, PIN);
    expect(login.status).toBe(200);
    const session = cookiePair(login);
    const body = { username: "baru.kasir", name: "Kasir Baru", role: "kasir", password: "Kopi-Susu-Gula-91" };
    expect((await api("/api/staff", { session, body })).status).toBe(422);
    expect((await api("/api/auth/devices", { session, body: { name: "Lain" } })).status).toBe(422);
    expect((await api("/api/auth/devices", { session })).status).toBe(200);
    expect((await api("/api/staff", { session, body: { ...body, confirmPassword: ADMIN_PASSWORD } })).status).toBe(201);
  });
});

describe("revocation", () => {
  it("revokes sessions when the PIN, role or status changes", async () => {
    const admin = await newAdmin();
    const cashier = await signIn("kasir");
    // PIN change
    expect((await api("/api/auth/session", { session: cashier.session })).status).toBe(200);
    await setPin(admin, cashier.id);
    expect((await api("/api/auth/session", { session: cashier.session })).status).toBe(401);

    const second = await signIn("kasir");
    const patch = (body: Record<string, unknown>) =>
      api(`/api/staff/${second.id}`, { method: "PATCH", session: admin.session, body: { ...body, confirmPassword: ADMIN_PASSWORD } });
    expect((await patch({ role: "pelayan" })).status).toBe(200);
    expect((await api("/api/auth/session", { session: second.session })).status).toBe(401);
    const third = await signIn("kasir");
    expect(
      (
        await api(`/api/staff/${third.id}`, {
          method: "PATCH",
          session: admin.session,
          body: { active: false, confirmPassword: ADMIN_PASSWORD },
        })
      ).status,
    ).toBe(200);
    expect((await api("/api/auth/session", { session: third.session })).status).toBe(401);
  });

  it("revoking a device ends its PIN sessions and blocks further PIN logins", async () => {
    const admin = await newAdmin();
    const cashier = await signIn("kasir");
    await setPin(admin, cashier.id);
    const device = await registerDevice(admin);
    const session = cookiePair(await pinLogin(device, cashier.id, PIN));
    const list = await readJson(await api("/api/auth/devices", { session: admin.session }));
    expect(list.data).toHaveLength(1);
    const id = list.data[0].id;

    const unconfirmed = await api(`/api/auth/devices/${id}/revoke`, { session: admin.session, body: {} });
    expect(unconfirmed.status).toBe(422);
    const revoked = await api(`/api/auth/devices/${id}/revoke`, { session: admin.session, body: { password: ADMIN_PASSWORD } });
    expect(revoked.status).toBe(200);

    expect((await api("/api/auth/session", { session })).status).toBe(401);
    expect((await pinLogin(device, cashier.id, PIN)).status).toBe(403);
    const status = await readJson(await api("/api/auth/device", { session: device }));
    expect(status.data).toEqual({ registered: false });
  });

  it("refuses to register a browser that already has an active device", async () => {
    const admin = await newAdmin();
    const device = await registerDevice(admin);
    const again = await api("/api/auth/devices", {
      session: `${admin.session}; ${device}`,
      body: { name: "Dobel", password: ADMIN_PASSWORD },
    });
    expect(again.status).toBe(409);
  });

  it("keeps device management and the audit log admin-only", async () => {
    const cashier = await signIn("kasir");
    expect((await api("/api/auth/devices", { session: cashier.session })).status).toBe(403);
    expect((await api("/api/audit", { session: cashier.session })).status).toBe(403);
  });
});

describe("legacy compatibility", () => {
  it("treats a session created before the migration as a password session", async () => {
    const legacy = await signIn("kasir");
    const session = await readJson(await api("/api/auth/session", { session: legacy.session }));
    expect(session.data.authMethod).toBe("password");
    expect(session.data.hasPin).toBe(false);
  });
});
