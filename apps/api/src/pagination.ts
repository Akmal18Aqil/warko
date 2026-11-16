import { toBase64Url, fromBase64Url } from "./crypto";
import { invalid } from "./http";

/** `(sort key, tie-breaker)` of the last row of a page. */
export type CursorKey = [number, string | number];

export function encodeCursor(key: CursorKey): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(key)));
}

export function readCursor(url: URL): CursorKey | null {
  const raw = url.searchParams.get("cursor");
  if (raw === null || raw === "") return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(raw)));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "number" &&
      Number.isSafeInteger(parsed[0]) &&
      (typeof parsed[1] === "string" || (typeof parsed[1] === "number" && Number.isSafeInteger(parsed[1])))
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // fall through to the validation error
  }
  throw invalid("cursor", "cursor tidak valid.");
}

export function readLimit(url: URL, defaultLimit: number, maxLimit: number): number {
  const raw = url.searchParams.get("limit");
  if (raw === null || raw === "") return defaultLimit;
  const limit = Number(raw);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxLimit) {
    throw invalid("limit", `limit harus bilangan bulat 1-${maxLimit}.`);
  }
  return limit;
}

/** Callers query `limit + 1` rows; the extra row only signals that another page exists. */
export function toPage<T>(rows: readonly T[], limit: number, keyOf: (row: T) => CursorKey): { rows: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { rows: [...rows], nextCursor: null };
  const page = rows.slice(0, limit);
  return { rows: page, nextCursor: encodeCursor(keyOf(page[page.length - 1])) };
}
