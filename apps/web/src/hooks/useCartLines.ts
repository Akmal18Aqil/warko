import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { MenuItem } from "../data/menu";
import {
  addLine,
  decreaseLine,
  increaseLine,
  removeLine,
  setLineNote,
  stockLimitMessage,
} from "../lib/cart";
import { computeTotals, NO_DISCOUNT } from "../lib/pricing";
import type { PricingSettings } from "@wakro/shared";
import type { CartLine } from "../types/domain";

type Options = {
  products: readonly MenuItem[];
  pricing: PricingSettings;
  /** Refuse to add more portions than the ready stock and tell the user why (default true). */
  stockGuard?: boolean;
  initialLines?: CartLine[] | (() => CartLine[]);
};

/**
 * Local cart used by the waiter and self-order screens (the cashier cart lives in the cart store).
 * Totals use the same pricing rule as the cashier and the API.
 */
export function useCartLines({ products, pricing, stockGuard = true, initialLines }: Options) {
  const [lines, setLinesState] = useState<CartLine[]>(initialLines ?? []);
  const linesRef = useRef(lines);

  const setLines = useCallback((next: CartLine[]) => {
    linesRef.current = next;
    setLinesState(next);
  }, []);

  const productsRef = useRef(products);
  productsRef.current = products;

  const blocked = useCallback(
    (itemId: string): boolean => {
      if (!stockGuard) return false;
      const message = stockLimitMessage(linesRef.current, productsRef.current, itemId);
      if (message === null) return false;
      toast.error(message);
      return true;
    },
    [stockGuard],
  );

  const add = useCallback(
    (itemId: string) => {
      if (blocked(itemId)) return;
      setLines(addLine(linesRef.current, itemId));
    },
    [blocked, setLines],
  );

  const increase = useCallback(
    (itemId: string) => {
      if (blocked(itemId)) return;
      setLines(increaseLine(linesRef.current, itemId));
    },
    [blocked, setLines],
  );

  const decrease = useCallback((itemId: string) => setLines(decreaseLine(linesRef.current, itemId)), [setLines]);
  const setNote = useCallback(
    (itemId: string, note: string) => setLines(setLineNote(linesRef.current, itemId, note)),
    [setLines],
  );
  const remove = useCallback((itemId: string) => setLines(removeLine(linesRef.current, itemId)), [setLines]);
  const clear = useCallback(() => setLines([]), [setLines]);

  const totals = useMemo(() => computeTotals(lines, products, NO_DISCOUNT, pricing), [lines, products, pricing]);

  return { lines, totals, setLines, add, increase, decrease, setNote, remove, clear };
}
