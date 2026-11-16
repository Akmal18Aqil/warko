import { describe, expect, it } from "vitest";
import { calculateCharges, discountAmount, type PricingSettings } from "./pricing";

const pricing: PricingSettings = { taxEnabled: true, taxRate: 11, serviceChargeEnabled: true, serviceChargeRate: 5 };

describe("calculateCharges", () => {
  it("taxes the subtotal plus service charge", () => {
    expect(calculateCharges(100_000, pricing)).toEqual({ serviceCharge: 5_000, tax: 11_550, total: 116_550 });
  });

  it("skips disabled charges", () => {
    expect(calculateCharges(100_000, { ...pricing, taxEnabled: false, serviceChargeEnabled: false })).toEqual({
      serviceCharge: 0,
      tax: 0,
      total: 100_000,
    });
  });

  it("rounds each charge to whole rupiah", () => {
    expect(calculateCharges(12_345, pricing)).toEqual({ serviceCharge: 617, tax: 1_426, total: 14_388 });
  });
});

describe("discountAmount", () => {
  it("caps percent discounts at 100%", () => {
    expect(discountAmount(50_000, "percent", 150)).toBe(50_000);
  });

  it("caps fixed discounts at the subtotal", () => {
    expect(discountAmount(50_000, "fixed", 80_000)).toBe(50_000);
  });

  it("ignores non-positive values", () => {
    expect(discountAmount(50_000, "fixed", 0)).toBe(0);
  });
});
