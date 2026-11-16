import { useMemo } from "react";
import { useProducts } from "../../state/catalog";

/** Number of products per category name. */
export function useProductCounts(): ReadonlyMap<string, number> {
  const products = useProducts();
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    return counts;
  }, [products]);
}
