import { ACCESS_DENIED_MESSAGE, type StaffRole } from "@wakro/shared";
import type { SessionStaff } from "./env";
import { HttpError, invalid } from "./http";

export const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/;

/** Same-origin CSRF guard for state-changing requests (cookie-authenticated API). */
export function assertSameOrigin(request: Request, url: URL): void {
  const origin = request.headers.get("Origin");
  if (origin !== null) {
    if (origin !== url.origin) throw new HttpError(403, "Permintaan lintas-origin ditolak.");
    return;
  }
  // No Origin header: only accept browsers that vouch for same-origin / user-initiated requests.
  const site = request.headers.get("Sec-Fetch-Site");
  if (site === "same-origin" || site === "none") return;
  throw new HttpError(403, "Permintaan lintas-origin ditolak.");
}

export function requireRole(staff: SessionStaff, ...roles: readonly StaffRole[]): void {
  if (!roles.includes(staff.role)) throw new HttpError(403, ACCESS_DENIED_MESSAGE);
}

/** Decodes and validates an id taken from a URL path segment. */
export function decodeId(segment: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    throw new HttpError(400, "Id pada URL tidak valid.");
  }
  if (!ID_PATTERN.test(decoded)) throw new HttpError(400, "Id pada URL tidak valid.");
  return decoded;
}

export function validId(field: string, value: string): string {
  if (!ID_PATTERN.test(value)) {
    throw invalid(field, `${field} hanya boleh berisi huruf, angka, titik, titik dua, garis bawah, dan strip (maks 100).`);
  }
  return value;
}

export function assertBodyId(body: Record<string, unknown>, id: string): void {
  const bodyId = body.id;
  if (bodyId !== undefined && bodyId !== null && bodyId !== id) {
    throw invalid("id", "id pada body harus sama dengan id pada URL.");
  }
}

export function parseOrderNo(raw: string): number {
  const no = Number(raw);
  if (!Number.isSafeInteger(no) || no < 1) throw new HttpError(404, "Pesanan tidak ditemukan.");
  return no;
}

export function changes(result: D1Result): number {
  return result.meta.changes ?? 0;
}

/** True when a D1 error is a UNIQUE violation whose message names `target` (e.g. `staff.username`). */
export function isUniqueViolation(error: unknown, target: string): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed") && error.message.includes(target);
}

export function isCheckViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes("CHECK constraint failed");
}

export function isNotNullViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes("NOT NULL constraint failed");
}
