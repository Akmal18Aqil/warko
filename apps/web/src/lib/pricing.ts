import { calculateCharges, discountAmount, type PricingSettings } from "@wakro/shared";
import type { MenuItem } from "../data/menu";
import type { CartDiscount, CartLine, OrderTotals } from "../types/domain";

export const NO_DISCOUNT: CartDiscount = { type: "percent", value: 0 };

/**
 * Totals for a cart: the single place the web app prices an order. Discount and charges come from
 * `@wakro/shared`, the same functions the API uses to verify `expectedTotal`. Lines whose product is
 * unknown (removed while in the cart) are ignored.
 */
export function computeTotals(
  lines: readonly CartLine[],
  products: readonly MenuItem[],
  discount: CartDiscount,
  pricing: PricingSettings,
): OrderTotals {
  const priceById = new Map<string, number>();
  for (const product of products) priceById.set(product.id, product.price);

  let rawSubtotal = 0;
  let count = 0;
  for (const line of lines) {
    const price = priceById.get(line.itemId);
    if (price === undefined) continue;
    rawSubtotal += price * line.qty;
    count += line.qty;
  }

  const discounted = discountAmount(rawSubtotal, discount.type, discount.value);
  const subtotal = Math.max(0, rawSubtotal - discounted);
  const { serviceCharge, tax, total } = calculateCharges(subtotal, pricing);
  return { rawSubtotal, discountAmount: discounted, subtotal, tax, serviceCharge, total, count };
}
