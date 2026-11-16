import type { MenuItem } from "../data/menu";
import type { CartLine } from "../types/domain";

/** Pure cart-line operations shared by the POS cart and the waiter / self-order carts. */

export function addLine(lines: readonly CartLine[], itemId: string): CartLine[] {
  const index = lines.findIndex((l) => l.itemId === itemId);
  if (index < 0) return [...lines, { itemId, qty: 1 }];
  return lines.map((l, i) => (i === index ? { ...l, qty: l.qty + 1 } : l));
}

export function increaseLine(lines: readonly CartLine[], itemId: string): CartLine[] {
  return lines.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + 1 } : l));
}

export function decreaseLine(lines: readonly CartLine[], itemId: string): CartLine[] {
  return lines.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty - 1 } : l)).filter((l) => l.qty > 0);
}

export function setLineNote(lines: readonly CartLine[], itemId: string, note: string): CartLine[] {
  return lines.map((l) => (l.itemId === itemId ? { ...l, note } : l));
}

export function removeLine(lines: readonly CartLine[], itemId: string): CartLine[] {
  return lines.filter((l) => l.itemId !== itemId);
}

/** Why one more portion of `itemId` cannot be added, or null when it fits the ready stock. */
export function stockLimitMessage(lines: readonly CartLine[], products: readonly MenuItem[], itemId: string): string | null {
  const product = products.find((p) => p.id === itemId);
  if (!product || product.stock === undefined || product.stock === null) return null;
  const inCart = lines.find((l) => l.itemId === itemId)?.qty ?? 0;
  if (inCart < product.stock) return null;
  return product.stock <= 0 ? `${product.name} HABIS` : `Stok ${product.name} tinggal ${product.stock}`;
}
