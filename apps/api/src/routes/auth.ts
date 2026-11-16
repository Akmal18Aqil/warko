import { STAFF_ROLES, type StaffRole } from "@wakro/shared";
import {
  clearAttempts, clearSessionCookie, consumeAttempt, createSession, destroySession, initialsOf, readSession,
  releaseAttempt, ROLE_DEFAULTS, STAFF_COLUMNS, throttledError, toSessionStaff, type StaffRow,
} from "../auth";
import { hashPassword, safeEqual, sha256Hex, verifyPassword } from "../crypto";
import type { Env } from "../env";
import { isUniqueViolation } from "../guards";
import { conflict, HttpError, invalid, json, Reader, readJsonObject, type StringOptions } from "../http";
import { ADMIN_ROLES, READ_ROLES } from "../policy";
import { get, publicGet, publicPost, send, type AuthedContext, type Route, type RouteContext } from "../router";

type StaffRowFull = StaffRow & { password_hash: string; updated_at: number };

const USERNAME_PATTERN = /^[a-z0-9._-]{3,80}$/;
const STAFF_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const AVATAR_COLOR_PATTERN = /^[A-Za-z0-9:_\-/\[\]#. ]{1,80}$/;
const MIN_PASSWORD = 12;
const MAX_PASSWORD = 256;
const SETUP_ATTEMPT_LIMIT = 5;
const LOGIN_USER_ATTEMPT_LIMIT = 5;
const LOGIN_IP_ATTEMPT_LIMIT = 30;
/**
 * PBKDF2 hash of a throwaway password. Unknown usernames are verified against it so the response
 * time does not reveal whether an account exists.
 */
const DUMMY_PASSWORD_HASH = "pbkdf2$sha256$100000$eqPA3csp5JX4FBZgd1luHQ$3HYJ0_wwoI1mpRy0RR4g0rkcsCfLeEj2GwglS5fm1Yk";

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

const USERNAME_FIELD: StringOptions = {
  max: 80,
  normalize: (value) => value.trim().toLowerCase(),
  pattern: USERNAME_PATTERN,
  patternMessage: "username harus 3-80 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.",
};
const NAME_FIELD: StringOptions = { max: 120, nonBlank: true, normalize: (value) => value.trim().replace(/\s+/g, " ") };
// Length bounds are enforced by `passwordErrors` so the messages stay in one place.
const PASSWORD_FIELD: StringOptions = { max: 4096 };
const TITLE_FIELD: StringOptions = { max: 80, normalize: (value) => value.trim() };
const DESCRIPTION_FIELD: StringOptions = { max: 255, normalize: (value) => value.trim() };
const AVATAR_FIELD: StringOptions = {
  max: 80,
  normalize: (value) => value.trim(),
  pattern: AVATAR_COLOR_PATTERN,
  patternMessage: "avatarColor tidak valid.",
};

function readAppearance(r: Reader) {
  return {
    title: r.string("title", { ...TITLE_FIELD, optional: true }),
    description: r.string("description", { ...DESCRIPTION_FIELD, optional: true }),
    avatarColor: r.string("avatarColor", { ...AVATAR_FIELD, optional: true }),
  };
}

/** Strong-password policy for any password the server will store. */
function passwordErrors(password: string, username: string): string[] {
  const errors: string[] = [];
  if (password.length < MIN_PASSWORD) errors.push(`password minimal ${MIN_PASSWORD} karakter.`);
  if (password.length > MAX_PASSWORD) errors.push(`password maksimal ${MAX_PASSWORD} karakter.`);
  if (password.trim().length === 0) errors.push("password tidak boleh hanya spasi.");
  if (new Set(password).size < 4) errors.push("password terlalu mudah ditebak.");
  if (username && password.toLowerCase().includes(username)) errors.push("password tidak boleh memuat nama pengguna.");
  return errors;
}

function assertStrongPassword(password: string, username: string): void {
  const errors = passwordErrors(password, username);
  if (errors.length) throw invalid("password", ...errors);
}

const USERNAME_TAKEN = "Nama pengguna sudah dipakai.";

function usernameTaken(): HttpError {
  return new HttpError(409, USERNAME_TAKEN, { username: ["username sudah dipakai."] });
}

// ---- bootstrap -----------------------------------------------------------

async function setupComplete(env: Env): Promise<boolean> {
  const row = await env.DB.prepare("SELECT 1 AS done FROM app_state WHERE key = 'setup_complete'").first();
  return row !== null;
}

async function bootstrap({ request, env }: RouteContext): Promise<Response> {
  const ipKey = await sha256Hex(`setup-ip:${request.headers.get("CF-Connecting-IP") ?? "unknown"}`);
  if (!(await consumeAttempt(env, ipKey, SETUP_ATTEMPT_LIMIT))) throw throttledError();

  const secret = request.headers.get("X-Bootstrap-Secret") ?? "";
  if (!env.BOOTSTRAP_SECRET || env.BOOTSTRAP_SECRET.length < 32 || !(await safeEqual(secret, env.BOOTSTRAP_SECRET))) {
    throw new HttpError(403, "Penyiapan tidak diizinkan.");
  }
  if (await setupComplete(env)) throw new HttpError(409, "Penyiapan sudah selesai.");

  const r = new Reader(await readJsonObject(request));
  const username = r.string("username", USERNAME_FIELD);
  const name = r.string("name", NAME_FIELD);
  const password = r.string("password", PASSWORD_FIELD);
  r.done();
  assertStrongPassword(password, username);

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
  await clearAttempts(env, ipKey);
  return json({ data: { id } }, 201);
}

// ---- session -------------------------------------------------------------

async function login({ request, env, url }: RouteContext): Promise<Response> {
  const { username, password } = credentials(await readJsonObject(request));
  const client = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const userKey = await sha256Hex(`login:${client}:${username}`);
  const ipKey = await sha256Hex(`login-ip:${client}`);
  // Count the attempt before the slow hash so a burst of parallel guesses cannot all pass the check.
  const userAllowed = await consumeAttempt(env, userKey, LOGIN_USER_ATTEMPT_LIMIT);
  const ipAllowed = await consumeAttempt(env, ipKey, LOGIN_IP_ATTEMPT_LIMIT);
  if (!userAllowed || !ipAllowed) throw throttledError();

  const row = await env.DB.prepare("SELECT id, password_hash FROM staff WHERE username = ? AND active = 1")
    .bind(username)
    .first<{ id: string; password_hash: string }>();
  const verified = await verifyPassword(password, row?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!row || !verified) throw new HttpError(401, "Nama pengguna atau kata sandi salah.");

  await Promise.all([clearAttempts(env, userKey), releaseAttempt(env, ipKey)]);
  const cookie = await createSession(env, row.id, url);
  return json({ data: true }, 200, { "Set-Cookie": cookie });
}

async function currentSession({ request, env, url }: RouteContext): Promise<Response> {
  const staff = await readSession(env, request, url);
  if (!staff) throw new HttpError(401, "Sesi tidak valid. Silakan masuk.");
  return json({ data: staff });
}

async function logout({ request, env, url }: RouteContext): Promise<Response> {
  await destroySession(env, request, url);
  return json({ data: true }, 200, { "Set-Cookie": clearSessionCookie(url) });
}

// ---- staff management ----------------------------------------------------

async function listStaff({ env, staff: actor }: AuthedContext): Promise<Response> {
  const isAdmin = actor.role === "admin";
  // Only admins see deactivated accounts and login names.
  const where = isAdmin ? "" : "WHERE active = 1";
  const { results } = await env.DB.prepare(
    `SELECT ${STAFF_COLUMNS} FROM staff ${where} ORDER BY active DESC, name COLLATE NOCASE, username`,
  ).all<StaffRow>();
  const members = results.map(toSessionStaff);
  return json({ data: isAdmin ? members : members.map(({ username: _username, ...rest }) => rest) });
}

async function createStaff({ request, env }: AuthedContext): Promise<Response> {
  const r = new Reader(await readJsonObject(request));
  const username = r.string("username", USERNAME_FIELD);
  const name = r.string("name", NAME_FIELD);
  const role = r.oneOf("role", STAFF_ROLES);
  const password = r.string("password", PASSWORD_FIELD);
  const active = r.boolean("active", { optional: true }) ?? true;
  const appearance = readAppearance(r);
  r.done();
  assertStrongPassword(password, username);

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
    if (isUniqueViolation(error, "staff.username")) throw usernameTaken();
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

function staffId(raw: string): string {
  if (!STAFF_ID_PATTERN.test(raw)) throw new HttpError(404, "Staf tidak ditemukan.");
  return raw;
}

const LAST_ADMIN_MESSAGE = "Tidak dapat menghapus, menonaktifkan, atau menurunkan admin aktif terakhir.";

async function updateStaff({ request, env, url, staff: actor, params }: AuthedContext): Promise<Response> {
  const id = staffId(params.id);
  const r = new Reader(await readJsonObject(request));
  const username = r.string("username", { ...USERNAME_FIELD, optional: true });
  const name = r.string("name", { ...NAME_FIELD, optional: true });
  const role = r.oneOf("role", STAFF_ROLES, { optional: true });
  const active = r.boolean("active", { optional: true });
  const password = r.string("password", { ...PASSWORD_FIELD, optional: true });
  const appearance = readAppearance(r);
  r.done();
  if (Object.values({ username, name, role, active, password, ...appearance }).every((v) => v === undefined)) {
    throw new HttpError(422, "Tidak ada perubahan yang dikirim.");
  }

  const current = await loadStaff(env, id);
  const isSelf = current.id === actor.id;
  if (isSelf && active === false) throw conflict("Anda tidak dapat menonaktifkan akun sendiri.");
  if (isSelf && role !== undefined && role !== current.role) throw conflict("Anda tidak dapat mengubah peran akun sendiri.");

  const nextUsername = username ?? current.username;
  if (password !== undefined) assertStrongPassword(password, nextUsername);

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
    if (isUniqueViolation(error, "staff.username")) throw usernameTaken();
    throw error;
  }
  if (changes === 0) {
    const latest = await env.DB.prepare("SELECT updated_at FROM staff WHERE id = ?").bind(id).first<{ updated_at: number }>();
    if (!latest) throw new HttpError(404, "Staf tidak ditemukan.");
    if (latest.updated_at === current.updated_at && demotesAdmin) throw conflict(LAST_ADMIN_MESSAGE);
    throw conflict("Data staf berubah oleh pihak lain. Muat ulang lalu coba lagi.");
  }

  const updated = toSessionStaff({
    id, username: nextUsername, name: nextName, role: nextRole, title, description,
    avatar_color: avatarColor, initials: initialsOf(nextName), active: nextActive ? 1 : 0,
  });
  // Own password change revokes every session, including this one.
  const headers = isSelf && revoke ? { "Set-Cookie": clearSessionCookie(url) } : undefined;
  return json({ data: updated }, 200, headers);
}

async function deleteStaff({ env, staff: actor, params }: AuthedContext): Promise<Response> {
  const id = staffId(params.id);
  if (id === actor.id) throw conflict("Anda tidak dapat menghapus akun sendiri.");
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
    if (current.role === "admin" && current.active === 1) throw conflict(LAST_ADMIN_MESSAGE);
    throw conflict("Data staf berubah oleh pihak lain. Muat ulang lalu coba lagi.");
  }
  return json({ data: true });
}

export const authRoutes: Route[] = [
  publicPost("/api/setup/bootstrap", bootstrap),
  publicPost("/api/auth/login", login),
  publicPost("/api/auth/logout", logout),
  publicGet("/api/auth/session", currentSession),
  get("/api/staff", READ_ROLES, listStaff),
  send("POST", "/api/staff", ADMIN_ROLES, createStaff),
  send("PATCH", "/api/staff/:id", ADMIN_ROLES, updateStaff),
  send("DELETE", "/api/staff/:id", ADMIN_ROLES, deleteStaff),
];
