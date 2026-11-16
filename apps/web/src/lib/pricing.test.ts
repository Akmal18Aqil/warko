import { calculateCharges, DEFAULT_PRICING } from "@wakro/shared";
import { describe, expect, it } from "vitest";
import type { MenuItem } from "../data/menu";
import { computeTotals, NO_DISCOUNT } from "./pricing";

const product = (id: string, price: number): MenuItem => ({
  id,
  barcode: id,
  name: id,
  description: "",
  price,
  category: "Makanan",
  image: "",
  kind: "Makanan",
  prepMinutes: 5,
});

const products = [product("nasi", 20_000), product("teh", 5_000)];
const noCharges = { ...DEFAULT_PRICING, taxEnabled: false, serviceChargeEnabled: false };

describe("computeTotals", () => {
  it("sums lines and counts portions", () => {
    const totals = computeTotals(
      [
        { itemId: "nasi", qty: 2 },
        { itemId: "teh", qty: 3 },
      ],
      products,
      NO_DISCOUNT,
      noCharges,
    );
    expect(totals).toMatchObject({ rawSubtotal: 55_000, discountAmount: 0, subtotal: 55_000, total: 55_000, count: 5 });
  });

  it("ignores lines whose product no longer exists", () => {
    const totals = computeTotals(
      [
        { itemId: "hilang", qty: 4 },
        { itemId: "teh", qty: 1 },
      ],
      products,
      NO_DISCOUNT,
      noCharges,
    );
    expect(totals).toMatchObject({ rawSubtotal: 5_000, count: 1 });
  });

  it("applies a percent discount before charges, matching the shared rule", () => {
    const pricing = { ...DEFAULT_PRICING, taxEnabled: true, taxRate: 11, serviceChargeEnabled: true, serviceChargeRate: 5 };
    const totals = computeTotals([{ itemId: "nasi", qty: 5 }], products, { type: "percent", value: 10 }, pricing);
    expect(totals.rawSubtotal).toBe(100_000);
    expect(totals.discountAmount).toBe(10_000);
    expect(totals.subtotal).toBe(90_000);
    expect({ serviceCharge: totals.serviceCharge, tax: totals.tax, total: totals.total }).toEqual(calculateCharges(90_000, pricing));
  });

  it("caps a fixed discount at the subtotal", () => {
    const totals = computeTotals([{ itemId: "teh", qty: 2 }], products, { type: "fixed", value: 50_000 }, noCharges);
    expect(totals).toMatchObject({ discountAmount: 10_000, subtotal: 0, total: 0 });
  });

  it("treats a percent discount above 100 as 100", () => {
    const totals = computeTotals([{ itemId: "teh", qty: 2 }], products, { type: "percent", value: 250 }, noCharges);
    expect(totals.discountAmount).toBe(10_000);
  });

  it("returns zeros for an empty cart", () => {
    expect(computeTotals([], products, NO_DISCOUNT, DEFAULT_PRICING)).toMatchObject({ rawSubtotal: 0, total: 0, count: 0 });
  });
});
