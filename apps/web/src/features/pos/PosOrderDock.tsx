import { Armchair, ChevronUp, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { formatIDR } from "../../data/menu";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import { useCart } from "../../state/cart";
import { OrderTypeSheet } from "./OrderTypeSheet";

/**
 * Phone/tablet dock pinned above the bottom navigation: the order type / table on the left (one tap
 * to change, before or after adding items) and the cart summary on the right, which opens the cart
 * sheet so the cashier never scrolls past the catalog to pay.
 */
export function PosOrderDock({ onOpenCart }: { onOpenCart: () => void }) {
  const { lines, totals, orderType, selectedTable } = useCart();
  const [typeOpen, setTypeOpen] = useState(false);
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const takeaway = orderType === "bawa-pulang";
  const needsTable = !takeaway && !selectedTable;
  const destination = takeaway ? t.pos.cart.takeaway : (selectedTable?.name ?? t.pos.cart.chooseTable);
  const DestinationIcon = takeaway ? ShoppingBag : Armchair;
  const total = formatIDR(totals.total);

  return (
    <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mt-auto px-3 pb-3 md:bottom-0 md:px-10 md:pb-[calc(1rem+env(safe-area-inset-bottom))] print:hidden">
      <div className="mx-auto flex max-w-xl items-stretch gap-2">
        <button
          type="button"
          onClick={() => setTypeOpen(true)}
          aria-haspopup="dialog"
          aria-label={t.pos.cartBar.changeType(destination)}
          className={cn(
            "pressable flex min-h-14 shrink-0 items-center gap-2 rounded-2xl border px-3 text-left shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            needsTable ? "border-warning bg-warning/20 text-warning-dark" : "border-border bg-surface text-ink",
          )}
        >
          <DestinationIcon size={18} aria-hidden="true" className={needsTable ? undefined : "text-accent-dark"} />
          <span className="min-w-0">
            <span className="block text-2xs font-semibold text-text-muted">{t.pos.cart.orderTypeLabel}</span>
            <span className="block max-w-28 truncate text-sm font-bold">{destination}</span>
          </span>
          <ChevronUp size={16} aria-hidden="true" className="text-text-muted" />
        </button>

        {count > 0 ? (
          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`${t.pos.cartBar.items(count)} · ${destination} · ${total}. ${t.pos.cartBar.open}`}
            className="pressable flex min-h-14 min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl bg-ink px-3 py-2 text-white shadow-xl ring-2 ring-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl bg-accent px-2 text-sm font-bold">
                {count}
              </span>
              <span className="truncate font-display text-base font-bold">{total}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold">
              <span className="max-[419px]:sr-only">{t.pos.cartBar.open}</span>
              <ShoppingBag size={18} aria-hidden="true" />
            </span>
          </button>
        ) : (
          <p className="flex min-h-14 min-w-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-border bg-surface/90 px-3 text-center text-xs font-medium text-text-muted shadow-xl">
            {t.pos.cartBar.empty}
          </p>
        )}
      </div>
      {typeOpen && <OrderTypeSheet onClose={() => setTypeOpen(false)} />}
    </div>
  );
}
