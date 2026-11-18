import { cookieAttributes, readCookie } from "./auth";
import { randomToken, sha256Hex } from "./crypto";
import type { Env } from "./env";

/** Browsers cap cookie lifetime at about 400 days. */
export const DEVICE_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export type DeviceIdentity = { id: string; name: string };

function deviceCookieName(url: URL): string {
  return url.protocol === "https:" ? "__Host-kasa_device" : "kasa_device";
}

/** The database only ever sees this hash; the random token stays in the browser cookie. */
function deviceTokenHash(token: string): Promise<string> {
  return sha256Hex(`wakro:device:v1:${token}`);
}

export function deviceCookie(url: URL, token: string): string {
  return `${deviceCookieName(url)}=${token}${cookieAttributes(url, DEVICE_COOKIE_MAX_AGE_SECONDS)}`;
}

export function clearDeviceCookie(url: URL): string {
  return `${deviceCookieName(url)}=${cookieAttributes(url, 0)}`;
}

export function hasDeviceCookie(request: Request, url: URL): boolean {
  return readCookie(request, deviceCookieName(url)) !== undefined;
}

/** The registered, non-revoked device this request comes from, or null. */
export async function findActiveDevice(env: Env, request: Request, url: URL): Promise<DeviceIdentity | null> {
  const token = readCookie(request, deviceCookieName(url));
  if (!token || token.length > 128) return null;
  return env.DB.prepare("SELECT id, name FROM devices WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(await deviceTokenHash(token))
    .first<DeviceIdentity>();
}

/** A fresh token plus its stored hash. The caller inserts the hash and sets the cookie with the token. */
export async function newDeviceToken(): Promise<{ token: string; hash: string }> {
  const token = randomToken(32);
  return { token, hash: await deviceTokenHash(token) };
}
