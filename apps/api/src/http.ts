export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string[]>,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

/** Same as `json` for a body that is already serialized (e.g. one that was hashed for an ETag). */
export function jsonText(body: string, status = 200, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(BASE_HEADERS)) h.set(k, v);
  return new Response(body, { status, headers: h });
}

export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return jsonText(JSON.stringify(body), status, headers);
}

export function invalid(field: string, ...messages: string[]): HttpError {
  return new HttpError(422, "Data yang dikirim tidak valid.", { [field]: messages });
}

export function conflict(message: string): HttpError {
  return new HttpError(409, message);
}

export function errorResponse(error: HttpError): Response {
  return json(
    error.errors ? { message: error.message, errors: error.errors } : { message: error.message },
    error.status,
    error.headers,
  );
}

const MAX_BODY_BYTES = 256 * 1024;

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("Content-Type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type harus application/json.");
  }
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, "Permintaan terlalu besar.");
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "Permintaan terlalu besar.");
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, "JSON tidak valid.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new HttpError(422, "Body harus berupa objek JSON.");
  }
  return parsed as Record<string, unknown>;
}

export type StringOptions = {
  max: number;
  min?: number;
  /** Trims the value and rejects it when nothing is left. */
  nonBlank?: boolean;
  normalize?: (value: string) => string;
  pattern?: RegExp;
  patternMessage?: string;
};

export type ReaderOptions = {
  /** Field-name prefix for nested readers. */
  prefix?: string;
  /** Error bag shared with the parent reader. */
  errors?: Record<string, string[]>;
  /** Report every key of the body that was never read as an error. */
  strict?: boolean;
};

/** Collects field errors the same way Laravel's 422 responses did. */
export class Reader {
  private readonly errors: Record<string, string[]>;
  private readonly prefix: string;
  private readonly strict: boolean;
  private readonly seen = new Set<string>();

  constructor(
    private readonly data: Record<string, unknown>,
    options: ReaderOptions = {},
  ) {
    this.errors = options.errors ?? {};
    this.prefix = options.prefix ?? "";
    this.strict = options.strict ?? false;
  }

  addError(field: string, message: string): undefined {
    (this.errors[this.prefix + field] ??= []).push(message);
    return undefined;
  }

  /** Marks keys as known so a strict reader does not report them (e.g. an `id` checked elsewhere). */
  allow(...fields: string[]): void {
    for (const field of fields) this.seen.add(field);
  }

  private raw(field: string): unknown {
    this.seen.add(field);
    const v = this.data[field];
    return v === undefined || v === null ? undefined : v;
  }

  string(field: string, opts: StringOptions & { optional: true }): string | undefined;
  string(field: string, opts: StringOptions & { optional?: false }): string;
  string(field: string, opts: StringOptions & { optional?: boolean }): string | undefined {
    const v = this.raw(field);
    if (v === undefined) {
      if (!opts.optional) this.addError(field, `${field} wajib diisi.`);
      return undefined;
    }
    if (typeof v !== "string") return this.addError(field, `${field} harus berupa teks.`);
    if (v.length > opts.max) return this.addError(field, `${field} maksimal ${opts.max} karakter.`);
    if (v.length < (opts.min ?? 0)) return this.addError(field, `${field} minimal ${opts.min} karakter.`);
    let value = opts.normalize ? opts.normalize(v) : v;
    if (opts.nonBlank) {
      value = value.trim();
      if (value === "") return this.addError(field, `${field} wajib diisi.`);
    }
    if (opts.pattern && !opts.pattern.test(value)) {
      return this.addError(field, opts.patternMessage ?? `${field} tidak valid.`);
    }
    return value;
  }

  integer(field: string, opts: { min?: number; max?: number; optional: true }): number | undefined;
  integer(field: string, opts?: { min?: number; max?: number; optional?: false }): number;
  integer(field: string, opts: { min?: number; max?: number; optional?: boolean } = {}): number | undefined {
    const v = this.raw(field);
    if (v === undefined) {
      if (!opts.optional) this.addError(field, `${field} wajib diisi.`);
      return undefined;
    }
    if (typeof v !== "number" || !Number.isSafeInteger(v)) return this.addError(field, `${field} harus berupa bilangan bulat.`);
    if (opts.min !== undefined && v < opts.min) return this.addError(field, `${field} minimal ${opts.min}.`);
    if (opts.max !== undefined && v > opts.max) return this.addError(field, `${field} maksimal ${opts.max}.`);
    return v;
  }

  /** A finite number that need not be an integer (rates). */
  number(field: string, opts: { min?: number; max?: number }): number {
    const v = this.raw(field);
    if (v === undefined) {
      this.addError(field, `${field} wajib diisi.`);
      return 0;
    }
    if (typeof v !== "number" || !Number.isFinite(v)) {
      this.addError(field, `${field} harus berupa angka.`);
      return 0;
    }
    if (opts.min !== undefined && v < opts.min) {
      this.addError(field, `${field} minimal ${opts.min}.`);
      return 0;
    }
    if (opts.max !== undefined && v > opts.max) {
      this.addError(field, `${field} maksimal ${opts.max}.`);
      return 0;
    }
    return v;
  }

  oneOf<T extends string>(field: string, allowed: readonly T[], opts: { optional: true }): T | undefined;
  oneOf<T extends string>(field: string, allowed: readonly T[], opts?: { optional?: false }): T;
  oneOf<T extends string>(field: string, allowed: readonly T[], opts: { optional?: boolean } = {}): T | undefined {
    const v = this.raw(field);
    if (v === undefined) {
      if (!opts.optional) this.addError(field, `${field} wajib diisi.`);
      return undefined;
    }
    if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
      return this.addError(field, `${field} harus salah satu dari: ${allowed.join(", ")}.`);
    }
    return v as T;
  }

  boolean(field: string, opts: { optional: true }): boolean | undefined;
  boolean(field: string): boolean;
  boolean(field: string, opts: { optional?: boolean } = {}): boolean | undefined {
    const v = this.raw(field);
    if (v === undefined) {
      if (!opts.optional) this.addError(field, `${field} wajib diisi.`);
      return undefined;
    }
    if (typeof v !== "boolean") return this.addError(field, `${field} harus berupa boolean.`);
    return v;
  }

  /** Accepts an ISO date string or epoch milliseconds; returns epoch ms. */
  timestamp(field: string, opts: { optional: true }): number | undefined;
  timestamp(field: string): number;
  timestamp(field: string, opts: { optional?: boolean } = {}): number | undefined {
    const v = this.raw(field);
    if (v === undefined) {
      if (!opts.optional) this.addError(field, `${field} wajib diisi.`);
      return undefined;
    }
    const ms = typeof v === "number" ? v : typeof v === "string" ? Date.parse(v) : Number.NaN;
    if (!Number.isFinite(ms) || ms < 0) return this.addError(field, `${field} bukan tanggal yang valid.`);
    return Math.trunc(ms);
  }

  /** A JSON object value (not an array); null/absent counts as absent. */
  object(field: string): Record<string, unknown> | undefined {
    const v = this.raw(field);
    if (v === undefined) return undefined;
    if (typeof v !== "object" || Array.isArray(v)) return this.addError(field, `${field} harus berupa objek.`);
    return v as Record<string, unknown>;
  }

  array(field: string, opts: { min: number; max: number }): Record<string, unknown>[] {
    const v = this.raw(field);
    if (v === undefined) {
      this.addError(field, `${field} wajib diisi.`);
      return [];
    }
    if (!Array.isArray(v)) {
      this.addError(field, `${field} harus berupa array.`);
      return [];
    }
    if (v.length < opts.min || v.length > opts.max) {
      this.addError(field, `${field} harus berisi ${opts.min}-${opts.max} item.`);
      return [];
    }
    const out: Record<string, unknown>[] = [];
    v.forEach((entry, i) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        this.addError(`${field}.${i}`, `${field}.${i} harus berupa objek.`);
      } else {
        out.push(entry as Record<string, unknown>);
      }
    });
    return out;
  }

  /** Reader for a nested object that reports errors under `parent.index.` */
  child(entry: Record<string, unknown>, path: string): Reader {
    return new Reader(entry, { prefix: `${this.prefix}${path}.`, errors: this.errors });
  }

  done(): void {
    if (this.strict) {
      for (const key of Object.keys(this.data)) {
        if (!this.seen.has(key)) this.addError(key, `${key} tidak diizinkan.`);
      }
    }
    if (Object.keys(this.errors).length > 0) {
      throw new HttpError(422, "Data yang dikirim tidak valid.", this.errors);
    }
  }
}
