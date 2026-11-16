import { useMemo, useState } from "react";
import { Banknote, Printer, ReceiptText, Search } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "../data/menu";
import { t } from "../locales/en";
import { Header } from "../components/Header";
import { useAuth } from "../components/AuthContext";
import type { KitchenStatus } from "@wakro/shared";
import { useOrders } from "../state/orders";
import type { OrderRow } from "../types/domain";
import { usePrint } from "../components/PrintContext";
import { PaymentModal } from "../components/PaymentModal";
import { OrderReceiptView } from "../components/OrderReceiptView";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/cn";
import { isPaid, KITCHEN_LABEL, kitchenStatusOf, paymentStatusOf, tableLabel } from "../lib/orderStatus";
import { PAY_METHOD_LABEL } from "../lib/receipt";

type OrderFilter = "unpaid" | "active" | "all";

const KITCHEN_TONE: Record<KitchenStatus, BadgeTone> = {
  draft: "dark",
  queued: "warning",
  preparing: "lime",
  ready: "success",
  served: "neutral",
};

const SOURCE_LABEL: Record<NonNullable<OrderRow["source"]>, string> = {
  pos: "Kasir",
  waiter: "Pelayan",
  "self-order": "QR Meja",
};

/** Cashier order desk: confirm cash payments of self-orders / waiter orders and reprint receipts. */
export default function Orders() {
  const orders = useOrders();
  const { currentStaff } = useAuth();
  const { printOrderReceipt } = usePrint();
  const [filter, setFilter] = useState<OrderFilter>("unpaid");
  const [query, setQuery] = useState("");
  const [payingOrder, setPayingOrder] = useState<OrderRow | null>(null);
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null);
  const canSettle = currentStaff.role === "admin" || currentStaff.role === "kasir";

  const counts = useMemo(
    () => ({
      unpaid: orders.filter((o) => paymentStatusOf(o) === "unpaid").length,
      active: orders.filter((o) => kitchenStatusOf(o) !== "served").length,
      all: orders.length,
    }),
    [orders],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) =>
        filter === "unpaid" ? paymentStatusOf(o) === "unpaid" : filter === "active" ? kitchenStatusOf(o) !== "served" : true,
      )
      .filter(
        (o) =>
          q === "" ||
          String(o.no).includes(q) ||
          tableLabel(o).toLowerCase().includes(q) ||
          (o.customerName ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => (filter === "unpaid" ? a.no - b.no : b.no - a.no));
  }, [filter, orders, query]);

  const handlePrint = (order: OrderRow) => {
    printOrderReceipt(order).catch((err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Struk gagal dicetak."),
    );
  };

  return (
    <div className="service-rail-surface flex min-h-screen flex-col">
      <Header title={t.ordersPage.title} />
      <div className="flex-1 p-5 md:p-8">
        <p className="-mt-1 mb-4 text-sm text-ink/55">
          Konfirmasi pembayaran tunai pesanan QR meja &amp; pelayan, lalu cetak struk.
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(
            [
              ["unpaid", `Belum Bayar (${counts.unpaid})`],
              ["active", `Sedang Diproses (${counts.active})`],
              ["all", `Semua (${counts.all})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                filter === key ? "bg-ink text-mineral" : "border border-ink/10 bg-white text-ink/65 hover:bg-ink/5",
              )}
            >
              {label}
            </button>
          ))}
          <label className="relative ml-auto w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari no., meja, atau nama"
              aria-label="Cari pesanan"
              className="h-9 w-full rounded-lg border border-ink/15 bg-white pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent/60"
            />
          </label>
        </div>

        <div className="max-w-full overflow-x-auto rounded-xl border border-ink/10 bg-white">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink/10 bg-mineral/60">
                <th scope="col" className="label-caps px-5 py-3 text-[11px] font-semibold text-ink/50">Pesanan</th>
                <th scope="col" className="label-caps px-5 py-3 text-[11px] font-semibold text-ink/50">Dapur</th>
                <th scope="col" className="label-caps px-5 py-3 text-[11px] font-semibold text-ink/50">Pembayaran</th>
                <th scope="col" className="label-caps px-5 py-3 text-right text-[11px] font-semibold text-ink/50">Total</th>
                <th scope="col" className="px-5 py-3"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => {
                const stage = kitchenStatusOf(order);
                const paid = isPaid(order);
                return (
                  <tr key={order.no} className="border-b border-ink/6 last:border-0 hover:bg-mineral/40">
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display font-bold tracking-tight text-ink">#{order.no}</p>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-ink/70">{tableLabel(order)}</span>
                        {order.source && (
                          <span className="text-[10px] font-semibold text-ink/50">{SOURCE_LABEL[order.source]}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-ink/50">
                        {order.customerName || "Pelanggan"} · {t.ordersPage.itemsUnit(order.itemCount)} ·{" "}
                        {new Date(order.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={KITCHEN_TONE[stage]}>{KITCHEN_LABEL[stage]}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      {paid ? (
                        <Badge tone="success">Lunas{order.method ? ` · ${PAY_METHOD_LABEL[order.method]}` : ""}</Badge>
                      ) : paymentStatusOf(order) === "refunded" ? (
                        <Badge tone="dark">Refund</Badge>
                      ) : (
                        <Badge tone="coral">Belum bayar</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-display font-bold tracking-tight text-ink">{formatIDR(order.total)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        {!paid && paymentStatusOf(order) === "unpaid" && canSettle && (
                          <Button size="sm" onClick={() => setPayingOrder(order)} className="gap-1">
                            <Banknote size={14} aria-hidden="true" /> Terima Bayar
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setDetailOrder(order)} aria-label={`Rincian pesanan ${order.no}`}>
                          <ReceiptText size={14} aria-hidden="true" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePrint(order)} aria-label={`Cetak struk pesanan ${order.no}`}>
                          <Printer size={14} aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-ink/50">
                    {filter === "unpaid" ? "Tidak ada pesanan yang menunggu pembayaran." : "Tidak ada pesanan."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentModal open={payingOrder !== null} order={payingOrder ?? undefined} onClose={() => setPayingOrder(null)} />

      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4" onClick={() => setDetailOrder(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Rincian pesanan ${detailOrder.no}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-sm space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <OrderReceiptView order={orders.find((o) => o.no === detailOrder.no) ?? detailOrder} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDetailOrder(null)}>
                Tutup
              </Button>
              <Button className="flex-1 gap-1.5" onClick={() => handlePrint(orders.find((o) => o.no === detailOrder.no) ?? detailOrder)}>
                <Printer size={15} /> Cetak
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
