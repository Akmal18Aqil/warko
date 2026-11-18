import { ADMIN_ROLES, READ_ROLES } from "@wakro/shared";
import { audit, auditStatement } from "../audit";
import {
  clearAttempts,
  clearSessionCookie,
  clientIp,
  consumeAttempts,
  createSession,
  destroySession,
  releaseAttempt,
  THROTTLE_WINDOW_MS,
} from "../auth";
import { confirmActorPassword } from "../confirm";
import { sha256Hex } from "../crypto";
import { clearDeviceCookie, deviceCookie, findActiveDevice, hasDeviceCookie, newDeviceToken } from "../devices";
import { decodeId } from "../guards";
import { conflict, HttpError, invalid, json, Reader, readJsonObject } from "../http";
import { hashPin, PIN_PATTERN, pinWeakness, verifyPin } from "../pin";
import { type AuthedContext, get, publicGet, publicPost, type Route, type RouteContext, send } from "../router";
import { staffId } from "./auth";

const PIN_ACCOUNT_LIMIT = 5;
const PIN_DEVICE_LIMIT = 15;
const PIN_IP_LIMIT = 30;
const PIN_FIELD = { max: 64, pattern: PIN_PATTERN, patternMessage: "PIN harus 6 digit angka." } as const;
const PASSWORD_CONFIRM_FIELD = { max: 4096 } as const;
const STAFF_ID_FIELD = { max: 64, pattern: /^[A-Za-z0-9-]{1,64}$/, patternMessage: "staffId tidak valid." } as const;

const NOT_REGISTERED = "Perangkat ini belum terdaftar. Minta admin mendaftarkannya, atau masuk dengan kata sandi.";

function pinThrottledError(): HttpError {
  return new HttpError(429, "Terlalu banyak percobaan PIN. Coba lagi dalam 15 menit.", undefined, {
    "Retry-After": String(THROTTLE_WINDOW_MS / 1000),
  });
}

// ---- this browser's device -----------------------------------------------

/** What the PIN gate needs: is this browser registered, and who can pick their name on it. */
async function deviceStatus({ request, env, url }: RouteContext): Promise<Response> {
  const device = await findActiveDevice(env, request, url);
  if (!device) {
    // A cookie that no longer matches an active device (revoked, forgotten) is dropped.
    return json({ data: { registered: false } }, 200, hasDeviceCookie(request, url) ? { "Set-Cookie": clearDeviceCookie(url) } : undefined);
  }
  const { results } = await env.DB.prepare(
    `SELECT id, name, role, title, description, avatar_color, initials FROM staff
      WHERE active = 1 AND pin_hash IS NOT NULL ORDER BY name COLLATE NOCASE, id`,
  ).all<{ id: string; name: string; role: string; title: string; description: string; avatar_color: string; initials: string }>();
  return json({
    data: {
      registered: true,
      id: device.id,
      name: device.name,
      staff: results.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        title: row.title,
        description: row.description,
        avatarColor: row.avatar_color,
        initials: row.initials,
      })),
    },
  });
}

async function pinLogin({ request, env, url }: RouteContext): Promise<Response> {
  const r = new Reader(await readJsonObject(request));
  const id = r.string("staffId", STAFF_ID_FIELD);
  const pin = r.string("pin", PIN_FIELD);
  r.done();

  const device = await findActiveDevice(env, request, url);
  if (!device) {
    throw new HttpError(
      403,
      NOT_REGISTERED,
      undefined,
      hasDeviceCookie(request, url) ? { "Set-Cookie": clearDeviceCookie(url) } : undefined,
    );
  }

  const member = await env.DB.prepare("SELECT id, name, pin_hash FROM staff WHERE id = ? AND active = 1")
    .bind(id)
    .first<{ id: string; name: string; pin_hash: string | null }>();

  // Count the attempt before the slow hash so parallel guesses cannot all pass. The account counter
  // is shared by every device and IP; it only exists for real accounts so random ids cannot bloat the table.
  const deviceKey = await sha256Hex(`pin-device:${device.id}`);
  const ipKey = await sha256Hex(`pin-ip:${clientIp(request)}`);
  const accountKey = await sha256Hex(`pin-account:${id}`);
  const checks = [
    { key: deviceKey, limit: PIN_DEVICE_LIMIT },
    { key: ipKey, limit: PIN_IP_LIMIT },
    ...(member ? [{ key: accountKey, limit: PIN_ACCOUNT_LIMIT }] : []),
  ];
  if ((await consumeAttempts(env, checks)).includes(false)) {
    await audit(env, request, { action: "pin.login", outcome: "blocked", targetId: member?.id ?? null, deviceId: device.id });
    throw pinThrottledError();
  }

  const verified = await verifyPin(env, id, pin, member?.pin_hash ?? null);
  if (!member || !verified) {
    await audit(env, request, { action: "pin.login", outcome: "failure", targetId: member?.id ?? null, deviceId: device.id });
    throw new HttpError(401, "PIN salah.");
  }

  // A correct PIN does not count against the shared device/IP budgets; the account's own counter resets.
  await Promise.all([clearAttempts(env, accountKey), releaseAttempt(env, deviceKey), releaseAttempt(env, ipKey)]);
  // Switching user replaces the session this browser still holds.
  await destroySession(env, request, url);
  const cookie = await createSession(env, member.id, url, { authMethod: "pin", deviceId: device.id });
  await env.DB.prepare("UPDATE devices SET last_used_at = ? WHERE id = ?").bind(Date.now(), device.id).run();
  await audit(env, request, { action: "pin.login", outcome: "success", actorId: member.id, actorName: member.name, deviceId: device.id });
  return json({ data: true }, 200, { "Set-Cookie": cookie });
}

// ---- device management (admin, password-confirmed) -------------------------

type DeviceRow = {
  id: string;
  name: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
  created_by_name: string | null;
};

async function listDevices({ request, env, url }: AuthedContext): Promise<Response> {
  const current = await findActiveDevice(env, request, url);
  const { results } = await env.DB.prepare(
    `SELECT d.id, d.name, d.created_at, d.last_used_at, d.revoked_at, s.name AS created_by_name
       FROM devices d LEFT JOIN staff s ON s.id = d.created_by
      ORDER BY d.revoked_at IS NOT NULL, d.created_at DESC LIMIT 200`,
  ).all<DeviceRow>();
  return json({
    data: results.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      revokedAt: row.revoked_at,
      createdByName: row.created_by_name,
      current: row.id === current?.id,
    })),
  });
}

/** Registers the browser making this request: the admin must be sitting at the device. */
async function registerDevice({ request, env, url, staff: actor }: AuthedContext): Promise<Response> {
  const r = new Reader(await readJsonObject(request));
  const name = r.string("name", { max: 80, nonBlank: true, normalize: (value) => value.trim().replace(/\s+/g, " ") });
  const password = r.string("password", PASSWORD_CONFIRM_FIELD);
  r.done();
  await confirmActorPassword(env, request, actor, password, "password");
  if (await findActiveDevice(env, request, url)) {
    throw conflict("Perangkat ini sudah terdaftar. Cabut pendaftaran lama sebelum mendaftarkan ulang.");
  }

  const id = crypto.randomUUID();
  const { token, hash } = await newDeviceToken();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO devices (id, name, token_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?)").bind(
      id,
      name,
      hash,
      actor.id,
      Date.now(),
    ),
    await auditStatement(env, request, {
      action: "device.register",
      outcome: "success",
      actorId: actor.id,
      actorName: actor.name,
      deviceId: id,
      detail: { name },
    }),
  ]);
  return json({ data: { id, name } }, 201, { "Set-Cookie": deviceCookie(url, token) });
}

async function revokeDevice({ request, env, url, staff: actor, params }: AuthedContext): Promise<Response> {
  const id = decodeId(params.id);
  const r = new Reader(await readJsonObject(request));
  const password = r.string("password", PASSWORD_CONFIRM_FIELD);
  r.done();
  await confirmActorPassword(env, request, actor, password, "password");

  const device = await env.DB.prepare("SELECT id, name FROM devices WHERE id = ?").bind(id).first<{ id: string; name: string }>();
  if (!device) throw new HttpError(404, "Perangkat tidak ditemukan.");
  const current = await findActiveDevice(env, request, url);
  await env.DB.batch([
    env.DB.prepare("UPDATE devices SET revoked_at = ?, revoked_by = ? WHERE id = ? AND revoked_at IS NULL").bind(Date.now(), actor.id, id),
    env.DB.prepare("DELETE FROM sessions WHERE device_id = ?").bind(id),
    await auditStatement(env, request, {
      action: "device.revoke",
      outcome: "success",
      actorId: actor.id,
      actorName: actor.name,
      deviceId: id,
      detail: { name: device.name },
    }),
  ]);
  return json({ data: true }, 200, current?.id === id ? { "Set-Cookie": clearDeviceCookie(url) } : undefined);
}

// ---- PIN management --------------------------------------------------------

/** `pin: null` clears the PIN. Weak-but-well-formed PINs (000000, 123456) are refused. */
function readNewPin(body: Record<string, unknown>, r: Reader): string | null {
  if (body.pin === null) return null;
  const pin = r.string("pin", PIN_FIELD);
  const weakness = pin === undefined ? null : pinWeakness(pin);
  if (weakness) r.addError("pin", weakness);
  return pin ?? null;
}

async function changePin(ctx: AuthedContext, targetId: string): Promise<Response> {
  const { request, env, url, staff: actor } = ctx;
  const body = await readJsonObject(request);
  const r = new Reader(body);
  const pin = readNewPin(body, r);
  const password = r.string("password", PASSWORD_CONFIRM_FIELD);
  r.done();
  await confirmActorPassword(env, request, actor, password, "password");

  const target = await env.DB.prepare("SELECT id, name, active, updated_at FROM staff WHERE id = ?")
    .bind(targetId)
    .first<{ id: string; name: string; active: number; updated_at: number }>();
  if (!target) throw new HttpError(404, "Staf tidak ditemukan.");
  if (pin !== null && target.active !== 1) throw conflict("Akun nonaktif tidak dapat diberi PIN.");

  const pinHash = pin === null ? null : await hashPin(env, targetId, pin);
  const stamp = Math.max(Date.now(), target.updated_at + 1);
  const accountKey = await sha256Hex(`pin-account:${targetId}`);
  // The session and lockout rows go only when the update above applied (it is the sole writer of this stamp).
  const applied = "(SELECT updated_at FROM staff WHERE id = ?) = ?";
  const results = await env.DB.batch([
    env.DB.prepare("UPDATE staff SET pin_hash = ?, pin_set_at = ?, updated_at = ? WHERE id = ? AND updated_at = ?").bind(
      pinHash,
      pinHash === null ? null : stamp,
      stamp,
      targetId,
      target.updated_at,
    ),
    env.DB.prepare(`DELETE FROM sessions WHERE staff_id = ? AND ${applied}`).bind(targetId, targetId, stamp),
    env.DB.prepare(`DELETE FROM auth_throttle WHERE key = ? AND ${applied}`).bind(accountKey, targetId, stamp),
  ]);
  if (results[0].meta.changes === 0) throw conflict("Data staf berubah oleh pihak lain. Muat ulang lalu coba lagi.");

  await audit(env, request, {
    action: pin === null ? "pin.clear" : "pin.set",
    outcome: "success",
    actorId: actor.id,
    actorName: actor.name,
    targetId,
    detail: { sessionsRevoked: true },
  });
  const selfRevoked = targetId === actor.id;
  return json({ data: { selfRevoked } }, 200, selfRevoked ? { "Set-Cookie": clearSessionCookie(url) } : undefined);
}

const setStaffPin = (ctx: AuthedContext) => changePin(ctx, staffId(ctx.params.id));
const setOwnPin = (ctx: AuthedContext) => changePin(ctx, ctx.staff.id);

// ---- audit log -------------------------------------------------------------

type AuditRow = {
  id: number;
  at: number;
  action: string;
  outcome: string;
  actor_id: string | null;
  actor_name: string | null;
  target_id: string | null;
  device_id: string | null;
  detail: string | null;
};

const AUDIT_MAX_LIMIT = 200;

async function listAudit({ env, url }: AuthedContext): Promise<Response> {
  const limitParam = url.searchParams.get("limit");
  const beforeParam = url.searchParams.get("before");
  const limit = limitParam === null ? 50 : Number(limitParam);
  const before = beforeParam === null ? Number.MAX_SAFE_INTEGER : Number(beforeParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > AUDIT_MAX_LIMIT) throw invalid("limit", `limit harus 1-${AUDIT_MAX_LIMIT}.`);
  if (!Number.isInteger(before) || before < 1) throw invalid("before", "before harus bilangan bulat positif.");

  const { results } = await env.DB.prepare(
    `SELECT id, at, action, outcome, actor_id, actor_name, target_id, device_id, detail
       FROM audit_log WHERE id < ? ORDER BY id DESC LIMIT ?`,
  )
    .bind(before, limit + 1)
    .all<AuditRow>();
  const page = results.slice(0, limit);
  return json({
    data: page.map((row) => ({
      id: row.id,
      at: row.at,
      action: row.action,
      outcome: row.outcome,
      actorId: row.actor_id,
      actorName: row.actor_name,
      targetId: row.target_id,
      deviceId: row.device_id,
      detail: row.detail ? JSON.parse(row.detail) : null,
    })),
    nextBefore: results.length > limit ? (page[page.length - 1]?.id ?? null) : null,
  });
}

export const pinRoutes: Route[] = [
  publicGet("/api/auth/device", deviceStatus),
  publicPost("/api/auth/pin-login", pinLogin),
  get("/api/auth/devices", ADMIN_ROLES, listDevices),
  send("POST", "/api/auth/devices", ADMIN_ROLES, registerDevice),
  send("POST", "/api/auth/devices/:id/revoke", ADMIN_ROLES, revokeDevice),
  send("PUT", "/api/staff/:id/pin", ADMIN_ROLES, setStaffPin),
  send("PUT", "/api/auth/pin", READ_ROLES, setOwnPin),
  get("/api/audit", ADMIN_ROLES, listAudit),
];
