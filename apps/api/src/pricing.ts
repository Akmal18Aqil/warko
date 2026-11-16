import { DEFAULT_PRICING, EXPECTED_TOTAL_MISMATCH_MESSAGE, MAX_RATE, type PricingSettings } from "@wakro/shared";
import type { Env } from "./env";
import { HttpError, Reader } from "./http";

/**
 * Tax / service-charge settings are stored as four rows in the D1 `settings` key/value table and used
 * by every order endpoint, so staff and public orders are always priced by the same rules.
 * `DEFAULT_PRICING` applies per key only while that key is absent from `settings`.
 */
export type PricingRow = { key: string; value: string };

const KEY = {
  taxEnabled: "pricing.tax_enabled",
  taxRate: "pricing.tax_rate",
  serviceChargeEnabled: "pricing.service_charge_enabled",
  serviceChargeRate: "pricing.service_charge_rate",
} as const;

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

/** Validates a PUT /api/pricing body; throws 422 with per-field errors. */
export function parsePricingInput(body: Record<string, unknown>): PricingSettings {
  const r = new Reader(body);
  const taxEnabled = r.boolean("taxEnabled");
  const taxRate = r.number("taxRate", { min: 0, max: MAX_RATE });
  const serviceChargeEnabled = r.boolean("serviceChargeEnabled");
  const serviceChargeRate = r.number("serviceChargeRate", { min: 0, max: MAX_RATE });
  r.done();
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

/**
 * The server is authoritative: an order is only stored when the total the customer/cashier saw
 * (`expectedTotal`) equals the total computed now from current prices and pricing settings.
 */
export function assertExpectedTotal(expectedTotal: number, total: number): void {
  if (expectedTotal !== total) {
    throw new HttpError(409, EXPECTED_TOTAL_MISMATCH_MESSAGE, {
      expectedTotal: ["expectedTotal tidak sama dengan total terbaru dari server."],
    });
  }
}
