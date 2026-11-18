/** One HTTP client for the API Worker: base URL, error mapping and the response envelope. */

export const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

/** True when data lives on the API Worker; false for the browser-only demo mode. */
export const isRemoteDataSource = import.meta.env.VITE_DATA_SOURCE === "remote";

export class RemoteDataError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly status?: number,
    /** Seconds until a throttled request may be retried (`Retry-After` header), when the server sent one. */
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "RemoteDataError";
  }
}

/** Dispatched on `window` when the API rejects a request with 401; the auth gate re-checks whether the session is still valid. */
export const SESSION_REJECTED_EVENT = "wakro-session-rejected";

export const UNREACHABLE_MESSAGE = "Server data tidak dapat dijangkau. Periksa koneksi lalu coba lagi.";

export type ApiEnvelope<T> = {
  data: T;
  replayed?: boolean;
  alreadyPaid?: boolean;
  /** Present on paginated lists; `null` on the last page. */
  nextCursor?: string | null;
};

async function errorFor(response: Response): Promise<RemoteDataError> {
  // Server messages are user-facing Indonesian text (stock shortages, changed totals, validation).
  let message = `Server data mengembalikan HTTP ${response.status}.`;
  try {
    const body = (await response.json()) as { message?: unknown; errors?: Record<string, unknown> };
    const firstFieldError = body.errors
      ? Object.values(body.errors)
          .flat()
          .find((e) => typeof e === "string")
      : undefined;
    if (typeof body.message === "string") {
      message = body.message === "Data yang dikirim tidak valid." && typeof firstFieldError === "string" ? firstFieldError : body.message;
    }
  } catch {
    // Non-JSON error body: keep the HTTP status message.
  }
  const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
  return new RemoteDataError(message, undefined, response.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined);
}

/** Sign-in and session probes answer 401 for ordinary reasons (wrong credentials, no session yet). */
const AUTH_ENTRY_PATH = /^\/auth\/(login|pin-login|session|device|logout)$/;

async function send(path: string, init?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "same-origin",
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    // Login and PIN failures are also 401s; only requests for data mean the session itself was revoked or expired.
    if (response.status === 401 && !AUTH_ENTRY_PATH.test(path)) window.dispatchEvent(new Event(SESSION_REJECTED_EVENT));
    return response;
  } catch (error) {
    throw new RemoteDataError(UNREACHABLE_MESSAGE, error);
  }
}

export async function requestEnvelope<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const response = await send(path, init);
  if (!response.ok) throw await errorFor(response);
  return (await response.json()) as ApiEnvelope<T>;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await requestEnvelope<T>(path, init)).data;
}

export function jsonBody(value: unknown): Pick<RequestInit, "body"> {
  return { body: JSON.stringify(value) };
}

/** Follows `nextCursor` until the list is exhausted. */
export async function requestAllPages<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null | undefined;
  do {
    const query = new URLSearchParams(params);
    if (cursor) query.set("cursor", cursor);
    const suffix = query.size > 0 ? `?${query}` : "";
    const page = await requestEnvelope<T[]>(`${path}${suffix}`);
    rows.push(...page.data);
    cursor = page.nextCursor;
  } while (cursor);
  return rows;
}

export type ConditionalResult<T> = { notModified: true } | { notModified: false; data: T; etag: string | null };

/**
 * GET with `If-None-Match`. `cache: "no-store"` keeps the browser HTTP cache out of the way so a
 * 304 reaches us and means "nothing changed since `etag`".
 */
export async function requestConditional<T>(path: string, etag: string | null): Promise<ConditionalResult<T>> {
  const response = await send(path, {
    cache: "no-store",
    headers: etag ? { "If-None-Match": etag } : undefined,
  });
  if (response.status === 304) return { notModified: true };
  if (!response.ok) throw await errorFor(response);
  const envelope = (await response.json()) as ApiEnvelope<T>;
  return { notModified: false, data: envelope.data, etag: response.headers.get("ETag") };
}
