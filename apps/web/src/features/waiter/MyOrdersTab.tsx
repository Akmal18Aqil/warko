import { Check, ClipboardList, Flame, Plus, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";
import { cn } from "../../lib/cn";
import { kitchenStatusOf, tableLabel } from "../../lib/orderStatus";
import { useAuth } from "../../state/auth";
import { updateKitchenStatus } from "../../state/orders";
import type { OrderRow } from "../../types/domain";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Empty } from "../../ui/Empty";
import { DEFAULT_GUESTS } from "./constants";
import { ElapsedMinutes } from "./ElapsedMinutes";

interface MyOrdersTabProps {
  orders: OrderRow[];
  onStartOrder: () => void;
}

const STAGE_BADGE = {
  ready: { tone: "success", icon: Sparkles, label: t.waiter.stageReady },
  preparing: { tone: "accent", icon: Flame, label: t.waiter.stagePreparing },
  queued: { tone: "neutral", icon: Clock, label: t.waiter.stageQueued },
} as const;

function markServed(no: number) {
  updateKitchenStatus(no, "served").then(
    () => toast.success(t.waiter.servedToast(no)),
    (err: unknown) => toast.error(err instanceof Error ? err.message : t.waiter.servedFailed),
  );
}

/** Tab 2: the waiter's own orders that are still being cooked or waiting to be delivered. */
export function MyOrdersTab({ orders, onStartOrder }: MyOrdersTabProps) {
  const { currentStaff } = useAuth();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-surface p-4 shadow-clay">
        <div>
          <h3 className="font-display text-base font-bold text-ink">{t.waiter.myOrdersTitle(currentStaff.name)}</h3>
          <p className="mt-0.5 text-xs text-text-muted">{t.waiter.myOrdersHint}</p>
        </div>
        <Badge tone="success">{t.waiter.myOrdersBadge(orders.length)}</Badge>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-ink/10 bg-surface shadow-clay">
          <Empty
            icon={<ClipboardList size={28} aria-hidden="true" />}
            title={t.waiter.myOrdersEmptyTitle}
            subtitle={t.waiter.myOrdersEmptyHint}
            action={
              <Button variant="primary" size="sm" onClick={onStartOrder}>
                <Plus size={14} aria-hidden="true" />
                {t.waiter.startNewOrder}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <MyOrderCard key={order.no} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function MyOrderCard({ order }: { order: OrderRow }) {
  const stage = kitchenStatusOf(order);
  const isReady = stage === "ready";
  const badge = STAGE_BADGE[stage === "ready" || stage === "preparing" ? stage : "queued"];
  const BadgeIcon = badge.icon;

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl border p-4 shadow-clay transition-all",
        isReady ? "border-success-dark bg-success/10 ring-2 ring-success/40" : "border-ink/10 bg-surface",
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-xs font-bold text-white">#{order.no}</span>
              <span className="font-display text-sm font-bold text-ink">{tableLabel(order)}</span>
            </div>
            <p className="mt-0.5 text-xs text-text-muted">
              {order.customerName} · {t.waiter.guestsOnCard(order.guests || DEFAULT_GUESTS)}
            </p>
          </div>
          <Badge tone={badge.tone} solid className={cn("gap-1 py-1 text-xs font-bold", isReady && "animate-pulse")}>
            <BadgeIcon size={13} aria-hidden="true" />
            {badge.label}
          </Badge>
        </div>

        <ul className="space-y-1 rounded-xl bg-mineral/40 p-2.5 text-xs">
          {order.items?.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-start justify-between">
              <span className="font-medium text-ink">
                <strong className="font-bold">{item.qty}x</strong> {item.name}
                {item.note && <span className="block text-2xs italic text-text-muted">{t.waiter.itemNote(item.note)}</span>}
              </span>
              <span className="text-xs2 text-text-muted">{formatIDR(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
        <div className="text-xs">
          <span className="text-text-muted">{t.waiter.orderTotal} </span>
          <strong className="font-display font-bold text-ink">{formatIDR(order.total)}</strong>
        </div>
        {isReady ? (
          <Button variant="success" size="sm" className="font-bold" onClick={() => markServed(order.no)}>
            <Check size={14} aria-hidden="true" />
            {t.waiter.markServed}
          </Button>
        ) : (
          <ElapsedMinutes ts={order.createdAt} />
        )}
      </div>
    </div>
  );
}
