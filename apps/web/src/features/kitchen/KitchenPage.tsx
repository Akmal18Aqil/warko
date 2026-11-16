import { useState, useEffect, useMemo, useRef } from "react";
import {
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  Utensils,
  QrCode,
  Smartphone,
  Store,
  Check,
  AlertTriangle,
  UserCheck,
  Bell,
  BellOff,
} from "lucide-react";
import { toast } from "sonner";
import { FocusModeHeader } from "../components/FocusModeHeader";
import { useAuth } from "../components/AuthContext";
import { Button } from "../components/ui/Button";
import type { KitchenStatus } from "@wakro/shared";
import { updateKitchenStatus, useOrders } from "../state/orders";
import { useDataReady } from "../state/session";
import type { OrderRow } from "../types/domain";
import { cn } from "../lib/cn";
import { isAudioReady, playKitchenBell, unlockAudio } from "../lib/audioFeedback";
import { isKitchenActive, isPaid, kitchenStatusOf, NEXT_KITCHEN_STATUS, tableLabel } from "../lib/orderStatus";

type KdsFilter = "SEMUA" | "queued" | "preparing" | "ready";

export default function Kitchen() {
  const { currentStaff } = useAuth();
  const orders = useOrders();
  const ready = useDataReady();
  const [filter, setFilter] = useState<KdsFilter>("SEMUA");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [, setTick] = useState(0);
  const [soundOn, setSoundOn] = useState(isAudioReady);
  const [updating, setUpdating] = useState<number | null>(null);
  const seenOrders = useRef<Set<number> | null>(null);

  // Live timer tick every 10 seconds for real-time elapsed time accuracy
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Strict FIFO: oldest ticket first.
  const kitchenOrders = useMemo(() => {
    return orders.filter(isKitchenActive).sort((a, b) => a.createdAt - b.createdAt);
  }, [orders]);

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
      toast.info(`🔔 Pesanan baru #${o.no} · ${tableLabel(o)}`, {
        description: `${o.itemCount} item · ${isPaid(o) ? "Lunas" : "Belum bayar"}`,
      });
    }
  }, [kitchenOrders, orders, ready, soundOn]);

  const filteredOrders = useMemo(() => {
    if (filter === "SEMUA") return kitchenOrders;
    return kitchenOrders.filter((o) => kitchenStatusOf(o) === filter);
  }, [kitchenOrders, filter]);

  const countWaiting = kitchenOrders.filter((o) => kitchenStatusOf(o) === "queued").length;
  const countCooking = kitchenOrders.filter((o) => kitchenStatusOf(o) === "preparing").length;
  const countReady = kitchenOrders.filter((o) => kitchenStatusOf(o) === "ready").length;

  const handleEnableSound = async () => {
    if (await unlockAudio()) {
      setSoundOn(true);
      playKitchenBell();
      toast.success("Bel pesanan masuk aktif");
    } else {
      toast.error("Browser ini tidak mengizinkan audio.");
    }
  };

  const handleAdvanceStatus = async (order: OrderRow) => {
    const current: KitchenStatus = kitchenStatusOf(order);
    const next = NEXT_KITCHEN_STATUS[current];
    if (!next || updating !== null) return;
    setUpdating(order.no);
    try {
      await updateKitchenStatus(order.no, next);
      if (next === "preparing") toast.info(`Pesanan #${order.no} mulai dimasak`);
      else if (next === "ready") toast.success(`Pesanan #${order.no} SELESAI & READY diantar!`);
      else toast.success(`Pesanan #${order.no} sudah diantar ke ${tableLabel(order)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui status pesanan dapur");
    } finally {
      setUpdating(null);
    }
  };

  const toggleItemCheck = (orderNo: number, idx: number) => {
    const key = `${orderNo}_${idx}`;
    setCheckedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="service-rail-surface flex min-h-screen min-w-0 flex-col overflow-x-hidden">
      <FocusModeHeader
        title="Layar Dapur (KDS)"
        subtitle={`Kepala Dapur: ${currentStaff.name} · Antrean Masak FIFO`}
        roleType="dapur"
        badgeCount={countWaiting}
      />

      <div className="min-w-0 max-w-full flex-1 overflow-x-hidden p-4 md:p-6 pb-24">
        {/* Top summary & filter bar */}
        <div className="-mt-1 mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-bold">
              FIFO
            </span>
            <div>
              <h2 className="text-sm font-bold text-ink">Urutan Datang Pertama (First-In First-Out)</h2>
              <p className="text-xs text-ink/60">
                Tiket otomatis berurutan dari pesanan paling awal masuk ke dapur.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => void handleEnableSound()}
              aria-pressed={soundOn}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-bold transition flex items-center gap-1.5",
                soundOn ? "bg-emerald-600 text-white" : "bg-coral text-white animate-pulse",
              )}
            >
              {soundOn ? <Bell size={14} /> : <BellOff size={14} />}
              {soundOn ? "Bel aktif" : "Aktifkan bel"}
            </button>
            <button
              type="button"
              onClick={() => setFilter("SEMUA")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-bold transition",
                filter === "SEMUA"
                  ? "bg-accent text-white shadow-sm"
                  : "bg-white border border-ink/15 text-ink/70 hover:bg-ink/5",
              )}
            >
              Semua ({kitchenOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("queued")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-bold transition flex items-center gap-1.5",
                filter === "queued"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-white border border-ink/15 text-ink/70 hover:bg-ink/5",
              )}
            >
              <Clock size={14} /> Diterima ({countWaiting})
            </button>
            <button
              type="button"
              onClick={() => setFilter("preparing")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-bold transition flex items-center gap-1.5",
                filter === "preparing"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white border border-ink/15 text-ink/70 hover:bg-ink/5",
              )}
            >
              <Flame size={14} /> Dimasak ({countCooking})
            </button>
            <button
              type="button"
              onClick={() => setFilter("ready")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-bold transition flex items-center gap-1.5",
                filter === "ready"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white border border-ink/15 text-ink/70 hover:bg-ink/5",
              )}
            >
              <CheckCircle2 size={14} /> Ready ({countReady})
            </button>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-ink/20 bg-white p-12 text-center">
            <ChefHat size={44} className="mx-auto text-ink/30 mb-3" />
            <h3 className="font-display text-lg font-bold text-ink">
              Tidak Ada Tiket Masak Aktif
            </h3>
            <p className="mt-1 text-xs text-ink/55">
              Semua pesanan makanan & minuman saat ini sudah siap atau telah selesai disajikan.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredOrders.map((order, orderIndex) => {
              const minutesAgo = Math.max(0, Math.floor((Date.now() - order.createdAt) / 60000));
              const stage = kitchenStatusOf(order);
              const isUrgent = minutesAgo >= 15 && stage !== "ready";
              const isMedium = minutesAgo >= 5 && minutesAgo < 15 && stage !== "ready";
              const paid = isPaid(order);

              const sourceLabel =
                order.source === "self-order"
                  ? "QR Self-Order"
                  : order.source === "waiter"
                  ? "Pelayan"
                  : "Kasir POS";

              const SourceIcon =
                order.source === "self-order"
                  ? QrCode
                  : order.source === "waiter"
                  ? Smartphone
                  : Store;

              return (
                <div
                  key={order.no}
                  className={cn(
                    "service-ticket flex flex-col justify-between rounded-sm border bg-surface shadow-sm overflow-hidden transition-all duration-200",
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
                    {/* Ticket Header */}
                    <div
                      className={cn(
                        "p-3.5 border-b flex items-start justify-between",
                        stage === "ready"
                          ? "bg-success/10 border-success/20"
                          : stage === "preparing"
                          ? "bg-accent/10 border-accent/20"
                          : isUrgent
                          ? "bg-error/10 border-error/20"
                          : "bg-surface-muted border-border",
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="order-chip rounded-md px-1.5 py-0.5 font-mono text-xs font-bold">
                            #{order.no}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-ink/50">
                            Urutan ke-{orderIndex + 1}
                          </span>
                        </div>

                        <h3 className="font-display text-base font-bold text-ink mt-1">
                          {order.orderType === "meja" ? order.tableName || "Meja" : "Takeaway"}
                        </h3>
                        {order.orderType === "meja" && order.tableArea && (
                          <p className="text-[11px] font-bold uppercase tracking-wider text-ink/55">{order.tableArea}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-xs font-semibold text-ink/80">
                            {order.customerName || "Pelanggan"}
                          </span>
                          <span className="text-[10px] text-ink/40">•</span>
                          <span className="source-chip inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold">
                            <SourceIcon size={10} />
                            {sourceLabel}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                              paid ? "bg-emerald-100 text-emerald-900" : "bg-coral/15 text-coral",
                            )}
                          >
                            {paid ? "LUNAS" : "BELUM BAYAR"}
                          </span>
                          {order.waiterName && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 text-[10px] font-bold shadow-2xs">
                              <UserCheck size={10} className="text-emerald-700" />
                              Pelayan: {order.waiterName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Timer Pill */}
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
                          <Clock size={12} />
                          {minutesAgo === 0 ? "Baru saja" : `${minutesAgo} mnt`}
                        </span>
                        {isUrgent && (
                          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] font-bold text-rose-600">
                            <AlertTriangle size={11} />
                            Prioritas!
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Order Items Checklist */}
                    <div className="p-3.5 space-y-2.5">
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item, idx) => {
                          const itemKey = `${order.no}_${idx}`;
                          const isDone = Boolean(checkedItems[itemKey]);

                          return (
                            <div
                              key={idx}
                              onClick={() => toggleItemCheck(order.no, idx)}
                              className={cn(
                                "cursor-pointer rounded-xl border p-2.5 transition-all select-none",
                                isDone
                                  ? "bg-slate-100/70 border-slate-200 opacity-60 line-through text-ink/40"
                                  : "bg-white border-slate-200/80 hover:border-accent text-ink shadow-xs",
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "flex h-5 w-5 items-center justify-center rounded-md text-xs font-bold transition-all",
                                      isDone
                                        ? "bg-emerald-600 text-white"
                                        : "border border-slate-300 bg-white text-transparent",
                                    )}
                                  >
                                    <Check size={13} />
                                  </span>
                                  <span className="font-bold text-xs">
                                    <span className="font-mono text-accent-dark mr-1">
                                      {item.qty}x
                                    </span>
                                    {item.name}
                                  </span>
                                </div>
                              </div>

                              {item.note && (
                                <p className="mt-1.5 ml-7 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 border border-amber-200/60 inline-block not-italic">
                                  📝 {item.note}
                                </p>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-ink/50 italic py-2">
                          {order.itemCount} item dalam pesanan ini
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stage Action Button */}
                  <div className="p-3.5 pt-0">
                    <Button
                      size="sm"
                      className="h-11 w-full font-bold shadow-xs rounded-xl text-xs gap-2"
                      variant={stage === "ready" ? "outline" : "primary"}
                      disabled={updating === order.no}
                      onClick={() => void handleAdvanceStatus(order)}
                    >
                      {stage === "queued" && (
                        <>
                          <Flame size={15} />
                          Mulai Masak
                        </>
                      )}
                      {stage === "preparing" && (
                        <>
                          <CheckCircle2 size={15} />
                          Selesai &amp; Ready
                        </>
                      )}
                      {stage === "ready" && (
                        <>
                          <Utensils size={15} className="text-emerald-600" />
                          Sudah Diantar ke Tamu
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
