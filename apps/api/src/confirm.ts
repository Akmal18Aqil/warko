import { audit } from "./audit";
import { clearAttempts, consumeAttempt, throttledError } from "./auth";
import { DUMMY_PASSWORD_HASH, sha256Hex, verifyPassword } from "./crypto";
import type { Env, SessionStaff } from "./env";
import { HttpError } from "./http";

const CONFIRM_ATTEMPT_LIMIT = 5;

/**
 * Re-checks the acting staff member's own password before a staff-management or security action.
 * Required even for PIN sessions: a PIN alone never authorises these. Wrong guesses are counted per
 * actor across all IPs, before the slow hash, so bursts cannot get around the limit.
 */
export async function confirmActorPassword(
  env: Env,
  request: Request,
  actor: SessionStaff,
  password: string,
  field: string,
): Promise<void> {
  const key = await sha256Hex(`confirm:${actor.id}`);
  if (!(await consumeAttempt(env, key, CONFIRM_ATTEMPT_LIMIT))) {
    await audit(env, request, { action: "password.confirm", outcome: "blocked", actorId: actor.id, actorName: actor.name });
    throw throttledError();
  }
  const row = await env.DB.prepare("SELECT password_hash FROM staff WHERE id = ?").bind(actor.id).first<{ password_hash: string }>();
  if (!(await verifyPassword(password, row?.password_hash ?? DUMMY_PASSWORD_HASH)) || !row) {
    await audit(env, request, { action: "password.confirm", outcome: "failure", actorId: actor.id, actorName: actor.name });
    const message = "Kata sandi konfirmasi salah.";
    throw new HttpError(403, message, { [field]: [message] });
  }
  await clearAttempts(env, key);
}
