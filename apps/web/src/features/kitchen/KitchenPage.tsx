import type { KitchenStatus } from "@wakro/shared";
import { Bell, BellOff, CheckCircle2, ChefHat, Clock, Flame } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FocusModeHeader } from "../../app/FocusModeHeader";
import { isAudioReady, playKitchenBell, unlockAudio } from "../../lib/audioFeedback";
import { cn } from "../../lib/cn";
import { isKitchenActive, isPaid, kitchenStatusOf, NEXT_KITCHEN_STATUS, tableLabel } from "../../lib/orderStatus";
import { t } from "../../locales/id";
import { useAuth } from "../../state/auth";
import { updateKitchenStatus, useOrders } from "../../state/orders";
import { useDataReady } from "../../state/session";
import type { OrderRow } from "../../types/domain";
import { Empty } from "../../ui/Empty";
import { type SegmentedTab, SegmentedTabs } from "../../ui/SegmentedTabs";
import { KitchenTicket } from "./KitchenTicket";

type KdsFilter = "all" | KitchenStatus;

export default function KitchenPage() {
  const { currentStaff } = useAuth();
  const orders = useOrders();
  const ready = useDataReady();
  const [filter, setFilter] = useState<KdsFilter>("all");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [soundOn, setSoundOn] = useState(isAudioReady);
  const [updating, setUpdating] = useState<number | null>(null);
  const seenOrders = useRef<Set<number> | null>(null);

  // Strict FIFO: oldest ticket first.
  const kitchenOrders = useMemo(() => orders.filter(isKitchenActive).sort((a, b) => a.createdAt - b.createdAt), [orders]);

  // Bell + toast for every ticket that arrives after the screen loaded.
  useEffect(() => {
    if (!ready) return;
    const incoming = kitchenOrders.filter((o) => kitchenStatusOf(o) === "queued");
    if (seenOrders.current === null) {
      seenOrders.current = new Set(orders.map((o) => o.no));
      return;
    }
    const fresh = incoming.filter((o) => !seenOrders.current!.has(o.no));
    for (const o of orders) seenOrders.current.add(o.no);
    if (fresh.length === 0) return;
    if (soundOn) playKitchenBell();
    for (const o of fresh) {
      toast.info(t.kitchen.newOrder(o.no, tableLabel(o)), {
        description: t.kitchen.newOrderDetail(o.itemCount, isPaid(o)),
      });
    }
  }, [kitchenOrders, orders, ready, soundOn]);

  const filteredOrders = useMemo(
    () => (filter === "all" ? kitchenOrders : kitchenOrders.filter((o) => kitchenStatusOf(o) === filter)),
    [kitchenOrders, filter],
  );

  const countOf = (status: KitchenStatus) => kitchenOrders.filter((o) => kitchenStatusOf(o) === status).length;
  const countWaiting = countOf("queued");

  const tabs: SegmentedTab<KdsFilter>[] = [
    { id: "all", label: t.kitchen.filterAll(kitchenOrders.length) },
    { id: "queued", icon: <Clock size={14} aria-hidden="true" />, label: t.kitchen.filterQueued(countWaiting) },
    { id: "preparing", icon: <Flame size={14} aria-hidden="true" />, label: t.kitchen.filterPreparing(countOf("preparing")) },
    { id: "ready", icon: <CheckCircle2 size={14} aria-hidden="true" />, label: t.kitchen.filterReady(countOf("ready")) },
  ];

  const handleEnableSound = async () => {
    if (await unlockAudio()) {
      setSoundOn(true);
      playKitchenBell();
      toast.success(t.kitchen.soundEnabled);
    } else {
      toast.error(t.kitchen.audioDenied);
    }
  };

  const handleAdvanceStatus = async (order: OrderRow) => {
    const next = NEXT_KITCHEN_STATUS[kitchenStatusOf(order)];
    if (!next || updating !== null) return;
    setUpdating(order.no);
    try {
      await updateKitchenStatus(order.no, next);
      if (next === "preparing") toast.info(t.kitchen.started(order.no));
      else if (next === "ready") toast.success(t.kitchen.readyToServe(order.no));
      else toast.success(t.kitchen.served(order.no, tableLabel(order)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.kitchen.updateFailed);
    } finally {
      setUpdating(null);
    }
  };

  const toggleItemCheck = (orderNo: number, idx: number) => {
    const key = `${orderNo}_${idx}`;
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="service-rail-surface flex min-h-screen min-w-0 flex-col overflow-x-hidden">
      <FocusModeHeader
        title={t.kitchen.title}
        subtitle={t.kitchen.subtitle(currentStaff.name)}
        roleType="dapur"
        badgeCount={countWaiting}
      />

      <div className="min-w-0 max-w-full flex-1 overflow-x-hidden p-4 pb-24 md:p-6">
        <div className="-mt-1 mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-bold text-white">FIFO</span>
            <div>
              <h2 className="text-sm font-bold text-ink">{t.kitchen.fifoTitle}</h2>
              <p className="text-xs text-text-muted">{t.kitchen.fifoHint}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleEnableSound()}
              aria-pressed={soundOn}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition",
                soundOn ? "bg-success-dark" : "animate-pulse bg-error",
              )}
            >
              {soundOn ? <Bell size={14} aria-hidden="true" /> : <BellOff size={14} aria-hidden="true" />}
              {soundOn ? t.kitchen.soundOn : t.kitchen.soundOff}
            </button>
            <SegmentedTabs tabs={tabs} value={filter} onChange={setFilter} label={t.kitchen.filterLabel} className="flex-wrap" />
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <Empty
            icon={<ChefHat size={32} aria-hidden="true" />}
            title={t.kitchen.emptyTitle}
            subtitle={t.kitchen.emptySubtitle}
            className="rounded-3xl border border-dashed border-border bg-surface"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredOrders.map((order, index) => (
              <KitchenTicket
                key={order.no}
                order={order}
                position={index + 1}
                checkedItems={checkedItems}
                busy={updating === order.no}
                onToggleItem={toggleItemCheck}
                onAdvance={(o) => void handleAdvanceStatus(o)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
