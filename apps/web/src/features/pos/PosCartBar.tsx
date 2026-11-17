import { ShoppingBag } from "lucide-react";
import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";
import { useCart } from "../../state/cart";

/**
 * Phone/tablet summary of the current order, pinned above the bottom navigation. Opens the cart sheet,
 * so the cashier never has to scroll past the catalog to reach the order and the pay button.
 */
export function PosCartBar({ onOpen }: { onOpen: () => void }) {
  const { lines, totals, orderType, selectedTable } = useCart();
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const destination = orderType === "bawa-pulang" ? t.pos.cart.takeaway : (selectedTable?.name ?? t.pos.cart.chooseTable);
  const total = formatIDR(totals.total);

  return (
    <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mt-auto px-3 pb-3 md:bottom-0 md:px-10 md:pb-[calc(1rem+env(safe-area-inset-bottom))] print:hidden">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${t.pos.cartBar.items(count)} · ${destination} · ${total}. ${t.pos.cartBar.open}`}
        className="pressable mx-auto flex min-h-14 w-full max-w-xl items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-2.5 text-white shadow-xl ring-2 ring-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl bg-accent px-2 text-sm font-bold">{count}</span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-xs text-white/70">{destination}</span>
            <span className="block font-display text-base font-bold">{total}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-sm font-bold">
          {t.pos.cartBar.open}
          <ShoppingBag size={18} aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}
