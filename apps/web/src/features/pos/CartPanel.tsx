import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { t } from "../../locales/id";
import { clearCart, useCart } from "../../state/cart";
import { useNextOrderNo } from "../../state/orders";
import { CartLines } from "./CartLines";
import { CartSummary } from "./CartSummary";
import { OrderTypeSelector } from "./OrderTypeSelector";

/** The current-order ticket: header, order type / table / guests, lines, and the summary with actions. */
export function CartPanel({ onPay }: { onPay: () => void }) {
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
      className="service-ticket receipt-paper flex h-auto max-h-none min-h-0 flex-col overflow-y-auto overflow-x-hidden rounded-xl max-[1199px]:min-h-[520px] min-[1200px]:h-full min-[1200px]:max-h-full"
    >
      <div className="shrink-0 border-b border-border bg-surface px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
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

          {lines.length > 0 && (
            <button
              type="button"
              aria-label={t.pos.cart.clearAria}
              onClick={handleClear}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-error transition-colors hover:bg-error/10"
            >
              <Trash2 size={13} aria-hidden="true" />
              {t.pos.cart.clear}
            </button>
          )}
        </div>
        <OrderTypeSelector />
      </div>
      <div className="receipt-perforation mx-4 shrink-0" aria-hidden="true" />
      <CartLines />
      <CartSummary onPay={onPay} />
    </section>
  );
}
