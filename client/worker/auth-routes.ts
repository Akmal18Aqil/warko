import type { Env, SessionStaff, StaffRole } from "./env";
import { STAFF_ROLES } from "./env";
import {
  clearFailures, clearSessionCookie, createSession, destroySession, initialsOf, isThrottled, readSession,
  recordFailure, requireRole, requireSession, ROLE_DEFAULTS, STAFF_COLUMNS, throttledError, toSessionStaff,
} from "./auth";
import { hashPassword, safeEqual, sha256Hex, verifyPassword } from "./crypto";
import { HttpError, json, Reader, readJsonObject } from "./http";

type StaffRow = Parameters<typeof toSessionStaff>[0];
type StaffRowFull = StaffRow & { password_hash: string; updated_at: number };

const USERNAME_PATTERN = /^[a-z0-9._-]{3,80}$/;
const STAFF_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const AVATAR_COLOR_PATTERN = /^[A-Za-z0-9:_\-/\[\]#. ]{1,80}$/;
const MIN_PASSWORD = 12;
const MAX_PASSWORD = 256;
const SETUP_ATTEMPT_LIMIT = 5;
const AUTH_PATHS = ["/api/setup/bootstrap", "/api/auth/login", "/api/auth/session", "/api/auth/logout"];

function sameOrigin(request: Request, url: URL): void {
  const origin = request.headers.get("Origin");
  const site = request.headers.get("Sec-Fetch-Site");
  if (origin ? origin !== url.origin : site !== "same-origin" && site !== "none") {
    throw new HttpError(403, "Permintaan lintas-origin ditolak.");
  }
}

function methodNotAllowed(...allow: string[]): HttpError {
  return new HttpError(405, "Metode tidak diizinkan.", undefined, { Allow: allow.join(", ") });
}

/** Login credentials: only shape checks, never leaks password policy beyond length. */
function credentials(body: Record<string, unknown>): { username: string; password: string } {
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!USERNAME_PATTERN.test(username) || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    throw new HttpError(422, "Nama pengguna atau kata sandi tidak valid.");
  }
  return { username, password };
}

// ---- field validation (staff / bootstrap) --------------------------------

function readUsername(r: Reader, optional: boolean): string | undefined {
  const raw = optional ? r.string("username", { max: 80, optional: true }) : r.string("username", { max: 80 });
  if (raw === undefined) return undefined;
  const username = raw.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    throw new HttpError(422, "Data yang dikirim tidak valid.", {
      username: ["username harus 3-80 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung."],
    });
  }
  return username;
}

function readName(r: Reader, optional: boolean): string | undefined {
  const raw = optional ? r.string("name", { max: 120, optional: true }) : r.string("name", { max: 120 });
  if (raw === undefined) return undefined;
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new HttpError(422, "Data yang dikirim tidak valid.", { name: ["name wajib diisi."] });
  return name;
}

/** Strong-password policy for any password the server will store. */
function checkPassword(password: string, username: string): void {
  const errors: string[] = [];
  if (password.length < MIN_PASSWORD) errors.push(`password minimal ${MIN_PASSWORD} karakter.`);
  if (password.length > MAX_PASSWORD) errors.push(`password maksimal ${MAX_PASSWORD} karakter.`);
  if (password.trim().length === 0) errors.push("password tidak boleh hanya spasi.");
  if (new Set(password).size < 4) errors.push("password terlalu mudah ditebak.");
  if (username && password.toLowerCase().includes(username)) errors.push("password tidak boleh memuat nama pengguna.");
  if (errors.length) throw new HttpError(422, "Data yang dikirim tidak valid.", { password: errors });
}

function readPassword(r: Reader, optional: boolean): string | undefined {
  // Length bounds are enforced by checkPassword so the message stays in one place.
  return optional ? r.string("password", { max: 4096, optional: true }) : r.string("password", { max: 4096 });
}

function readAppearance(r: Reader) {
  const title = r.string("title", { max: 80, optional: true })?.trim();
  const description = r.string("description", { max: 255, optional: true })?.trim();
  const avatarColor = r.string("avatarColor", { max: 80, optional: true })?.trim();
  if (avatarColor !== undefined && !AVATAR_COLOR_PATTERN.test(avatarColor)) {
    throw new HttpError(422, "Data yang dikirim tidak valid.", { avatarColor: ["avatarColor tidak valid."] });
  }
  return { title, description, avatarColor };
}

function isConstraintError(error: unknown): boolean {
  return error instanceof Error && /UNIQUE|constraint/i.test(error.message);
}

// ---- bootstrap -----------------------------------------------------------

async function setupComplete(env: Env): Promise<boolean> {
  const row = await env.DB.prepare("SELECT 1 AS done FROM app_state WHERE key = 'setup_complete'").first();
  return row !== null;
}

async function bootstrap(request: Request, env: Env): Promise<Response> {
  const ipKey = await sha256Hex(`setup-ip:${(request.headers.get("CF-Connecting-IP") ?? "unknown")}`);
  if (await isThrottled(env, ipKey, SETUP_ATTEMPT_LIMIT)) throw throttledError();

  const secret = request.headers.get("X-Bootstrap-Secret") ?? "";
  if (!env.BOOTSTRAP_SECRET || env.BOOTSTRAP_SECRET.length < 32 || !(await safeEqual(secret, env.BOOTSTRAP_SECRET))) {
    await recordFailure(env, ipKey);
    throw new HttpError(403, "Penyiapan tidak diizinkan.");
  }
  if (await setupComplete(env)) throw new HttpError(409, "Penyiapan sudah selesai.");

  const body = await readJsonObject(request);
  const r = new Reader(body);
  const username = readUsername(r, false)!;
  const name = readName(r, false)!;
  const password = readPassword(r, false)!;
  r.done();
  checkPassword(password, username);

  const now = Date.now();
  const id = crypto.randomUUID();
  const defaults = ROLE_DEFAULTS.admin;
  const passwordHash = await hashPassword(password);
  try {
    await env.DB.batch([
      // Staff insert only when no setup flag exists; the flag's primary key makes replays fail atomically.
      env.DB.prepare(
        `INSERT INTO staff (id, username, name, role, title, description, avatar_color, initials, password_hash, created_at, updated_at)
         SELECT ?, ?, ?, 'admin', ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM app_state WHERE key = 'setup_complete')`,
      ).bind(id, username, name, defaults.title, defaults.description, defaults.avatarColor, initialsOf(name), passwordHash, now, now),
      env.DB.prepare("INSERT INTO app_state (key, value, updated_at) VALUES ('setup_complete', '1', ?)").bind(now),
    ]);
  } catch (error) {
    if (await setupComplete(env)) throw new HttpError(409, "Penyiapan sudah selesai.");
    throw error;
  }
  await clearFailures(env, ipKey);
  return json({ data: { id } }, 201);
}

// ---- login ---------------------------------------------------------------

async function login(request: Request, env: Env, url: URL): Promise<Response> {
  const { username, password } = credentials(await readJsonObject(request));
  const client = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const key = await sha256Hex(`login:${client}:${username}`);
  const ipKey = await sha256Hex(`login-ip:${client}`);
  if (await isThrottled(env, key, 5) || await isThrottled(env, ipKey, 30)) throw throttledError();
  const row = await env.DB.prepare("SELECT id, password_hash FROM staff WHERE username = ? AND active = 1")
    .bind(username).first<{ id: string; password_hash: string }>();
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    await recordFailure(env, key);
    await recordFailure(env, ipKey);
    throw new HttpError(401, "Nama pengguna atau kata sandi salah.");
  }
  await clearFailures(env, key);
  const cookie = await createSession(env, row.id, url);
  return json({ data: true }, 200, { "Set-Cookie": cookie });
}

// ---- staff management ----------------------------------------------------

async function listStaff(env: Env, actor: SessionStaff): Promise<Response> {
  // Only admins see deactivated accounts.
  const where = actor.role === "admin" ? "" : "WHERE active = 1";
  const { results } = await env.DB.prepare(
    `SELECT ${STAFF_COLUMNS} FROM staff ${where} ORDER BY active DESC, name COLLATE NOCASE, username`,
  ).all<StaffRow>();
  return json({ data: results.map(toSessionStaff) });
}

async function createStaff(request: Request, env: Env, actor: SessionStaff): Promise<Response> {
  requireRole(actor, "admin");
  const body = await readJsonObject(request);
  const r = new Reader(body);
  const username = readUsername(r, false)!;
  const name = readName(r, false)!;
  const role = r.oneOf("role", STAFF_ROLES);
  const password = readPassword(r, false)!;
  const active = r.boolean("active", { optional: true }) ?? true;
  const appearance = readAppearance(r);
  r.done();
  checkPassword(password, username);

  const defaults = ROLE_DEFAULTS[role];
  const id = crypto.randomUUID();
  const now = Date.now();
  const passwordHash = await hashPassword(password);
  const title = appearance.title ?? defaults.title;
  const description = appearance.description ?? defaults.description;
  const avatarColor = appearance.avatarColor ?? defaults.avatarColor;
  try {
    await env.DB.prepare(
      `INSERT INTO staff (id, username, name, role, title, description, avatar_color, initials, password_hash, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, username, name, role, title, description, avatarColor, initialsOf(name), passwordHash, active ? 1 : 0, now, now).run();
  } catch (error) {
    if (isConstraintError(error)) {
      throw new HttpError(409, "Nama pengguna sudah dipakai.", { username: ["username sudah dipakai."] });
    }
    throw error;
  }
  return json({ data: toSessionStaff({
    id, username, name, role, title, description, avatar_color: avatarColor, initials: initialsOf(name), active: active ? 1 : 0,
  }) }, 201);
}

async function loadStaff(env: Env, id: string): Promise<StaffRowFull> {
  const row = await env.DB.prepare(`SELECT ${STAFF_COLUMNS}, password_hash, updated_at FROM staff WHERE id = ?`)
    .bind(id).first<StaffRowFull>();
  if (!row) throw new HttpError(404, "Staf tidak ditemukan.");
  return row;
}

const LAST_ADMIN_MESSAGE = "Tidak dapat menghapus, menonaktifkan, atau menurunkan admin aktif terakhir.";

async function updateStaff(request: Request, env: Env, actor: SessionStaff, id: string, url: URL): Promise<Response> {
  requireRole(actor, "admin");
  const body = await readJsonObject(request);
  const r = new Reader(body);
  const username = readUsername(r, true);
  const name = readName(r, true);
  const role = r.oneOf("role", STAFF_ROLES, { optional: true });
  const active = r.boolean("active", { optional: true });
  const password = readPassword(r, true);
  const appearance = readAppearance(r);
  r.done();
  if (Object.values({ username, name, role, active, password, ...appearance }).every((v) => v === undefined)) {
    throw new HttpError(422, "Tidak ada perubahan yang dikirim.");
  }

  const current = await loadStaff(env, id);
  const isSelf = current.id === actor.id;
  if (isSelf && active === false) throw new HttpError(409, "Anda tidak dapat menonaktifkan akun sendiri.");
  if (isSelf && role !== undefined && role !== current.role) throw new HttpError(409, "Anda tidak dapat mengubah peran akun sendiri.");

  const nextUsername = username ?? current.username;
  if (password !== undefined) checkPassword(password, nextUsername);

  const nextRole: StaffRole = role ?? current.role;
  const nextActive = active ?? current.active === 1;
  const nextName = name ?? current.name;
  // Carry role defaults over only when the old value was itself the old role's default.
  const oldDefaults = ROLE_DEFAULTS[current.role];
  const newDefaults = ROLE_DEFAULTS[nextRole];
  const title = appearance.title ?? (current.title === oldDefaults.title ? newDefaults.title : current.title);
  const description = appearance.description ?? (current.description === oldDefaults.description ? newDefaults.description : current.description);
  const avatarColor = appearance.avatarColor ?? (current.avatar_color === oldDefaults.avatarColor ? newDefaults.avatarColor : current.avatar_color);
  const passwordHash = password !== undefined ? await hashPassword(password) : current.password_hash;

  const demotesAdmin = current.role === "admin" && current.active === 1 && (nextRole !== "admin" || !nextActive);
  const revoke = password !== undefined || nextRole !== current.role || (current.active === 1 && !nextActive);
  const now = Math.max(Date.now(), current.updated_at + 1);

  const statements = [
    env.DB.prepare(
      `UPDATE staff SET username = ?, name = ?, role = ?, title = ?, description = ?, avatar_color = ?, initials = ?,
              password_hash = ?, active = ?, updated_at = ?
        WHERE id = ? AND updated_at = ?
          AND (? = 0 OR (SELECT COUNT(*) FROM staff WHERE role = 'admin' AND active = 1 AND id <> ?) > 0)`,
    ).bind(
      nextUsername, nextName, nextRole, title, description, avatarColor, initialsOf(nextName),
      passwordHash, nextActive ? 1 : 0, now, id, current.updated_at, demotesAdmin ? 1 : 0, id,
    ),
  ];
  if (revoke) {
    // Runs only when the update above applied (it is the sole writer of this updated_at value).
    statements.push(
      env.DB.prepare("DELETE FROM sessions WHERE staff_id = ? AND (SELECT updated_at FROM staff WHERE id = ?) = ?")
        .bind(id, id, now),
    );
  }
  let changes: number;
  try {
    changes = (await env.DB.batch(statements))[0].meta.changes;
  } catch (error) {
    if (isConstraintError(error)) {
      throw new HttpError(409, "Nama pengguna sudah dipakai.", { username: ["username sudah dipakai."] });
    }
    throw error;
  }
  if (changes === 0) {
    const latest = await env.DB.prepare("SELECT updated_at FROM staff WHERE id = ?").bind(id).first<{ updated_at: number }>();
    if (!latest) throw new HttpError(404, "Staf tidak ditemukan.");
    if (latest.updated_at === current.updated_at && demotesAdmin) throw new HttpError(409, LAST_ADMIN_MESSAGE);
    throw new HttpError(409, "Data staf berubah oleh pihak lain. Muat ulang lalu coba lagi.");
  }

  const updated = toSessionStaff({
    id, username: nextUsername, name: nextName, role: nextRole, title, description,
    avatar_color: avatarColor, initials: initialsOf(nextName), active: nextActive ? 1 : 0,
  });
  // Own password change revokes every session, including this one.
  const headers = isSelf && revoke ? { "Set-Cookie": clearSessionCookie(url) } : undefined;
  return json({ data: updated }, 200, headers);
}

async function deleteStaff(env: Env, actor: SessionStaff, id: string): Promise<Response> {
  requireRole(actor, "admin");
  if (id === actor.id) throw new HttpError(409, "Anda tidak dapat menghapus akun sendiri.");
  const current = await loadStaff(env, id);
  const results = await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM staff WHERE id = ? AND updated_at = ?
         AND (role <> 'admin' OR active = 0 OR (SELECT COUNT(*) FROM staff WHERE role = 'admin' AND active = 1 AND id <> ?) > 0)`,
    ).bind(id, current.updated_at, id),
    env.DB.prepare("DELETE FROM sessions WHERE staff_id = ? AND NOT EXISTS (SELECT 1 FROM staff WHERE id = ?)").bind(id, id),
  ]);
  if (results[0].meta.changes === 0) {
    const stillThere = await env.DB.prepare("SELECT 1 AS present FROM staff WHERE id = ?").bind(id).first();
    if (!stillThere) throw new HttpError(404, "Staf tidak ditemukan.");
    if (current.role === "admin" && current.active === 1) throw new HttpError(409, LAST_ADMIN_MESSAGE);
    throw new HttpError(409, "Data staf berubah oleh pihak lain. Muat ulang lalu coba lagi.");
  }
  return json({ data: true });
}

async function handleStaff(request: Request, env: Env, url: URL): Promise<Response | null> {
  const path = url.pathname;
  const match = /^\/api\/staff(?:\/([^/]+))?\/?$/.exec(path);
  if (!match) return null;
  const id = match[1];
  const method = request.method;

  if (id === undefined) {
    if (method === "GET") return listStaff(env, await requireSession(env, request, url));
    if (method !== "POST") throw methodNotAllowed("GET", "POST");
    sameOrigin(request, url);
    return createStaff(request, env, await requireSession(env, request, url));
  }
  if (method !== "PATCH" && method !== "DELETE") throw methodNotAllowed("PATCH", "DELETE");
  sameOrigin(request, url);
  const actor = await requireSession(env, request, url);
  requireRole(actor, "admin");
  if (!STAFF_ID_PATTERN.test(id)) throw new HttpError(404, "Staf tidak ditemukan.");
  return method === "PATCH" ? updateStaff(request, env, actor, id, url) : deleteStaff(env, actor, id);
}

// ---- entry ---------------------------------------------------------------

export async function handleAuth(request: Request, env: Env, url: URL): Promise<Response | null> {
  const staffResponse = await handleStaff(request, env, url);
  if (staffResponse) return staffResponse;

  const path = url.pathname;
  if (!AUTH_PATHS.includes(path)) return null;
  if (path === "/api/auth/session") {
    if (request.method !== "GET") throw methodNotAllowed("GET");
    const staff = await readSession(env, request, url);
    if (!staff) throw new HttpError(401, "Sesi tidak valid. Silakan masuk.");
    return json({ data: staff });
  }
  if (request.method !== "POST") throw methodNotAllowed("POST");
  sameOrigin(request, url);
  if (path === "/api/auth/logout") {
    await destroySession(env, request, url);
    return json({ data: true }, 200, { "Set-Cookie": clearSessionCookie(url) });
  }
  return path === "/api/setup/bootstrap" ? bootstrap(request, env) : login(request, env, url);
}
