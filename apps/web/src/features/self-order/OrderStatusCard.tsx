import { CheckCircle2, ChefHat, QrCode, ReceiptText, Sparkles } from "lucide-react";
import { formatIDR } from "../../data/menu";
import { cn } from "../../lib/cn";
import { isPaid, kitchenStatusOf } from "../../lib/orderStatus";
import { t } from "../../locales/id";
import type { OrderRow } from "../../types/domain";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";

const STEP_KEYS = ["queued", "preparing", "ready", "served"] as const;

interface OrderStatusCardProps {
  order: OrderRow;
  qrisAvailable: boolean;
  onReceipt: () => void;
  onPayQris: () => void;
}

/** Live progress, items and payment state of one placed order. */
export function OrderStatusCard({ order, qrisAvailable, onReceipt, onPayQris }: OrderStatusCardProps) {
  const stage = kitchenStatusOf(order);
  // A draft has not reached the kitchen yet; it shows as the first step.
  const stepIndex = stage === "draft" ? 0 : STEP_KEYS.indexOf(stage);
  const paid = isPaid(order);
  return (
    <article className="space-y-3 rounded-2xl border-2 border-accent bg-surface p-4 shadow-clay">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
            <ChefHat size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">{t.selfOrder.status.orderNo(order.no)}</h2>
            <p className="text-xs2 text-text-muted">
              {order.tableName}
              {order.tableArea ? ` · ${order.tableArea}` : ""}
            </p>
          </div>
        </div>
        <Badge tone={paid ? "success" : "error"} solid className="uppercase">
          {paid ? t.selfOrder.status.paid : t.selfOrder.status.unpaid}
        </Badge>
      </div>

      {stage === "ready" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-success/50 bg-success/10 p-3 text-success-dark">
          <Sparkles size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-xs font-bold">{t.selfOrder.status.readyBanner}</p>
        </div>
      )}

      <ol className="grid grid-cols-4 gap-1 text-center text-2xs font-semibold" aria-label={t.selfOrder.status.progress}>
        {STEP_KEYS.map((key, i) => (
          <li key={key} className="flex flex-col items-center gap-1" aria-current={i === stepIndex ? "step" : undefined}>
            <div className={cn("h-2 w-full rounded-full", i <= stepIndex ? "bg-accent" : "bg-border")} />
            <span className={i <= stepIndex ? "font-bold text-ink" : "text-text-light"}>{t.selfOrder.status.steps[key]}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-1 rounded-xl bg-mineral p-2.5 text-xs">
        {order.items?.map((item, idx) => (
          <div key={idx} className="flex justify-between text-ink/80">
            <span>
              <strong>{item.qty}×</strong> {item.name}
              {item.note && <span className="block text-2xs italic text-text-muted">({item.note})</span>}
            </span>
            <span className="font-medium">{formatIDR(item.price * item.qty)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-border pt-1.5 font-bold text-ink">
          <span>{t.common.total}</span>
          <span>{formatIDR(order.total)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {paid ? (
          <span className="flex items-center gap-1 font-semibold text-success-dark">
            <CheckCircle2 size={14} aria-hidden="true" /> {t.selfOrder.status.paymentReceived}
          </span>
        ) : (
          <span className="font-semibold text-ink/70">{t.selfOrder.status.payAtCashier(order.no)}</span>
        )}
        <div className="flex gap-2">
          {!paid && qrisAvailable && (
            <Button size="sm" variant="outline" onClick={onPayQris}>
              <QrCode size={13} aria-hidden="true" /> {t.selfOrder.status.payQris}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onReceipt}>
            <ReceiptText size={13} aria-hidden="true" /> {paid ? t.selfOrder.status.receipt : t.selfOrder.status.details}
          </Button>
        </div>
      </div>
    </article>
  );
}
