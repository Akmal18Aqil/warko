/** Tax / service-charge settings applied to every order. Rates are percentages (0-100). */
export type PricingSettings = {
  taxEnabled: boolean;
  taxRate: number;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
};

export const DEFAULT_PRICING: Readonly<PricingSettings> = {
  taxEnabled: true,
  taxRate: 11,
  serviceChargeEnabled: false,
  serviceChargeRate: 5,
};

export const MAX_RATE = 100;

export type DiscountType = "percent" | "fixed";

/** Whole-rupiah discount for `rawSubtotal`, never more than the subtotal itself. */
export function discountAmount(rawSubtotal: number, type: DiscountType, value: number): number {
  if (value <= 0) return 0;
  if (type === "percent") return Math.round((rawSubtotal * Math.min(MAX_RATE, value)) / 100);
  return Math.min(rawSubtotal, value);
}

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

/** Rejection message when the total the customer confirmed differs from the total computed now. */
export const EXPECTED_TOTAL_MISMATCH_MESSAGE =
  "Total pesanan berubah karena harga atau pengaturan pajak/layanan diperbarui. Periksa total terbaru lalu coba lagi.";
