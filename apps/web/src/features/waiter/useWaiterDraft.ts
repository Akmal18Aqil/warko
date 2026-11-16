import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCartLines } from "../../hooks/useCartLines";
import { t } from "../../locales/id";
import { waiterCartKey, waiterTableKey } from "../../lib/storageKeys";
import { useAuth } from "../../state/auth";
import { useProducts, useTables } from "../../state/catalog";
import { usePricing } from "../../state/pricing";
import type { CartLine } from "../../types/domain";
import { DEFAULT_GUESTS } from "./constants";

/** Per-waiter draft cart persisted in localStorage; anything malformed is ignored. */
function readDraftLines(key: string): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        typeof l === "object" && l !== null && typeof l.itemId === "string" && typeof l.qty === "number" && l.qty > 0,
    );
  } catch {
    return [];
  }
}

/**
 * The order being typed by the signed-in waiter: cart lines and selected table survive reloads
 * and are stored per staff id, so switching waiter never shows (or saves into) someone else's draft.
 */
export function useWaiterDraft() {
  const { currentStaff } = useAuth();
  const products = useProducts();
  const tables = useTables();
  const pricing = usePricing();

  const cartKey = waiterCartKey(currentStaff.id);
  const tableKey = waiterTableKey(currentStaff.id);

  const cart = useCartLines({ products, pricing, initialLines: () => readDraftLines(cartKey) });
  const [selectedTableId, setSelectedTableId] = useState<string>(
    () => localStorage.getItem(tableKey) || tables[0]?.id || "",
  );
  const [customerName, setCustomerName] = useState("");
  const [guests, setGuests] = useState(DEFAULT_GUESTS);

  /** Whose draft `cart.lines` currently holds: stops one waiter's lines being saved under the next waiter's key. */
  const draftOwnerRef = useRef(cartKey);

  useEffect(() => {
    if (draftOwnerRef.current !== cartKey) return;
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart.lines));
    } catch (e) {
      console.error("Failed to save waiter draft cart", e);
    }
  }, [cart.lines, cartKey]);

  const { setLines } = cart;
  useEffect(() => {
    draftOwnerRef.current = cartKey;
    setLines(readDraftLines(cartKey));
    const savedTable = localStorage.getItem(tableKey);
    if (savedTable) setSelectedTableId(savedTable);
  }, [cartKey, tableKey, setLines]);

  useEffect(() => {
    localStorage.setItem(tableKey, selectedTableId);
  }, [selectedTableId, tableKey]);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) ?? tables[0],
    [selectedTableId, tables],
  );

  const clearCart = () => {
    cart.clear();
    localStorage.removeItem(cartKey);
  };

  return {
    cart,
    selectedTable,
    setSelectedTableId,
    customerName,
    setCustomerName,
    guests,
    setGuests,
    /** Empties the cart on the waiter's request. */
    discardCart: () => {
      clearCart();
      toast.info(t.waiter.cartCleared);
    },
    /** Empties the cart and customer name once the order has been stored. */
    finishOrder: () => {
      clearCart();
      setCustomerName("");
    },
  };
}

export type WaiterDraft = ReturnType<typeof useWaiterDraft>;
