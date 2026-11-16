export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Signs session cookies. Required; set with `wrangler secret put SESSION_SECRET`. */
  SESSION_SECRET?: string;
  /** Gates the one-time admin bootstrap. Optional; delete it after setup. */
  BOOTSTRAP_SECRET?: string;
  /** Midtrans server key. Unset = QRIS self-payment disabled (customers pay at the cashier). */
  MIDTRANS_SERVER_KEY?: string;
  /** "true" for the Midtrans production API; anything else uses the sandbox. */
  MIDTRANS_IS_PRODUCTION?: string;
  /** Optional Midtrans API base URL override (e.g. a local mock during development). */
  MIDTRANS_API_BASE?: string;
}

export type StaffRole = "admin" | "kasir" | "pelayan" | "dapur" | "manajer";

export const STAFF_ROLES: readonly StaffRole[] = ["admin", "kasir", "pelayan", "dapur", "manajer"];

export interface SessionStaff {
  id: string;
  username: string;
  name: string;
  role: StaffRole;
  title: string;
  description: string;
  avatarColor: string;
  initials: string;
  active: boolean;
}
