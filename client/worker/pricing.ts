import type { Env } from "./env";
import { HttpError, Reader } from "./http";

/**
 * Tax / service-charge settings. Stored as four rows in the D1 `settings` key/value table and used
 * by every order endpoint, so staff and public orders are always priced by the same rules.
 */
export type PricingSettings = {
  taxEnabled: boolean;
  taxRate: number;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
};

export type PricingRow = { key: string; value: string };

/** Applied per key only while that key is absent from `settings`; matches the app's historical behaviour. */
const DEFAULT_PRICING: Readonly<PricingSettings> = {
  taxEnabled: true,
  taxRate: 11,
  serviceChargeEnabled: false,
  serviceChargeRate: 5,
};

const KEY = {
  taxEnabled: "pricing.tax_enabled",
  taxRate: "pricing.tax_rate",
  serviceChargeEnabled: "pricing.service_charge_enabled",
  serviceChargeRate: "pricing.service_charge_rate",
} as const;

const MAX_RATE = 100;
/** Plain decimal as written by `String(number)`; also accepts a short exponent for tiny rates. */
const STORED_RATE = /^\d+(?:\.\d+)?(?:e-\d+)?$/i;

// ---- reading -------------------------------------------------------------

/** Statement for use inside a D1 batch (same snapshot as the other statements); parse with `parsePricing`. */
export function pricingStatement(env: Env): D1PreparedStatement {
  return env.DB.prepare("SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?)").bind(
    KEY.taxEnabled,
    KEY.taxRate,
    KEY.serviceChargeEnabled,
    KEY.serviceChargeRate,
  );
}

// A stored value that cannot be understood must stop pricing (500, logged by the worker entry point),
// never fall back to a guess: charging a customer on a wrong rate is worse than refusing the order.

function readFlag(stored: Map<string, string>, key: string, fallback: boolean): boolean {
  const raw = stored.get(key);
  if (raw === undefined) return fallback;
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  throw new Error(`Pengaturan harga "${key}" di database tidak valid.`);
}

function readRate(stored: Map<string, string>, key: string, fallback: number): number {
  const raw = stored.get(key);
  if (raw === undefined) return fallback;
  const value = STORED_RATE.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value) || value > MAX_RATE) throw new Error(`Pengaturan harga "${key}" di database tidak valid.`);
  return value;
}

export function parsePricing(rows: readonly PricingRow[]): PricingSettings {
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  return {
    taxEnabled: readFlag(stored, KEY.taxEnabled, DEFAULT_PRICING.taxEnabled),
    taxRate: readRate(stored, KEY.taxRate, DEFAULT_PRICING.taxRate),
    serviceChargeEnabled: readFlag(stored, KEY.serviceChargeEnabled, DEFAULT_PRICING.serviceChargeEnabled),
    serviceChargeRate: readRate(stored, KEY.serviceChargeRate, DEFAULT_PRICING.serviceChargeRate),
  };
}

export async function loadPricing(env: Env): Promise<PricingSettings> {
  const { results } = await pricingStatement(env).all<PricingRow>();
  return parsePricing(results);
}

// ---- writing -------------------------------------------------------------

function readRateInput(body: Record<string, unknown>, field: string, errors: Record<string, string[]>): number {
  const value = body[field];
  if (value === undefined || value === null) {
    errors[field] = [`${field} wajib diisi.`];
  } else if (typeof value !== "number" || !Number.isFinite(value)) {
    errors[field] = [`${field} harus berupa angka.`];
  } else if (value < 0) {
    errors[field] = [`${field} minimal 0.`];
  } else if (value > MAX_RATE) {
    errors[field] = [`${field} maksimal ${MAX_RATE}.`];
  } else {
    return value;
  }
  return 0;
}

/** Validates a PUT /api/pricing body; throws 422 with per-field errors. */
export function parsePricingInput(body: Record<string, unknown>): PricingSettings {
  const errors: Record<string, string[]> = {};
  const r = new Reader(body);
  const taxEnabled = r.boolean("taxEnabled");
  const serviceChargeEnabled = r.boolean("serviceChargeEnabled");
  const taxRate = readRateInput(body, "taxRate", errors);
  const serviceChargeRate = readRateInput(body, "serviceChargeRate", errors);
  try {
    r.done();
  } catch (error) {
    if (!(error instanceof HttpError) || !error.errors) throw error;
    Object.assign(errors, error.errors);
  }
  if (Object.keys(errors).length > 0) throw new HttpError(422, "Data yang dikirim tidak valid.", errors);
  // `+ 0` folds -0 into 0 so it is stored as "0".
  return { taxEnabled, taxRate: taxRate + 0, serviceChargeEnabled, serviceChargeRate: serviceChargeRate + 0 };
}

/**
 * Replaces all four settings in one D1 batch (a single transaction): a concurrent reader sees either
 * the old set or the new set, never a mix. Returns the values as committed by that transaction.
 */
export async function savePricing(env: Env, pricing: PricingSettings): Promise<PricingSettings> {
  const now = Date.now();
  const upsert = (key: string, value: string) =>
    env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).bind(key, value, now);

  const results = await env.DB.batch<PricingRow>([
    upsert(KEY.taxEnabled, pricing.taxEnabled ? "1" : "0"),
    upsert(KEY.taxRate, String(pricing.taxRate)),
    upsert(KEY.serviceChargeEnabled, pricing.serviceChargeEnabled ? "1" : "0"),
    upsert(KEY.serviceChargeRate, String(pricing.serviceChargeRate)),
    pricingStatement(env),
  ]);
  return parsePricing(results[results.length - 1].results);
}

// ---- order amounts -------------------------------------------------------

export type OrderCharges = { serviceCharge: number; tax: number; total: number };

/**
 * The single pricing rule for staff and public orders. `subtotal` is the whole-rupiah amount after
 * any discount. Service charge applies to the subtotal; tax applies to subtotal + service charge.
 */
export function calculateCharges(subtotal: number, pricing: PricingSettings): OrderCharges {
  const serviceCharge = pricing.serviceChargeEnabled ? Math.round((subtotal * pricing.serviceChargeRate) / 100) : 0;
  const tax = pricing.taxEnabled ? Math.round(((subtotal + serviceCharge) * pricing.taxRate) / 100) : 0;
  return { serviceCharge, tax, total: subtotal + serviceCharge + tax };
}

/**
 * The server is authoritative: an order is only stored when the total the customer/cashier saw
 * (`expectedTotal`) equals the total computed now from current prices and pricing settings.
 */
export function assertExpectedTotal(expectedTotal: number, total: number): void {
  if (expectedTotal !== total) {
    throw new HttpError(409, "Total pesanan berubah karena harga atau pengaturan pajak/layanan diperbarui. Periksa total terbaru lalu coba lagi.", {
      expectedTotal: ["expectedTotal tidak sama dengan total terbaru dari server."],
    });
  }
}
