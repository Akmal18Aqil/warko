import { ChefHat, CreditCard, Minus, Plus } from "lucide-react";
import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";
import { useAuth } from "../../state/auth";
import { useProducts } from "../../state/catalog";
import { usePricing } from "../../state/pricing";
import { Button } from "../../ui/Button";
import type { WaiterDraft } from "./useWaiterDraft";

interface OrderSummaryProps {
  draft: WaiterDraft;
  isSubmitting: boolean;
  onSendToKitchen: () => void;
  onPayAtTable: () => void;
}

/** Cart lines with notes, totals and the two ways to submit the order. */
export function OrderSummary({ draft, isSubmitting, onSendToKitchen, onPayAtTable }: OrderSummaryProps) {
  const { currentStaff } = useAuth();
  const products = useProducts();
  const { taxEnabled, taxRate, serviceChargeEnabled, serviceChargeRate } = usePricing();
  const { cart } = draft;
  const { totals } = cart;
  const isEmpty = cart.lines.length === 0;

  return (
    <div className="sticky top-20 space-y-4 rounded-2xl border border-ink/10 bg-surface p-4 shadow-clay">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div>
          <h3 className="text-sm font-bold text-ink">{t.waiter.summaryTitle(draft.selectedTable?.name ?? "")}</h3>
          <p className="text-xs2 text-text-muted">
            {t.waiter.summaryMeta(draft.customerName || t.waiter.guestFallback, t.waiter.guestsSummary(draft.guests), currentStaff.name)}
          </p>
        </div>
        {!isEmpty && (
          <button
            type="button"
            onClick={draft.discardCart}
            aria-label={t.waiter.clearCart}
            className="text-xs font-semibold text-error-dark hover:underline"
          >
            {t.common.delete}
          </button>
        )}
      </div>

      <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
        {isEmpty ? (
          <div className="py-8 text-center text-xs text-text-muted">
            <p>{t.waiter.emptyCart}</p>
            <p className="mt-1 text-xs2">{t.waiter.draftOwner(currentStaff.name)}</p>
          </div>
        ) : (
          cart.lines.map((line) => {
            const product = products.find((p) => p.id === line.itemId);
            if (!product) return null;
            return (
              <div key={line.itemId} className="space-y-1.5 rounded-xl border border-border/60 bg-mineral p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-ink">{product.name}</p>
                    <p className="text-xs2 text-text-muted">
                      {t.waiter.lineCalc(line.qty, formatIDR(product.price), formatIDR(product.price * line.qty))}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => cart.decrease(line.itemId)}
                      aria-label={t.waiter.decreaseItem(product.name)}
                      className="flex h-6 w-6 items-center justify-center rounded border border-border bg-surface text-ink"
                    >
                      <Minus size={11} aria-hidden="true" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-ink">{line.qty}</span>
                    <button
                      type="button"
                      onClick={() => cart.increase(line.itemId)}
                      aria-label={t.waiter.increaseItem(product.name)}
                      className="flex h-6 w-6 items-center justify-center rounded bg-accent font-bold text-white"
                    >
                      <Plus size={11} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={line.note ?? ""}
                  onChange={(e) => cart.setNote(line.itemId, e.target.value)}
                  placeholder={t.waiter.notePlaceholder}
                  aria-label={t.waiter.noteLabel(product.name)}
                  className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs2 text-ink placeholder:text-text-light focus:border-accent focus:outline-none"
                />
              </div>
            );
          })
        )}
      </div>

      <dl className="space-y-1.5 border-t border-border/60 pt-3 text-xs">
        <div className="flex justify-between text-text-muted">
          <dt>{t.waiter.subtotal(totals.count)}</dt>
          <dd>{formatIDR(totals.rawSubtotal)}</dd>
        </div>
        {taxEnabled && (
          <div className="flex justify-between text-text-muted">
            <dt>{t.waiter.tax(taxRate)}</dt>
            <dd>{formatIDR(totals.tax)}</dd>
          </div>
        )}
        {serviceChargeEnabled && (
          <div className="flex justify-between text-text-muted">
            <dt>{t.waiter.serviceCharge(serviceChargeRate)}</dt>
            <dd>{formatIDR(totals.serviceCharge)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 font-display text-sm font-bold text-ink">
          <dt>{t.waiter.grandTotal}</dt>
          <dd className="text-base">{formatIDR(totals.total)}</dd>
        </div>
      </dl>

      <div className="space-y-2 pt-2">
        <Button
          variant="primary"
          className="h-12 w-full text-sm font-bold"
          onClick={onSendToKitchen}
          disabled={isEmpty}
          loading={isSubmitting}
        >
          <ChefHat size={18} aria-hidden="true" />
          {t.waiter.sendToKitchen(currentStaff.name)}
        </Button>
        <Button variant="outline" className="h-11 w-full text-xs font-bold" onClick={onPayAtTable} disabled={isEmpty || isSubmitting}>
          <CreditCard size={15} aria-hidden="true" />
          {t.waiter.payAtTable}
        </Button>
      </div>
    </div>
  );
}
