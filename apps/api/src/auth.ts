import type { StaffRole } from "@wakro/shared";
import { hmacSign, randomToken, safeEqual, sha256Hex } from "./crypto";
import type { Env, SessionStaff } from "./env";
import { HttpError } from "./http";

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;

export function sessionSecret(env: Env): string {
  const secret = env.SESSION_SECRET;
  // Fail closed: never sign or accept sessions with a missing/weak secret.
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new HttpError(503, "Autentikasi server belum dikonfigurasi (SESSION_SECRET).");
  }
  return secret;
}

export type StaffRow = {
  id: string;
  username: string;
  name: string;
  role: StaffRole;
  title: string;
  description: string;
  avatar_color: string;
  initials: string;
  active: number;
  has_pin: number;
};

const STAFF_FIELDS = ["id", "username", "name", "role", "title", "description", "avatar_color", "initials", "active"] as const;
/** Select list for `StaffRow`; `has_pin` exposes only whether a PIN exists, never the hash. */
export const STAFF_COLUMNS = `${STAFF_FIELDS.join(", ")}, (pin_hash IS NOT NULL) AS has_pin`;

export function toSessionStaff(row: StaffRow): SessionStaff {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    title: row.title,
    description: row.description,
    avatarColor: row.avatar_color,
    initials: row.initials,
    active: row.active === 1,
    hasPin: row.has_pin === 1,
  };
}

export const ROLE_DEFAULTS: Record<StaffRole, { title: string; description: string; avatarColor: string }> = {
  admin: {
    title: "Admin",
    description: "Akses lengkap: POS kasir, produk, laporan, meja, laci kas & sistem",
    avatarColor: "bg-accent text-white",
  },
  kasir: {
    title: "Kasir",
    description: "Akses POS kasir, produk, laporan, meja & laci kas",
    avatarColor: "bg-accent text-white",
  },
  pelayan: {
    title: "Pelayan (Waitstaff)",
    description: "Input pesanan keliling, status meja, & notifikasi siap saji",
    avatarColor: "bg-emerald-500 text-white",
  },
  dapur: {
    title: "Dapur (KDS)",
    description: "Layar antrean memasak, timer pesanan, & tombol siap saji",
    avatarColor: "bg-amber-500 text-white",
  },
  manajer: {
    title: "Manajer Restoran",
    description: "Analisis laporan keuangan, ringkasan pesanan, laci kas & shift",
    avatarColor: "bg-sky-500 text-white",
  },
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

// ---- cookies -------------------------------------------------------------

function cookieName(url: URL): string {
  return url.protocol === "https:" ? "__Host-kasa_session" : "kasa_session";
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("Cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0 && part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return undefined;
}

export function cookieAttributes(url: URL, maxAgeSeconds: number): string {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

// ---- sessions ------------------------------------------------------------

export type AuthMethod = "password" | "pin";

export type ActiveSession = { staff: SessionStaff; authMethod: AuthMethod; deviceId: string | null };

/** `deviceId` binds a PIN session to the registered device it came from. */
export async function createSession(
  env: Env,
  staffId: string,
  url: URL,
  options: { authMethod?: AuthMethod; deviceId?: string } = {},
): Promise<string> {
  const secret = sessionSecret(env);
  const id = randomToken(32);
  const now = Date.now();
  await env.DB.prepare("INSERT INTO sessions (id_hash, staff_id, created_at, expires_at, auth_method, device_id) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(await sha256Hex(id), staffId, now, now + SESSION_TTL_MS, options.authMethod ?? "password", options.deviceId ?? null)
    .run();
  const token = `${id}.${await hmacSign(secret, id)}`;
  return `${cookieName(url)}=${token}${cookieAttributes(url, SESSION_TTL_MS / 1000)}`;
}

export function clearSessionCookie(url: URL): string {
  return `${cookieName(url)}=${cookieAttributes(url, 0)}`;
}

/** Returns the authenticated, active session or null. Never throws for bad tokens. */
export async function readSession(env: Env, request: Request, url: URL): Promise<ActiveSession | null> {
  const secret = sessionSecret(env);
  const token = readCookie(request, cookieName(url));
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!(await safeEqual(sig, await hmacSign(secret, id)))) return null;

  // A PIN session is only valid while the device it was issued on is still registered.
  const row = await env.DB.prepare(
    `SELECT ${STAFF_FIELDS.map((field) => `s.${field}`).join(", ")}, (s.pin_hash IS NOT NULL) AS has_pin,
            x.auth_method, x.device_id
       FROM sessions x
       JOIN staff s ON s.id = x.staff_id
       LEFT JOIN devices d ON d.id = x.device_id
      WHERE x.id_hash = ? AND x.expires_at > ? AND s.active = 1
        AND (x.auth_method = 'password' OR (d.id IS NOT NULL AND d.revoked_at IS NULL))`,
  )
    .bind(await sha256Hex(id), Date.now())
    .first<StaffRow & { auth_method: AuthMethod; device_id: string | null }>();
  return row ? { staff: toSessionStaff(row), authMethod: row.auth_method, deviceId: row.device_id } : null;
}

export async function destroySession(env: Env, request: Request, url: URL): Promise<void> {
  const token = readCookie(request, cookieName(url));
  const id = token?.split(".")[0];
  if (id)
    await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?")
      .bind(await sha256Hex(id))
      .run();
}

export async function requireSession(env: Env, request: Request, url: URL): Promise<SessionStaff> {
  const session = await readSession(env, request, url);
  if (!session) throw new HttpError(401, "Sesi tidak valid. Silakan masuk.");
  return session.staff;
}

// ---- throttling ----------------------------------------------------------

/** Window for login / setup attempt counters; also the age after which `purgeExpired` drops them. */
export const THROTTLE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Counts one attempt for `key` and reports whether it is still within `limit` attempts per window.
 * Increment-then-check in a single upsert, so parallel requests cannot all slip under the limit.
 */
export async function consumeAttempt(env: Env, key: string, limit: number, windowMs = THROTTLE_WINDOW_MS): Promise<boolean> {
  const row = await env.DB.prepare(
    `INSERT INTO auth_throttle (key, failures, window_start) VALUES (?1, 1, ?2)
     ON CONFLICT(key) DO UPDATE SET
       failures = CASE WHEN ?2 - window_start > ?3 THEN 1 ELSE failures + 1 END,
       window_start = CASE WHEN ?2 - window_start > ?3 THEN ?2 ELSE window_start END
     RETURNING failures`,
  )
    .bind(key, Date.now(), windowMs)
    .first<{ failures: number }>();
  return row !== null && row.failures <= limit;
}

/**
 * Counts one attempt for every key in a single D1 transaction (same upsert as `consumeAttempt`) and
 * reports per key whether it is still within its limit. All counters move together, so parallel
 * guesses cannot slip under any of the limits.
 */
export async function consumeAttempts(
  env: Env,
  checks: readonly { key: string; limit: number }[],
  windowMs = THROTTLE_WINDOW_MS,
): Promise<boolean[]> {
  const now = Date.now();
  const results = await env.DB.batch<{ failures: number }>(
    checks.map(({ key }) =>
      env.DB.prepare(
        `INSERT INTO auth_throttle (key, failures, window_start) VALUES (?1, 1, ?2)
         ON CONFLICT(key) DO UPDATE SET
           failures = CASE WHEN ?2 - window_start > ?3 THEN 1 ELSE failures + 1 END,
           window_start = CASE WHEN ?2 - window_start > ?3 THEN ?2 ELSE window_start END
         RETURNING failures`,
      ).bind(key, now, windowMs),
    ),
  );
  return results.map((result, i) => (result.results[0]?.failures ?? Number.POSITIVE_INFINITY) <= checks[i].limit);
}

/** Gives back one attempt (a successful login does not count against the shared per-IP budget). */
export async function releaseAttempt(env: Env, key: string): Promise<void> {
  await env.DB.prepare("UPDATE auth_throttle SET failures = MAX(failures - 1, 0) WHERE key = ?").bind(key).run();
}

export async function clearAttempts(env: Env, key: string): Promise<void> {
  await env.DB.prepare("DELETE FROM auth_throttle WHERE key = ?").bind(key).run();
}

/** Drops expired sessions and stale throttle counters. Runs from the daily cron trigger. */
export async function purgeExpired(env: Env): Promise<void> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    env.DB.prepare("DELETE FROM auth_throttle WHERE window_start < ?").bind(now - THROTTLE_WINDOW_MS),
  ]);
}

export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

export function throttledError(): HttpError {
  return new HttpError(429, "Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.", undefined, {
    "Retry-After": String(THROTTLE_WINDOW_MS / 1000),
  });
}
