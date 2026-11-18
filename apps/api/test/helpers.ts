import { env } from "cloudflare:workers";
import type { StaffRole } from "@wakro/shared";
import { createSession } from "../src/auth";
import { hashPassword } from "../src/crypto";
import worker from "../src/index";

export const ORIGIN = "https://pos.test";

type RequestOptions = {
  method?: string;
  body?: unknown;
  /** Cookie header value returned by `signIn`. */
  session?: string;
  headers?: Record<string, string>;
};

export function api(path: string, options: RequestOptions = {}): Promise<Response> {
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.session) headers.set("Cookie", options.session);
  if (method !== "GET" && !headers.has("Origin")) headers.set("Origin", ORIGIN);
  return worker.fetch(
    new Request(`${ORIGIN}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    env,
  );
}

// biome-ignore lint/suspicious/noExplicitAny: test helper; callers read arbitrary response bodies without declaring a shape.
export async function readJson<T = any>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

const TABLES_IN_DELETE_ORDER = [
  "payment_charges",
  "stock_movements",
  "order_items",
  "orders",
  "cash_movements",
  "shifts",
  "sessions",
  "devices",
  "audit_log",
  "staff",
  "auth_throttle",
  "app_state",
  "settings",
  "products",
  "categories",
  "restaurant_tables",
];

/** Empties every table; the schema (and migration bookkeeping) stays. */
export async function resetDb(): Promise<void> {
  await env.DB.batch(TABLES_IN_DELETE_ORDER.map((table) => env.DB.prepare(`DELETE FROM ${table}`)));
}

let staffCounter = 0;

/**
 * Inserts a staff member and returns a ready-to-send session cookie plus the staff id.
 * `password` gives the account a real password hash (needed to pass password confirmation).
 */
export async function signIn(
  role: StaffRole,
  name = `Staf ${role}`,
  password?: string,
): Promise<{ session: string; id: string; name: string; username: string }> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const username = `${role}${++staffCounter}`;
  await env.DB.prepare(
    `INSERT INTO staff (id, username, name, role, title, description, avatar_color, initials, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, '', '', '', '', ?, ?, ?)`,
  )
    .bind(id, username, name, role, password === undefined ? "unused" : await hashPassword(password), now, now)
    .run();
  const setCookie = await createSession(env, id, new URL(ORIGIN));
  return { session: setCookie.split(";")[0], id, name, username };
}

/** The `name=value` pair of a response's Set-Cookie header, ready for a Cookie request header. */
export function cookiePair(response: Response): string {
  const header = response.headers.get("Set-Cookie");
  if (!header) throw new Error("response has no Set-Cookie header");
  return header.split(";")[0];
}

export async function seedCategory(id = "cat-1", name = "Makanan Utama"): Promise<string> {
  await env.DB.prepare("INSERT INTO categories (id, name, kind, sort_order, created_at) VALUES (?, ?, 'Makanan', 1, ?)")
    .bind(id, name, Date.now())
    .run();
  return id;
}

/** Inserts an active product; `stock: null` means untracked. */
export async function seedProduct(
  barcode: string,
  options: { price?: number; stock?: number | null; name?: string; categoryId?: string } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO products (id, barcode, name, price, category_id, kind, stock, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'Makanan', ?, ?, ?)`,
  )
    .bind(
      id,
      barcode,
      options.name ?? `Menu ${barcode}`,
      options.price ?? 10_000,
      options.categoryId ?? "cat-1",
      options.stock ?? null,
      now,
      now,
    )
    .run();
  return id;
}

export async function seedTable(id = "table-1", name = "Meja 1"): Promise<string> {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO restaurant_tables (id, name, seats, area, active, created_at, updated_at) VALUES (?, ?, 4, 'Indoor', 1, ?, ?)",
  )
    .bind(id, name, now, now)
    .run();
  return id;
}

export function setSetting(key: string, value: string): Promise<unknown> {
  return env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)").bind(key, value, Date.now()).run();
}

export function randomRef(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function sha512Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}
