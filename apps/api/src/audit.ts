import { clientIp, sessionSecret } from "./auth";
import { hmacSign } from "./crypto";
import type { Env } from "./env";

/** Audit rows older than this are dropped by the daily cron. */
export const AUDIT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

type DetailValue = string | number | boolean | null | readonly string[];

export type AuditEvent = {
  /** Dotted event name, e.g. `pin.login`, `device.register`, `staff.update`. */
  action: string;
  outcome: "success" | "failure" | "blocked";
  actorId?: string | null;
  actorName?: string | null;
  targetId?: string | null;
  deviceId?: string | null;
  /** Non-secret facts only (field names, roles, counts). NEVER passwords, PINs, tokens or hashes. */
  detail?: Record<string, DetailValue>;
};

/** Keyed hash of the client IP: lets operators correlate events without storing the address. */
async function ipFingerprint(env: Env, request: Request): Promise<string> {
  return (await hmacSign(sessionSecret(env), `audit-ip:${clientIp(request)}`)).slice(0, 22);
}

/** Prepared insert, for callers that want the audit row in the same D1 batch as the change it records. */
export async function auditStatement(env: Env, request: Request, event: AuditEvent): Promise<D1PreparedStatement> {
  return env.DB.prepare(
    `INSERT INTO audit_log (at, action, outcome, actor_id, actor_name, target_id, device_id, ip_hash, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    Date.now(),
    event.action,
    event.outcome,
    event.actorId ?? null,
    event.actorName ?? null,
    event.targetId ?? null,
    event.deviceId ?? null,
    await ipFingerprint(env, request),
    event.detail ? JSON.stringify(event.detail) : null,
  );
}

/** Records an event on its own. A failing audit write is logged but never turns a request into an error. */
export async function audit(env: Env, request: Request, event: AuditEvent): Promise<void> {
  try {
    await (await auditStatement(env, request, event)).run();
  } catch (error) {
    console.error("Audit write failed", event.action, error);
  }
}

export async function purgeAudit(env: Env): Promise<void> {
  await env.DB.prepare("DELETE FROM audit_log WHERE at < ?")
    .bind(Date.now() - AUDIT_RETENTION_MS)
    .run();
}
