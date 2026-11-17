import { Trash2, X } from "lucide-react";
import type { Ref } from "react";
import { toast } from "sonner";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import { clearCart, useCart } from "../../state/cart";
import { useNextOrderNo } from "../../state/orders";
import { IconButton } from "../../ui/Button";
import { CartLines } from "./CartLines";
import { CartSummary } from "./CartSummary";
import { OrderTypeSelector } from "./OrderTypeSelector";

/**
 * The current-order ticket: header, order type / table / guests, lines, and the summary with actions.
 * Without `onClose` it fills the desktop side rail; with it, it fills the phone/tablet cart sheet, and
 * `closeRef` lets the sheet focus its close button rather than the destructive "clear" action.
 */
export function CartPanel({ onPay, onClose, closeRef }: { onPay: () => void; onClose?: () => void; closeRef?: Ref<HTMLButtonElement> }) {
  const { orderType, selectedTable, lines } = useCart();
  const orderNo = useNextOrderNo();
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);

  const handleClear = () => {
    clearCart();
    toast(t.pos.toasts.clearedTitle, { description: t.pos.toasts.clearedBody });
  };

  return (
    <section
      aria-label={t.pos.cart.title}
      className={cn(
        "service-ticket receipt-paper flex min-h-0 flex-col overflow-y-auto overflow-x-hidden",
        onClose ? "flex-1 border-0" : "h-full max-h-full rounded-xl",
      )}
    >
      <div className="shrink-0 border-b border-border bg-surface px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="label-caps mb-1 text-2xs font-bold text-text-muted">{t.pos.cart.eyebrow}</p>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold tracking-tight text-ink">{t.pos.cart.title}</h2>
              <span className="order-chip rounded-md px-2 py-0.5 font-mono text-xs font-bold">#{orderNo}</span>
            </div>
            <p className="mt-0.5 text-xs font-medium text-text-muted">
              {t.pos.cart.itemsSelected(itemCount)} ·{" "}
              {orderType === "bawa-pulang"
                ? t.pos.cart.takeaway
                : selectedTable
                  ? `${selectedTable.name} · ${selectedTable.area}`
                  : t.pos.cart.chooseTable}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {lines.length > 0 && (
              <button
                type="button"
                aria-label={t.pos.cart.clearAria}
                onClick={handleClear}
                className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-error transition-colors hover:bg-error/10 min-[1200px]:min-h-0 min-[1200px]:min-w-0"
              >
                <Trash2 size={13} aria-hidden="true" />
                <span className="max-[399px]:sr-only">{t.pos.cart.clear}</span>
              </button>
            )}
            {onClose && (
              <IconButton ref={closeRef} label={t.common.close} onClick={onClose}>
                <X size={18} aria-hidden="true" />
              </IconButton>
            )}
          </div>
        </div>
        <OrderTypeSelector />
      </div>
      <div className="receipt-perforation mx-4 shrink-0" aria-hidden="true" />
      <CartLines inSheet={onClose !== undefined} />
      <CartSummary onPay={onPay} />
    </section>
  );
}
