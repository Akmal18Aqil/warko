import { DISCOUNT_ROLES } from "@wakro/shared";
import { Tag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCan } from "../../app/useCan";
import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";
import { getPrinterDriver } from "../../services/printer/index";
import { saveDraft, setDiscount, useCart } from "../../state/cart";
import { useProducts } from "../../state/catalog";
import { useNextOrderNo } from "../../state/orders";
import { usePricing } from "../../state/pricing";
import { Button } from "../../ui/Button";
import { DiscountEditor } from "./DiscountEditor";

/** Discount trigger, price breakdown from `useCart().totals`, and the send / pay / print actions. */
export function CartSummary({ onPay }: { onPay: () => void }) {
  const { orderType, selectedTable, lines, totals, discountType, discountValue } = useCart();
  const { taxEnabled, taxRate, serviceChargeEnabled, serviceChargeRate } = usePricing();
  const products = useProducts();
  const orderNo = useNextOrderNo();
  const [discountOpen, setDiscountOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const canDiscount = useCan(DISCOUNT_ROLES);

  const blocked = lines.length === 0 || (orderType === "meja" && !selectedTable);

  const handleSendToKitchen = async () => {
    if (sending) return;
    setSending(true);
    try {
      const no = await saveDraft();
      toast.success(t.pos.cart.sentTitle(no), { description: t.pos.cart.sentBody });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.pos.cart.sendFailed);
    } finally {
      setSending(false);
    }
  };

  const handlePrint = () => {
    getPrinterDriver()
      .printReceipt({
        orderNo,
        total: formatIDR(totals.total),
        lines: lines.map((line) => {
          const product = products.find((p) => p.id === line.itemId);
          return {
            qty: line.qty,
            name: product ? (line.note ? `${product.name} (${line.note})` : product.name) : t.pos.cart.unknownItem,
            amount: formatIDR((product?.price ?? 0) * line.qty),
          };
        }),
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : t.pos.cart.printFailed));
  };

  return (
    <div className="sticky bottom-0 shrink-0 space-y-1 border-t border-border bg-surface px-4 py-2 shadow-lg">
      {canDiscount && (
        <div className="flex items-center justify-between border-b border-border pb-1.5">
          <button
            type="button"
            onClick={() => setDiscountOpen(true)}
            className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold text-text-muted transition-colors hover:text-ink min-[1200px]:min-h-0"
          >
            <Tag size={12} className="text-accent-dark" aria-hidden="true" />
            {discountValue > 0 ? (
              <span className="font-extrabold text-accent-dark">
                {t.pos.cart.discountActive(discountType === "percent" ? `${discountValue}%` : formatIDR(discountValue))}
              </span>
            ) : (
              <span className="hover:underline">{t.pos.cart.addDiscount}</span>
            )}
          </button>
          {discountValue > 0 && (
            <button
              type="button"
              aria-label={t.pos.cart.removeDiscount}
              onClick={() => setDiscount("percent", 0)}
              className="min-h-10 px-1 text-xs2 font-semibold text-error hover:underline min-[1200px]:min-h-0"
            >
              {t.common.delete}
            </button>
          )}
        </div>
      )}

      <dl className="space-y-1 text-xs">
        <SummaryRow label={t.pos.cart.productSubtotal} value={formatIDR(totals.rawSubtotal)} />
        {totals.discountAmount > 0 && (
          <SummaryRow tone="error" label={t.pos.cart.discountLine} value={`-${formatIDR(totals.discountAmount)}`} />
        )}
        {serviceChargeEnabled && <SummaryRow label={t.pos.cart.serviceCharge(serviceChargeRate)} value={formatIDR(totals.serviceCharge)} />}
        {taxEnabled && <SummaryRow label={t.pos.cart.tax(taxRate)} value={formatIDR(totals.tax)} />}
        <div className="mt-1 flex items-baseline justify-between border-t border-border pt-1.5">
          <dt className="font-display text-sm font-bold text-ink">{t.pos.cart.totalLabel}</dt>
          <dd className="font-display text-xl font-bold tracking-tight text-ink">{formatIDR(totals.total)}</dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <Button
          variant="outline"
          onClick={() => void handleSendToKitchen()}
          disabled={blocked}
          loading={sending}
          className="h-9.5 rounded-xl text-xs font-bold"
        >
          {t.pos.cart.sendToKitchen}
        </Button>
        <Button variant="primary" onClick={onPay} disabled={blocked} className="h-9.5 rounded-xl text-xs font-bold">
          {t.pos.cart.payAndSend(formatIDR(totals.total))}
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-7.5 w-full rounded-lg text-xs2 font-semibold text-text-muted hover:text-ink"
        onClick={handlePrint}
      >
        {t.pos.cart.print}
        <span
          aria-hidden="true"
          className="kbd-hint font-mono ml-1.5 rounded border border-border bg-surface px-1.5 py-0.5 text-2xs font-semibold text-text-muted"
        >
          {t.pos.cart.printShortcut}
        </span>
      </Button>

      {discountOpen && <DiscountEditor initialType={discountType} initialValue={discountValue} onClose={() => setDiscountOpen(false)} />}
    </div>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: "error" }) {
  return (
    <div className={tone === "error" ? "flex items-center justify-between text-error" : "flex items-center justify-between"}>
      <dt className={tone === "error" ? "font-medium" : "text-text-muted"}>{label}</dt>
      <dd className={tone === "error" ? "font-display font-bold" : "font-display font-medium text-ink"}>{value}</dd>
    </div>
  );
}
