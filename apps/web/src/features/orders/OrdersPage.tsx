import { type KitchenStatus, SETTLE_ROLES } from "@wakro/shared";
import { Banknote, Printer, ReceiptText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Header } from "../../app/Header";
import { useCan } from "../../app/useCan";
import { formatIDR } from "../../data/menu";
import { isPaid, KITCHEN_LABEL, kitchenStatusOf, paymentStatusOf, tableLabel } from "../../lib/orderStatus";
import { PAY_METHOD_LABEL } from "../../lib/receipt";
import { t } from "../../locales/id";
import { useOrders } from "../../state/orders";
import { usePrint } from "../../state/print";
import type { OrderRow } from "../../types/domain";
import { Badge, type BadgeTone } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Empty } from "../../ui/Empty";
import { Input } from "../../ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { PageHeader } from "../../ui/PageHeader";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { PaymentModal } from "../pos/PaymentModal";
import { OrderReceiptView } from "../printing/OrderReceiptView";

type OrderFilter = "unpaid" | "active" | "all";

const COLUMN_COUNT = 5;

const KITCHEN_TONE: Record<KitchenStatus, BadgeTone> = {
  draft: "dark",
  queued: "warning",
  preparing: "accent",
  ready: "success",
  served: "neutral",
};

const HEADER_CELL = "label-caps px-5 py-3 text-xs2 font-semibold text-ink/50";

function PaymentBadge({ order }: { order: OrderRow }) {
  if (isPaid(order)) return <Badge tone="success">{t.orders.paid(order.method ? PAY_METHOD_LABEL[order.method] : undefined)}</Badge>;
  if (paymentStatusOf(order) === "refunded") return <Badge tone="dark">{t.orders.refunded}</Badge>;
  return <Badge tone="error">{t.orders.unpaid}</Badge>;
}

/** Cashier order desk: confirm cash payments of self-orders / waiter orders and reprint receipts. */
export default function OrdersPage() {
  const orders = useOrders();
  const { printOrderReceipt } = usePrint();
  const [filter, setFilter] = useState<OrderFilter>("unpaid");
  const [query, setQuery] = useState("");
  const [payingOrder, setPayingOrder] = useState<OrderRow | null>(null);
  const [detailNo, setDetailNo] = useState<number | null>(null);
  const canSettle = useCan(SETTLE_ROLES);

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
      .filter((o) => (filter === "unpaid" ? paymentStatusOf(o) === "unpaid" : filter === "active" ? kitchenStatusOf(o) !== "served" : true))
      .filter(
        (o) =>
          q === "" ||
          String(o.no).includes(q) ||
          tableLabel(o).toLowerCase().includes(q) ||
          (o.customerName ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => (filter === "unpaid" ? a.no - b.no : b.no - a.no));
  }, [filter, orders, query]);

  const detailOrder = detailNo === null ? undefined : orders.find((o) => o.no === detailNo);

  const handlePrint = (order: OrderRow) => {
    printOrderReceipt(order).catch((err: unknown) => toast.error(err instanceof Error ? err.message : t.orders.printFailed));
  };

  return (
    <div className="service-rail-surface flex min-h-screen flex-col">
      <Header title={t.orders.title} />
      <div className="flex-1 p-5 md:p-8">
        <PageHeader subtitle={t.orders.subtitle} subtitleClassName="text-sm" />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SegmentedTabs<OrderFilter>
            label={t.orders.filterLabel}
            value={filter}
            onChange={setFilter}
            tabs={[
              { id: "unpaid", label: t.orders.filters.unpaid(counts.unpaid) },
              { id: "active", label: t.orders.filters.active(counts.active) },
              { id: "all", label: t.orders.filters.all(counts.all) },
            ]}
          />
          <div className="relative ml-auto w-full sm:w-64">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden="true" />
            <Input
              type="search"
              size="sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.orders.searchPlaceholder}
              aria-label={t.orders.searchLabel}
              className="pl-8"
            />
          </div>
        </div>

        <div className="max-w-full overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-clay">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink/10 bg-mineral/60">
                <th scope="col" className={HEADER_CELL}>
                  {t.orders.columns.order}
                </th>
                <th scope="col" className={HEADER_CELL}>
                  {t.orders.columns.kitchen}
                </th>
                <th scope="col" className={HEADER_CELL}>
                  {t.orders.columns.payment}
                </th>
                <th scope="col" className={`${HEADER_CELL} text-right`}>
                  {t.orders.columns.total}
                </th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">{t.orders.columns.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => {
                const stage = kitchenStatusOf(order);
                return (
                  <tr key={order.no} className="border-b border-ink/6 last:border-0 hover:bg-mineral/40">
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display font-bold tracking-tight text-ink">#{order.no}</p>
                        <span className="rounded bg-surface-muted px-1.5 py-0.5 text-2xs font-bold text-ink/70">{tableLabel(order)}</span>
                        {order.source && <span className="text-2xs font-semibold text-ink/50">{t.orders.source[order.source]}</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-ink/50">
                        {order.customerName || t.orders.guest} · {t.orders.itemsUnit(order.itemCount)} ·{" "}
                        {new Date(order.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={KITCHEN_TONE[stage]}>{KITCHEN_LABEL[stage]}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <PaymentBadge order={order} />
                    </td>
                    <td className="px-5 py-3.5 text-right font-display font-bold tracking-tight text-ink">{formatIDR(order.total)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        {paymentStatusOf(order) === "unpaid" && canSettle && (
                          <Button size="sm" onClick={() => setPayingOrder(order)}>
                            <Banknote size={14} aria-hidden="true" /> {t.orders.settle}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDetailNo(order.no)}
                          aria-label={t.orders.detailTitle(order.no)}
                        >
                          <ReceiptText size={14} aria-hidden="true" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePrint(order)} aria-label={t.orders.printReceipt(order.no)}>
                          <Printer size={14} aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={COLUMN_COUNT}>
                    <Empty title={filter === "unpaid" ? t.orders.emptyUnpaid : t.orders.empty} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentModal open={payingOrder !== null} order={payingOrder ?? undefined} onClose={() => setPayingOrder(null)} />

      {detailOrder && (
        <Modal size="sm" onClose={() => setDetailNo(null)}>
          <ModalHeader title={t.orders.detailTitle(detailOrder.no)} />
          <ModalBody>
            <OrderReceiptView order={detailOrder} />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setDetailNo(null)}>
              {t.common.close}
            </Button>
            <Button onClick={() => handlePrint(detailOrder)}>
              <Printer size={15} aria-hidden="true" /> {t.orders.print}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
