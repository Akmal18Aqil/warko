import { hmacSign, randomToken, safeEqual, sha256Hex } from "./crypto";
import type { Env, SessionStaff, StaffRole } from "./env";
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

type StaffRow = {
  id: string;
  username: string;
  name: string;
  role: StaffRole;
  title: string;
  description: string;
  avatar_color: string;
  initials: string;
  active: number;
};

export const STAFF_COLUMNS = "id, username, name, role, title, description, avatar_color, initials, active";

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

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("Cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0 && part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return undefined;
}

function cookieAttributes(url: URL, maxAgeSeconds: number): string {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

// ---- sessions ------------------------------------------------------------

export async function createSession(env: Env, staffId: string, url: URL): Promise<string> {
  const secret = sessionSecret(env);
  const id = randomToken(32);
  const now = Date.now();
  await env.DB.prepare("INSERT INTO sessions (id_hash, staff_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(id), staffId, now, now + SESSION_TTL_MS)
    .run();
  const token = `${id}.${await hmacSign(secret, id)}`;
  return `${cookieName(url)}=${token}${cookieAttributes(url, SESSION_TTL_MS / 1000)}`;
}

export function clearSessionCookie(url: URL): string {
  return `${cookieName(url)}=${cookieAttributes(url, 0)}`;
}

/** Returns the authenticated, active staff member or null. Never throws for bad tokens. */
export async function readSession(env: Env, request: Request, url: URL): Promise<SessionStaff | null> {
  const secret = sessionSecret(env);
  const token = readCookie(request, cookieName(url));
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!(await safeEqual(sig, await hmacSign(secret, id)))) return null;

  const row = await env.DB.prepare(
    `SELECT s.${STAFF_COLUMNS.split(", ").join(", s.")}
       FROM sessions x JOIN staff s ON s.id = x.staff_id
      WHERE x.id_hash = ? AND x.expires_at > ? AND s.active = 1`,
  )
    .bind(await sha256Hex(id), Date.now())
    .first<StaffRow>();
  return row ? toSessionStaff(row) : null;
}

export async function destroySession(env: Env, request: Request, url: URL): Promise<void> {
  const token = readCookie(request, cookieName(url));
  const id = token?.split(".")[0];
  if (id) await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await sha256Hex(id)).run();
}

export async function requireSession(env: Env, request: Request, url: URL): Promise<SessionStaff> {
  const staff = await readSession(env, request, url);
  if (!staff) throw new HttpError(401, "Sesi tidak valid. Silakan masuk.");
  return staff;
}

export function requireRole(staff: SessionStaff, ...roles: StaffRole[]): void {
  if (!roles.includes(staff.role)) throw new HttpError(403, "Peran Anda tidak diizinkan melakukan aksi ini.");
}

// ---- throttling ----------------------------------------------------------

const WINDOW_MS = 15 * 60 * 1000;

export async function isThrottled(env: Env, key: string, limit: number): Promise<boolean> {
  const row = await env.DB.prepare("SELECT failures, window_start FROM auth_throttle WHERE key = ?")
    .bind(key)
    .first<{ failures: number; window_start: number }>();
  if (!row) return false;
  return Date.now() - row.window_start <= WINDOW_MS && row.failures >= limit;
}

export async function recordFailure(env: Env, key: string): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO auth_throttle (key, failures, window_start) VALUES (?1, 1, ?2)
     ON CONFLICT(key) DO UPDATE SET
       failures = CASE WHEN ?2 - window_start > ?3 THEN 1 ELSE failures + 1 END,
       window_start = CASE WHEN ?2 - window_start > ?3 THEN ?2 ELSE window_start END`,
  )
    .bind(key, now, WINDOW_MS)
    .run();
}

export async function clearFailures(env: Env, key: string): Promise<void> {
  await env.DB.prepare("DELETE FROM auth_throttle WHERE key = ?").bind(key).run();
}

export async function purgeExpired(env: Env): Promise<void> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    env.DB.prepare("DELETE FROM auth_throttle WHERE window_start < ?").bind(now - WINDOW_MS),
  ]);
}

export function throttledError(): HttpError {
  return new HttpError(429, "Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.", undefined, {
    "Retry-After": String(WINDOW_MS / 1000),
  });
}
