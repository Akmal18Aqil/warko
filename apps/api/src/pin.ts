import { fromBase64Url, hmacSign, PBKDF2_ITERATIONS, pbkdf2, randomToken, toBase64Url } from "./crypto";
import type { Env } from "./env";
import { HttpError } from "./http";

export const PIN_PATTERN = /^\d{6}$/;
const MIN_PEPPER_LENGTH = 32;
/** Label that separates the PIN pepper key from every other use of the server secrets. */
const PEPPER_DOMAIN = "wakro/v1/pin-pepper";
const PIN_DOMAIN = "wakro/v1/pin";
/** Fixed salt for the decoy check against accounts without a PIN. */
const DECOY_SALT = fromBase64Url("c3RhdGljLWRlY295LXNhbHQ");

/** Why a well-formed PIN is refused (all-same digit, straight run), or null when acceptable. */
export function pinWeakness(pin: string): string | null {
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((digit, i) => digit - digits[i]);
  const sameDigit = steps.every((step) => step === 0);
  const ascending = steps.every((step) => step === 1);
  const descending = steps.every((step) => step === -1);
  return sameDigit || ascending || descending ? "PIN terlalu mudah ditebak (angka berulang atau berurutan)." : null;
}

/** The pepper is a mandatory secret of its own; it must never be the session secret. */
function pepperSecret(env: Env): string {
  const pepper = env.PIN_PEPPER;
  if (!pepper || pepper.length < MIN_PEPPER_LENGTH || pepper === env.SESSION_SECRET) {
    throw new HttpError(503, "Autentikasi PIN belum dikonfigurasi (PIN_PEPPER).");
  }
  return pepper;
}

/**
 * Stage 1: HMAC of the PIN keyed with the pepper and bound to the account, so a stolen database
 * cannot be brute-forced offline without the secret and a hash copied between accounts is useless.
 * Stage 2 (PBKDF2 with a per-PIN salt) makes each guess expensive.
 */
async function pinDigest(env: Env, staffId: string, pin: string): Promise<string> {
  const key = await hmacSign(pepperSecret(env), PEPPER_DOMAIN);
  return hmacSign(key, `${PIN_DOMAIN}:${staffId}:${pin}`);
}

/** Format: pin1$sha256$<iterations>$<salt b64url>$<hash b64url> */
export async function hashPin(env: Env, staffId: string, pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(await pinDigest(env, staffId, pin), salt, PBKDF2_ITERATIONS);
  return `pin1$sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

/** `stored = null` (no such account / no PIN) does the same work and always fails, so timing stays flat. */
export async function verifyPin(env: Env, staffId: string, pin: string, stored: string | null): Promise<boolean> {
  const parts = (stored ?? "").split("$");
  const wellFormed = parts.length === 5 && parts[0] === "pin1" && parts[1] === "sha256";
  const iterations = wellFormed ? Number(parts[2]) : PBKDF2_ITERATIONS;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;
  const salt = wellFormed ? fromBase64Url(parts[3]) : DECOY_SALT;
  const actual = await pbkdf2(await pinDigest(env, staffId, pin), salt, iterations);
  const expected = wellFormed ? fromBase64Url(parts[4]) : fromBase64Url(randomToken(32));
  return wellFormed && expected.length === actual.length && crypto.subtle.timingSafeEqual(actual, expected);
}
