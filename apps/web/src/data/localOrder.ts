import { calculateCharges, MAX_MONEY, MAX_ORDER_LINES, MAX_ORDER_QTY, type PricingSettings } from "@wakro/shared";
import type { OrderItemLine, OrderRow } from "../types/domain";
import type { MenuItem } from "./menu";

/** What the server computes for an order from the database, ignoring every figure the client sent. */
export type PricedOrder = {
  items: OrderItemLine[];
  itemCount: number;
  discount: number;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  total: number;
};

/**
 * Re-prices an order line by line from the stored menu and pricing, like the API's `placeOrder`.
 * Throws the API's messages for invalid lines; the caller compares `total` with what the client expected.
 */
export function priceOrder(row: OrderRow, productsById: ReadonlyMap<string, MenuItem>, pricing: PricingSettings): PricedOrder {
  const lines = row.items ?? [];
  if (lines.length < 1 || lines.length > MAX_ORDER_LINES) throw new Error(`Pesanan harus berisi 1-${MAX_ORDER_LINES} baris menu.`);

  let rawSubtotal = 0;
  let itemCount = 0;
  const items = lines.map((line, i): OrderItemLine => {
    if (!Number.isSafeInteger(line.qty) || line.qty < 1 || line.qty > MAX_ORDER_QTY) {
      throw new Error(`Jumlah pada baris ${i + 1} harus bilangan bulat 1-${MAX_ORDER_QTY}.`);
    }
    const product = productsById.get(line.itemId);
    if (!product) throw new Error(`Menu pada baris ${i + 1} tidak ditemukan atau tidak tersedia.`);
    rawSubtotal += product.price * line.qty;
    itemCount += line.qty;
    const note = line.note?.trim();
    return { itemId: product.id, name: product.name, qty: line.qty, price: product.price, note: note ? note : undefined };
  });

  const requested = row.discount ?? 0;
  if (!Number.isSafeInteger(requested) || requested < 0) throw new Error("Diskon harus bilangan bulat 0 atau lebih.");
  const discount = Math.min(rawSubtotal, requested);
  const subtotal = rawSubtotal - discount;
  const charges = calculateCharges(subtotal, pricing);
  if (charges.total > MAX_MONEY) throw new Error("Total pesanan terlalu besar.");
  return { items, itemCount, discount, subtotal, ...charges };
}
