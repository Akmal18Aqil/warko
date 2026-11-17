import type { OrderSource } from "@wakro/shared";
import { AlertTriangle, Check, CheckCircle2, Clock, Flame, QrCode, Smartphone, Store, UserCheck, Utensils } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";
import { isPaid, kitchenStatusOf } from "../../lib/orderStatus";
import { t } from "../../locales/id";
import type { OrderRow } from "../../types/domain";
import { Button } from "../../ui/Button";

const CLOCK_TICK_MS = 10_000;
const MS_PER_MINUTE = 60_000;
const MEDIUM_WAIT_MINUTES = 5;
const URGENT_WAIT_MINUTES = 15;

/** Minutes since `createdAt`, re-evaluated on its own timer so only the ticket re-renders. */
function useMinutesAgo(createdAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.floor((now - createdAt) / MS_PER_MINUTE));
}

const SOURCE: Record<OrderSource, { label: string; Icon: typeof Store }> = {
  "self-order": { label: t.kitchen.ticket.sourceSelfOrder, Icon: QrCode },
  waiter: { label: t.kitchen.ticket.sourceWaiter, Icon: Smartphone },
  pos: { label: t.kitchen.ticket.sourcePos, Icon: Store },
};

interface KitchenTicketProps {
  order: OrderRow;
  position: number;
  checkedItems: Readonly<Record<string, boolean>>;
  busy: boolean;
  onToggleItem: (orderNo: number, index: number) => void;
  onAdvance: (order: OrderRow) => void;
}

export function KitchenTicket({ order, position, checkedItems, busy, onToggleItem, onAdvance }: KitchenTicketProps) {
  const minutesAgo = useMinutesAgo(order.createdAt);
  const stage = kitchenStatusOf(order);
  const isUrgent = minutesAgo >= URGENT_WAIT_MINUTES && stage !== "ready";
  const isMedium = minutesAgo >= MEDIUM_WAIT_MINUTES && minutesAgo < URGENT_WAIT_MINUTES && stage !== "ready";
  const paid = isPaid(order);
  const { label: sourceLabel, Icon: SourceIcon } = SOURCE[order.source ?? "pos"];

  return (
    <div
      className={cn(
        "service-ticket flex flex-col justify-between overflow-hidden rounded-sm border bg-surface shadow-sm transition-all duration-200",
        stage === "ready"
          ? "border-success ring-2 ring-success/30"
          : stage === "preparing"
            ? "border-accent ring-2 ring-accent/20"
            : isUrgent
              ? "border-error ring-2 ring-error/40"
              : "border-border",
      )}
    >
      <div>
        <div
          className={cn(
            "flex items-start justify-between border-b p-3.5",
            stage === "ready"
              ? "border-success/20 bg-success/10"
              : stage === "preparing"
                ? "border-accent/20 bg-accent/10"
                : isUrgent
                  ? "border-error/20 bg-error/10"
                  : "border-border bg-surface-muted",
          )}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="order-chip rounded-md px-1.5 py-0.5 font-mono text-xs font-bold">#{order.no}</span>
              <span className="font-mono text-2xs font-bold text-text-muted">{t.kitchen.ticket.position(position)}</span>
            </div>

            <h3 className="mt-1 font-display text-base font-bold text-ink">
              {order.orderType === "meja" ? order.tableName || t.kitchen.ticket.table : t.kitchen.ticket.takeaway}
            </h3>
            {order.orderType === "meja" && order.tableArea && (
              <p className="text-xs2 font-bold uppercase tracking-wider text-text-muted">{order.tableArea}</p>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-ink">{order.customerName || t.kitchen.ticket.customer}</span>
              <span className="text-2xs text-text-light">•</span>
              <span className="source-chip inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-bold">
                <SourceIcon size={10} aria-hidden="true" />
                {sourceLabel}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-1.5 py-0.5 text-2xs font-bold",
                  paid ? "bg-success/20 text-success-dark" : "bg-error/15 text-error",
                )}
              >
                {paid ? t.kitchen.ticket.paid : t.kitchen.ticket.unpaid}
              </span>
              {order.waiterName && (
                <span className="inline-flex items-center gap-1 rounded-md border border-success/50 bg-success/20 px-1.5 py-0.5 text-2xs font-bold text-success-dark shadow-2xs">
                  <UserCheck size={10} aria-hidden="true" />
                  {t.kitchen.ticket.waiter(order.waiterName)}
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-xs font-bold shadow-xs",
                stage === "ready"
                  ? "bg-success text-ink"
                  : isUrgent
                    ? "bg-error text-white"
                    : isMedium
                      ? "bg-warning text-ink"
                      : "bg-success/20 text-success-dark",
              )}
            >
              <Clock size={12} aria-hidden="true" />
              {minutesAgo === 0 ? t.kitchen.ticket.justNow : t.kitchen.ticket.minutes(minutesAgo)}
            </span>
            {isUrgent && (
              <div className="mt-1 flex items-center justify-end gap-1 text-2xs font-bold text-error-dark">
                <AlertTriangle size={11} aria-hidden="true" />
                {t.kitchen.ticket.priority}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2.5 p-3.5">
          {order.items && order.items.length > 0 ? (
            order.items.map((item, idx) => {
              const isDone = Boolean(checkedItems[`${order.no}_${idx}`]);
              return (
                <button
                  key={`${item.itemId}|${item.note ?? ""}`}
                  type="button"
                  aria-pressed={isDone}
                  onClick={() => onToggleItem(order.no, idx)}
                  className={cn(
                    "block w-full select-none rounded-xl border p-2.5 text-left transition-all",
                    isDone
                      ? "border-border bg-surface-muted text-text-light line-through opacity-60"
                      : "border-border bg-surface text-ink shadow-xs hover:border-accent",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md text-xs font-bold transition-all",
                        isDone ? "bg-success-dark text-white" : "border border-border-hover bg-surface text-transparent",
                      )}
                    >
                      <Check size={13} aria-hidden="true" />
                    </span>
                    <span className="text-xs font-bold">
                      <span className="mr-1 font-mono text-accent-dark">{item.qty}x</span>
                      {item.name}
                    </span>
                  </span>
                  {item.note && (
                    <span className="ml-7 mt-1.5 inline-block rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs2 font-semibold text-warning-dark">
                      {item.note}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <p className="py-2 text-xs italic text-text-muted">{t.kitchen.ticket.itemsOnly(order.itemCount)}</p>
          )}
        </div>
      </div>

      <div className="p-3.5 pt-0">
        <Button
          size="sm"
          className="h-11 w-full gap-2 rounded-xl text-xs font-bold shadow-xs"
          variant={stage === "ready" ? "outline" : "primary"}
          disabled={busy}
          onClick={() => onAdvance(order)}
        >
          {stage === "queued" && (
            <>
              <Flame size={15} aria-hidden="true" />
              {t.kitchen.ticket.start}
            </>
          )}
          {stage === "preparing" && (
            <>
              <CheckCircle2 size={15} aria-hidden="true" />
              {t.kitchen.ticket.finish}
            </>
          )}
          {stage === "ready" && (
            <>
              <Utensils size={15} className="text-success-dark" aria-hidden="true" />
              {t.kitchen.ticket.deliver}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
