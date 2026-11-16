import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, Banknote, Calculator, FileDown, FileSpreadsheet, Printer, ReceiptText, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { formatIDR, isLowStock, isSoldOut } from "../data/menu";
import { t } from "../locales/en";
import { Header } from "../components/Header";
import { usePos, type OrderRow } from "../components/PosContext";
import { usePrint } from "../components/PrintContext";
import { Button } from "../components/ui/Button";
import { exportReportExcel, exportTransactionsCsv, summarizeSales } from "../lib/exporters";
import { loadOrdersInRange } from "../lib/repo";
import { tableLabel } from "../lib/orderStatus";
import { PAY_METHOD_LABEL } from "../lib/receipt";
import { cn } from "../lib/cn";

type Preset = "today" | "7d" | "30d" | "month" | "custom";

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 30_000;

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

const PRESETS: Array<[Preset, string]> = [
  ["today", "Hari ini"],
  ["7d", "7 hari"],
  ["30d", "30 hari"],
  ["month", "Bulan ini"],
  ["custom", "Pilih tanggal"],
];

/** Owner dashboard: live revenue metrics, best sellers, stock alerts, transaction history and exports. */
export default function Reports() {
  const { products, orders: liveOrders } = usePos();
  const { printReport } = usePrint();
  const [, setLocation] = useLocation();
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState(() => toDateInput(Date.now() - 6 * DAY_MS));
  const [customTo, setCustomTo] = useState(() => toDateInput(Date.now()));
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const reload = useCallback(async () => {
    try {
      setOrders(await loadOrdersInRange(range.from, range.to));
      setError(null);
      setUpdatedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Data laporan gagal dimuat.");
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

  const handleCsv = () => {
    exportTransactionsCsv(summary, periodSlug);
    toast.success("CSV transaksi diunduh");
  };

  const handleExcel = () => {
    exportReportExcel(summary, periodLabel, periodSlug);
    toast.success(t.data.exported, { description: t.data.exportedBody });
  };

  const handlePrint = () => {
    printReport({
      title: t.reportsPage.printTitle,
      period: periodLabel,
      rows: summary.buckets
        .filter((b) => b.orders > 0)
        .map((b) => ({ label: b.label, orders: b.orders, items: b.items, sales: formatIDR(b.sales) })),
      totalSales: formatIDR(summary.revenue),
      totalOrders: summary.transactions,
    });
  };

  const metrics = [
    { label: "Total Omset", value: formatIDR(summary.revenue), icon: Banknote },
    { label: "Jumlah Transaksi", value: String(summary.transactions), icon: ReceiptText },
    { label: "Rata-rata Transaksi", value: formatIDR(summary.average), icon: Calculator },
    { label: "Produk Terlaris", value: summary.topProducts[0]?.name ?? "-", icon: Trophy },
  ];

  return (
    <div className="service-rail-surface flex min-h-screen flex-col">
      <Header title="Dashboard Owner" />
      <div className="flex-1 space-y-5 p-5 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-ink/55">Omset dihitung dari transaksi lunas berdasarkan waktu pembayaran.</p>
            <p className="text-xs font-semibold text-ink/45" aria-live="polite">
              {periodLabel}
              {updatedAt ? ` · diperbarui ${new Date(updatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void reload()} aria-label="Muat ulang laporan">
              <RefreshCw size={15} className={cn(loading && "animate-spin")} aria-hidden="true" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleCsv} disabled={summary.transactions === 0}>
              <FileDown size={15} aria-hidden="true" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExcel} disabled={summary.transactions === 0}>
              <FileSpreadsheet size={15} aria-hidden="true" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={summary.transactions === 0}>
              <Printer size={15} aria-hidden="true" /> Cetak / PDF
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Periode laporan">
          {PRESETS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={preset === key}
              onClick={() => setPreset(key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                preset === key ? "bg-ink text-mineral" : "border border-ink/10 bg-white text-ink/65 hover:bg-ink/5",
              )}
            >
              {label}
            </button>
          ))}
          {preset === "custom" && (
            <span className="flex items-center gap-1.5 text-xs">
              <input type="date" aria-label="Dari tanggal" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 rounded-lg border border-ink/15 bg-white px-2" />
              –
              <input type="date" aria-label="Sampai tanggal" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} className="h-8 rounded-lg border border-ink/15 bg-white px-2" />
            </span>
          )}
        </div>

        {error && <p className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-2.5 text-xs font-semibold text-coral">{error}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ label, value, icon: Icon }) => (
            <article key={label} className="rounded-xl border border-ink/10 bg-white p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <h3 className="label-caps text-[11px] font-medium text-ink/55">{label}</h3>
              </div>
              <p className="mt-3 truncate font-display text-2xl font-bold tracking-tight text-ink" title={value}>
                {value}
              </p>
            </article>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <section aria-label="Grafik omset" className="rounded-xl border border-ink/10 bg-white p-5 xl:col-span-2">
            <h2 className="font-display text-sm font-bold text-ink">
              Grafik omset {summary.buckets.length === 24 ? "per jam" : "per hari"}
            </h2>
            {summary.transactions === 0 ? (
              <p className="py-12 text-center text-sm text-ink/50">{loading ? "Memuat…" : t.reportsPage.empty}</p>
            ) : (
              <div className="mt-4 flex h-48 items-end gap-1 overflow-x-auto rounded-lg bg-mineral/50 p-3">
                {summary.buckets.map((b) => (
                  <div key={b.key} className="flex h-full min-w-[18px] flex-1 flex-col items-center justify-end gap-1">
                    <div
                      title={`${b.label} — ${formatIDR(b.sales)} · ${b.orders} transaksi`}
                      className={cn("w-full rounded-t-md transition-all", b.sales > 0 ? "bg-accent hover:bg-ink" : "bg-ink/10")}
                      style={{ height: `${b.sales > 0 ? Math.max(6, (b.sales / maxBucket) * 100) : 2}%` }}
                    />
                    <span className="max-w-full truncate text-[9px] font-medium text-ink/50">{b.label}</span>
                  </div>
                ))}
              </div>
            )}
            {summary.byMethod.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {summary.byMethod.map((m) => (
                  <span key={m.method} className="rounded-lg bg-mineral px-2.5 py-1 font-semibold text-ink/70">
                    {m.method}: {formatIDR(m.sales)} ({m.orders})
                  </span>
                ))}
              </div>
            )}
          </section>

          <section aria-label="Produk terlaris" className="rounded-xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-sm font-bold text-ink">Produk terlaris</h2>
            {summary.topProducts.length === 0 ? (
              <p className="py-8 text-center text-xs text-ink/50">Belum ada penjualan.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {summary.topProducts.slice(0, 7).map((p, i) => (
                  <li key={p.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate font-semibold text-ink">
                      {i + 1}. {p.name}
                    </span>
                    <span className="shrink-0 text-ink/60">
                      {p.qty} porsi · {formatIDR(p.sales)}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <h2 className="mt-6 flex items-center gap-1.5 font-display text-sm font-bold text-ink">
              <AlertTriangle size={14} className="text-amber-600" aria-hidden="true" /> Sisa stok produk jadi
            </h2>
            {soldOut.length === 0 && lowStock.length === 0 ? (
              <p className="mt-2 text-xs text-ink/50">Semua stok aman.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs">
                {soldOut.map((p) => (
                  <li key={p.id} className="flex justify-between font-semibold text-coral">
                    <span>{p.name}</span>
                    <span>HABIS</span>
                  </li>
                ))}
                {lowStock.map((p) => (
                  <li key={p.id} className="flex justify-between text-amber-800">
                    <span>{p.name}</span>
                    <span>Sisa {p.stock}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setLocation("/produk")}>
              Kelola stok
            </Button>
          </section>
        </div>

        <section aria-label="Riwayat transaksi" className="rounded-xl border border-ink/10 bg-white p-5">
          <h2 className="font-display text-sm font-bold text-ink">Riwayat transaksi ({summary.transactions})</h2>
          <div className="mt-3 max-h-[480px] overflow-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-ink/10 text-[11px] text-ink/50">
                  <th scope="col" className="py-2">No</th>
                  <th scope="col" className="py-2">Dibayar</th>
                  <th scope="col" className="py-2">Meja</th>
                  <th scope="col" className="py-2">Metode</th>
                  <th scope="col" className="py-2">Kasir</th>
                  <th scope="col" className="py-2 text-right">Item</th>
                  <th scope="col" className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.paid.map((o) => (
                  <tr key={o.no} className="border-b border-ink/6 last:border-0">
                    <td className="py-2 font-bold text-ink">#{o.no}</td>
                    <td className="py-2 text-ink/70">
                      {o.paidAt ? new Date(o.paidAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "-"}
                    </td>
                    <td className="py-2 text-ink/70">{tableLabel(o)}</td>
                    <td className="py-2 text-ink/70">{o.method ? PAY_METHOD_LABEL[o.method] : "-"}</td>
                    <td className="py-2 text-ink/70">{o.paidBy ?? "-"}</td>
                    <td className="py-2 text-right text-ink/70">{o.itemCount}</td>
                    <td className="py-2 text-right font-display font-bold text-ink">{formatIDR(o.total)}</td>
                  </tr>
                ))}
                {summary.transactions === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-ink/50">
                      {t.reportsPage.empty}
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
