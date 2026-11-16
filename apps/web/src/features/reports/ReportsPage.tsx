import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, Banknote, Calculator, FileDown, FileSpreadsheet, Printer, ReceiptText, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { formatIDR, isLowStock, isSoldOut } from "../../data/menu";
import { t } from "../../locales/id";
import { Header } from "../../app/Header";
import { dataSource } from "../../data/index";
import { useProducts } from "../../state/catalog";
import { useOrders } from "../../state/orders";
import type { OrderRow } from "../../types/domain";
import { usePrint } from "../../state/print";
import { Button } from "../../ui/Button";
import { Empty } from "../../ui/Empty";
import { Input } from "../../ui/Input";
import { MetricCell, MetricStrip } from "../../ui/MetricStrip";
import { PageHeader } from "../../ui/PageHeader";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { LoadingText } from "../../ui/Spinner";
import { exportReportExcel, exportTransactionsCsv, summarizeSales } from "../../lib/exporters";
import { tableLabel } from "../../lib/orderStatus";
import { PAY_METHOD_LABEL } from "../../lib/receipt";
import { cn } from "../../lib/cn";
import { STORE_PROFILE } from "../../lib/storeProfile";

type Preset = keyof typeof t.reports.presets;

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 30_000;
const DEFAULT_CUSTOM_SPAN_DAYS = 6;
const TOP_PRODUCTS_SHOWN = 7;
const HOURLY_BUCKET_COUNT = 24;
const MIN_BAR_PERCENT = 6;
const EMPTY_BAR_PERCENT = 2;
const HISTORY_COLUMN_COUNT = 7;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function toDateInput(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** [from, to) in local time for a preset or custom date inputs. */
function rangeFor(preset: Preset, customFrom: string, customTo: string): { from: number; to: number } {
  const today = startOfDay(Date.now());
  switch (preset) {
    case "today":
      return { from: today, to: today + DAY_MS };
    case "7d":
      return { from: today - 6 * DAY_MS, to: today + DAY_MS };
    case "30d":
      return { from: today - 29 * DAY_MS, to: today + DAY_MS };
    case "month": {
      const d = new Date(today);
      d.setDate(1);
      return { from: d.getTime(), to: today + DAY_MS };
    }
    case "custom": {
      const from = new Date(`${customFrom}T00:00:00`).getTime();
      const to = new Date(`${customTo}T00:00:00`).getTime() + DAY_MS;
      return Number.isFinite(from) && Number.isFinite(to) && to > from ? { from, to } : { from: today, to: today + DAY_MS };
    }
  }
}

const PRESET_TABS = (Object.keys(t.reports.presets) as Preset[]).map((id) => ({ id, label: t.reports.presets[id] }));

/** Owner dashboard: live revenue metrics, best sellers, stock alerts, transaction history and exports. */
export default function ReportsPage() {
  const products = useProducts();
  const liveOrders = useOrders();
  const { printReport } = usePrint();
  const [, setLocation] = useLocation();
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState(() => toDateInput(Date.now() - DEFAULT_CUSTOM_SPAN_DAYS * DAY_MS));
  const [customTo, setCustomTo] = useState(() => toDateInput(Date.now()));
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const reload = useCallback(async () => {
    try {
      setOrders(await dataSource.loadOrdersInRange(range.from, range.to));
      setError(null);
      setUpdatedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : t.reports.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  // Reload on range change, on new live orders/payments, and periodically.
  const liveSignature = liveOrders.map((o) => `${o.no}:${o.paymentStatus}`).join(",");
  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload, liveSignature]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void reload();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  const summary = useMemo(() => summarizeSales(orders, range.from, range.to), [orders, range.from, range.to]);
  const maxBucket = Math.max(1, ...summary.buckets.map((b) => b.sales));
  const soldOut = products.filter(isSoldOut);
  const lowStock = products.filter(isLowStock);

  const periodLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
    const last = range.to - DAY_MS;
    return last <= range.from ? fmt.format(range.from) : `${fmt.format(range.from)} – ${fmt.format(last)}`;
  }, [range.from, range.to]);
  const periodSlug = `${toDateInput(range.from)}_${toDateInput(range.to - DAY_MS)}`;
  const updatedLabel = updatedAt
    ? t.reports.updatedAt(new Date(updatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    : "";
  const hasSales = summary.transactions > 0;

  const handleCsv = () => {
    exportTransactionsCsv(summary, periodSlug);
    toast.success(t.reports.csvExported);
  };

  const handleExcel = async () => {
    try {
      await exportReportExcel(summary, periodLabel, periodSlug);
      toast.success(t.reports.exported, { description: t.reports.exportedBody });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.reports.excelFailed);
    }
  };

  const handlePrint = () => {
    printReport({
      title: `${STORE_PROFILE.brand} · ${t.printing.salesReport.title}`,
      period: periodLabel,
      rows: summary.buckets
        .filter((b) => b.orders > 0)
        .map((b) => ({ label: b.label, orders: b.orders, items: b.items, sales: formatIDR(b.sales) })),
      totalSales: formatIDR(summary.revenue),
      totalOrders: summary.transactions,
    });
  };

  return (
    <div className="service-rail-surface flex min-h-screen flex-col">
      <Header title={t.reports.title} />
      <div className="flex-1 space-y-5 p-5 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageHeader className="mb-1" subtitle={t.reports.subtitle} subtitleClassName="text-sm" />
            <p className="text-xs font-semibold text-ink/45" aria-live="polite">
              {periodLabel}
              {updatedLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void reload()} aria-label={t.reports.reload}>
              <RefreshCw size={15} className={cn(loading && "animate-spin")} aria-hidden="true" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleCsv} disabled={!hasSales}>
              <FileDown size={15} aria-hidden="true" /> {t.reports.exportCsv}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleExcel()} disabled={!hasSales}>
              <FileSpreadsheet size={15} aria-hidden="true" /> {t.reports.exportExcel}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!hasSales}>
              <Printer size={15} aria-hidden="true" /> {t.reports.exportPrint}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <SegmentedTabs<Preset> tabs={PRESET_TABS} value={preset} onChange={setPreset} label={t.reports.periodGroup} />
          {preset === "custom" && (
            <div className="flex items-end gap-2">
              <Input
                type="date"
                size="sm"
                label={t.reports.dateFrom}
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <Input
                type="date"
                size="sm"
                label={t.reports.dateTo}
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-error/40 bg-error/10 px-4 py-2.5 text-xs font-semibold text-error-dark">
            {error}
          </p>
        )}

        <MetricStrip label={t.reports.metricsLabel}>
          <MetricCell label={t.reports.metrics.revenue} value={formatIDR(summary.revenue)} icon={<Banknote size={18} aria-hidden="true" />} tone="accent" />
          <MetricCell label={t.reports.metrics.transactions} value={summary.transactions} icon={<ReceiptText size={18} aria-hidden="true" />} />
          <MetricCell label={t.reports.metrics.average} value={formatIDR(summary.average)} icon={<Calculator size={18} aria-hidden="true" />} />
          <MetricCell
            label={t.reports.metrics.topProduct}
            value={summary.topProducts[0]?.name ?? t.reports.none}
            icon={<Trophy size={18} aria-hidden="true" />}
          />
        </MetricStrip>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <section aria-label={t.reports.chart.label} className="rounded-xl border border-ink/10 bg-surface p-5 shadow-clay xl:col-span-2">
            <h2 className="font-display text-sm font-bold text-ink">
              {summary.buckets.length === HOURLY_BUCKET_COUNT ? t.reports.chart.perHour : t.reports.chart.perDay}
            </h2>
            {!hasSales ? (
              loading ? <LoadingText className="justify-center py-12" /> : <Empty title={t.reports.empty} className="py-8" />
            ) : (
              <div className="mt-4 flex h-48 items-end gap-1 overflow-x-auto rounded-lg bg-mineral/50 p-3">
                {summary.buckets.map((b) => (
                  <div key={b.key} className="flex h-full min-w-[18px] flex-1 flex-col items-center justify-end gap-1">
                    <div
                      title={t.reports.chart.bucketTitle(b.label, formatIDR(b.sales), b.orders)}
                      className={cn("w-full rounded-t-md transition-all", b.sales > 0 ? "bg-accent hover:bg-ink" : "bg-ink/10")}
                      style={{ height: `${b.sales > 0 ? Math.max(MIN_BAR_PERCENT, (b.sales / maxBucket) * 100) : EMPTY_BAR_PERCENT}%` }}
                    />
                    <span className="max-w-full truncate text-2xs font-medium text-ink/50">{b.label}</span>
                  </div>
                ))}
              </div>
            )}
            {summary.byMethod.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {summary.byMethod.map((m) => (
                  <span key={m.method} className="rounded-lg bg-mineral px-2.5 py-1 font-semibold text-ink/70">
                    {t.reports.chart.method(m.method, formatIDR(m.sales), m.orders)}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section aria-label={t.reports.topProducts.title} className="rounded-xl border border-ink/10 bg-surface p-5 shadow-clay">
            <h2 className="font-display text-sm font-bold text-ink">{t.reports.topProducts.title}</h2>
            {summary.topProducts.length === 0 ? (
              <Empty title={t.reports.topProducts.empty} className="py-6" />
            ) : (
              <ol className="mt-3 space-y-2">
                {summary.topProducts.slice(0, TOP_PRODUCTS_SHOWN).map((p, i) => (
                  <li key={p.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate font-semibold text-ink">
                      {i + 1}. {p.name}
                    </span>
                    <span className="shrink-0 text-ink/60">{t.reports.topProducts.sold(p.qty, formatIDR(p.sales))}</span>
                  </li>
                ))}
              </ol>
            )}

            <h2 className="mt-6 flex items-center gap-1.5 font-display text-sm font-bold text-ink">
              <AlertTriangle size={14} className="text-warning-dark" aria-hidden="true" /> {t.reports.stock.title}
            </h2>
            {soldOut.length === 0 && lowStock.length === 0 ? (
              <p className="mt-2 text-xs text-ink/50">{t.reports.stock.safe}</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs">
                {soldOut.map((p) => (
                  <li key={p.id} className="flex justify-between font-semibold text-error-dark">
                    <span>{p.name}</span>
                    <span>{t.reports.stock.soldOut}</span>
                  </li>
                ))}
                {lowStock.map((p) => (
                  <li key={p.id} className="flex justify-between text-warning-dark">
                    <span>{p.name}</span>
                    <span>{t.reports.stock.left(p.stock ?? 0)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setLocation("/produk")}>
              {t.reports.stock.manage}
            </Button>
          </section>
        </div>

        <section aria-label={t.reports.history.label} className="rounded-xl border border-ink/10 bg-surface p-5 shadow-clay">
          <h2 className="font-display text-sm font-bold text-ink">{t.reports.history.title(summary.transactions)}</h2>
          <div className="mt-3 max-h-[480px] overflow-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-ink/10 text-xs2 text-ink/50">
                  <th scope="col" className="py-2">{t.reports.history.columns.no}</th>
                  <th scope="col" className="py-2">{t.reports.history.columns.paidAt}</th>
                  <th scope="col" className="py-2">{t.reports.history.columns.table}</th>
                  <th scope="col" className="py-2">{t.reports.history.columns.method}</th>
                  <th scope="col" className="py-2">{t.reports.history.columns.cashier}</th>
                  <th scope="col" className="py-2 text-right">{t.reports.history.columns.items}</th>
                  <th scope="col" className="py-2 text-right">{t.reports.history.columns.total}</th>
                </tr>
              </thead>
              <tbody>
                {summary.paid.map((o) => (
                  <tr key={o.no} className="border-b border-ink/6 last:border-0">
                    <td className="py-2 font-bold text-ink">#{o.no}</td>
                    <td className="py-2 text-ink/70">
                      {o.paidAt ? new Date(o.paidAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : t.reports.none}
                    </td>
                    <td className="py-2 text-ink/70">{tableLabel(o)}</td>
                    <td className="py-2 text-ink/70">{o.method ? PAY_METHOD_LABEL[o.method] : t.reports.none}</td>
                    <td className="py-2 text-ink/70">{o.paidBy ?? t.reports.none}</td>
                    <td className="py-2 text-right text-ink/70">{o.itemCount}</td>
                    <td className="py-2 text-right font-display font-bold text-ink">{formatIDR(o.total)}</td>
                  </tr>
                ))}
                {!hasSales && (
                  <tr>
                    <td colSpan={HISTORY_COLUMN_COUNT}>
                      <Empty title={t.reports.empty} className="py-6" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
