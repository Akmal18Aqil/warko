import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Armchair,
  Coffee,
  Edit,
  Plus,
  UtensilsCrossed,
  QrCode,
  ExternalLink,
  Copy,
  Printer,
  Check,
  Wifi,
  Banknote,
} from "lucide-react";
import { formatIDR } from "../data/menu";
import { t } from "../locales/en";
import { Header } from "../components/Header";
import { Button } from "../components/ui/Button";
import { TableModal } from "../components/TableModal";
import { PaymentModal } from "../components/PaymentModal";
import { usePos, type OrderRow, type TableRow } from "../components/PosContext";
import { cn } from "../lib/cn";
import { floorsOf, isPaid, KITCHEN_LABEL, kitchenStatusOf, openOrdersForTable } from "../lib/orderStatus";
import { printTableQrSheets, tableOrderUrl, tableQrDataUrl } from "../lib/tableQr";
import { toast } from "sonner";

export default function Tables() {
  const pos = usePos();
  const [, setLocation] = useLocation();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableRow | null>(null);
  const [activeAreaFilter, setActiveAreaFilter] = useState<string>("Semua");
  const [qrModalTable, setQrModalTable] = useState<TableRow | null>(null);
  const [qrImageDataUrl, setQrImageDataUrl] = useState<string>("");
  const [hasCopied, setHasCopied] = useState(false);
  const [payingOrder, setPayingOrder] = useState<OrderRow | null>(null);

  const availableAreas = useMemo(() => floorsOf(pos.tables), [pos.tables]);

  const filteredTables = useMemo(() => {
    const list = activeAreaFilter === "Semua" ? pos.tables : pos.tables.filter((tbl) => tbl.area === activeAreaFilter);
    return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [pos.tables, activeAreaFilter]);

  const occupancy = useMemo(() => {
    const map = new Map<string, OrderRow[]>();
    for (const table of pos.tables) map.set(table.id, openOrdersForTable(pos.orders, table));
    return map;
  }, [pos.orders, pos.tables]);

  const occupiedCount = filteredTables.filter((tbl) => (occupancy.get(tbl.id)?.length ?? 0) > 0).length;

  const handleOpenAdd = () => {
    setSelectedTable(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (table: TableRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTable(table);
    setModalOpen(true);
  };

  const handleOpenQr = (table: TableRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setQrModalTable(table);
    setHasCopied(false);
  };

  const handleSave = async (table: TableRow) => {
    if (selectedTable) {
      await pos.updateTable(table);
    } else {
      await pos.addTable(table);
    }
  };

  const handleDelete = async (id: string) => {
    if ((occupancy.get(id)?.length ?? 0) > 0) {
      throw new Error("Meja masih memiliki pesanan aktif atau belum dibayar.");
    }
    await pos.deleteTable(id);
  };

  const handleSelectTableAndOrder = (table: TableRow) => {
    pos.selectTable(table);
    setLocation("/");
  };

  const handlePrintQr = (tables: TableRow[]) => {
    printTableQrSheets(tables).catch((err: unknown) =>
      toast.error(err instanceof Error ? err.message : "QR meja gagal dicetak."),
    );
  };

  useEffect(() => {
    if (!qrModalTable) {
      setQrImageDataUrl("");
      return;
    }
    tableQrDataUrl(qrModalTable).then(setQrImageDataUrl).catch(console.error);
  }, [qrModalTable]);

  const handleCopyLink = () => {
    if (!qrModalTable) return;
    navigator.clipboard.writeText(tableOrderUrl(qrModalTable)).then(
      () => {
        setHasCopied(true);
        toast.success("Tautan QR Meja disalin ke clipboard!");
        setTimeout(() => setHasCopied(false), 2500);
      },
      () => toast.error("Clipboard tidak tersedia di browser ini."),
    );
  };

  return (
    <div className="service-rail-surface flex min-h-screen flex-col">
      <Header title={t.tablesPage.title} />
      <div className="flex-1 p-5 md:p-8">
        <div className="-mt-1 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-ink/55">{t.tablesPage.subtitle}</p>
            <p className="text-xs font-semibold text-ink/50">
              <span className="text-emerald-700">{filteredTables.length - occupiedCount} kosong</span>
              {" · "}
              <span className="text-amber-700">{occupiedCount} terisi</span>
              {" · "}
              {filteredTables.length} meja {activeAreaFilter === "Semua" ? "di semua lantai" : `di ${activeAreaFilter}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePrintQr(filteredTables)}
              disabled={filteredTables.length === 0}
              className="gap-1.5 font-bold"
            >
              <Printer size={15} />
              Cetak QR {activeAreaFilter === "Semua" ? "Semua Meja" : activeAreaFilter}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/pelayan")}
              className="gap-1.5 font-bold"
            >
              <UtensilsCrossed size={15} />
              Mode Pelayan Cepat
            </Button>
            <Button size="sm" onClick={handleOpenAdd} className="gap-1.5 font-bold">
              <Plus size={15} />
              Tambah Meja
            </Button>
          </div>
        </div>

        {/* Filter Area Tabs */}
        {availableAreas.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter lantai">
            <button
              type="button"
              onClick={() => setActiveAreaFilter("Semua")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                activeAreaFilter === "Semua"
                  ? "bg-ink font-semibold text-mineral shadow-xs"
                  : "border border-ink/10 bg-white text-ink/65 hover:bg-ink/5",
              )}
            >
              Semua ({pos.tables.length})
            </button>
            {availableAreas.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => setActiveAreaFilter(area)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  activeAreaFilter === area
                    ? "bg-ink font-semibold text-mineral shadow-xs"
                    : "border border-ink/10 bg-white text-ink/65 hover:bg-ink/5",
                )}
              >
                {area} ({pos.tables.filter((tbl) => tbl.area === area).length})
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTables.map((table) => {
            const openOrders = occupancy.get(table.id) ?? [];
            const drafting = pos.orderType === "meja" && pos.tableId === table.id && pos.lines.length > 0;
            const isOccupied = openOrders.length > 0;
            const unpaid = openOrders.filter((o) => !isPaid(o));
            const unpaidTotal = unpaid.reduce((sum, o) => sum + o.total, 0);

            return (
              <article
                key={table.id}
                onClick={() => handleSelectTableAndOrder(table)}
                className={cn(
                  "card-hover cursor-pointer rounded-2xl border-2 bg-white p-5 transition-all hover:shadow-md",
                  isOccupied ? "border-amber-400 bg-amber-50/60" : "border-emerald-400 bg-emerald-50/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl text-white",
                        isOccupied ? "bg-amber-500" : "bg-emerald-500",
                      )}
                    >
                      <Armchair size={21} aria-hidden="true" />
                    </span>
                    <span className="rounded-md bg-ink/6 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink/60">
                      {table.area}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Lihat & Cetak QR Meja Pelanggan"
                      aria-label={`QR ${table.name}`}
                      onClick={(e) => handleOpenQr(table, e)}
                      className="rounded-lg p-1.5 text-ink/50 hover:bg-accent/20 hover:text-ink transition-colors"
                    >
                      <QrCode size={17} />
                    </button>

                    <button
                      type="button"
                      aria-label={`Edit ${table.name}`}
                      onClick={(e) => handleOpenEdit(table, e)}
                      className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink"
                    >
                      <Edit size={15} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <h3 className="font-display text-base font-bold tracking-tight text-ink">
                    {table.name}
                  </h3>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      isOccupied ? "bg-amber-200 text-amber-900" : "bg-emerald-200 text-emerald-900",
                    )}
                  >
                    {isOccupied ? "Terisi" : t.tablesPage.empty}
                  </span>
                </div>

                <p className="mt-0.5 text-xs text-ink/50">
                  {t.tablesPage.seatsUnit(table.seats)}
                  {table.active === false ? " · nonaktif" : ""}
                </p>

                {isOccupied ? (
                  <div className="mt-3 space-y-1.5 border-t border-dashed border-ink/15 pt-3">
                    {openOrders.slice(0, 3).map((o) => (
                      <div key={o.no} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
                        <span className="min-w-0 truncate font-semibold text-ink">
                          #{o.no} · {KITCHEN_LABEL[kitchenStatusOf(o)]}
                        </span>
                        {isPaid(o) ? (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            Lunas
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayingOrder(o);
                            }}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white hover:bg-coral/90"
                          >
                            <Banknote size={11} /> Bayar {formatIDR(o.total)}
                          </button>
                        )}
                      </div>
                    ))}
                    {openOrders.length > 3 && (
                      <p className="text-[11px] text-ink/50">+{openOrders.length - 3} pesanan lain</p>
                    )}
                    {unpaid.length > 0 && (
                      <p className="text-[11px] font-bold text-coral">Belum dibayar: {formatIDR(unpaidTotal)}</p>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 border-t border-ink/6 pt-3 flex items-center justify-between text-xs text-ink/50">
                    <span>{drafting ? "Sedang diinput kasir" : "Meja Kosong"}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-ink/70 hover:underline">
                      <UtensilsCrossed size={12} /> Buka Pesanan
                    </span>
                  </div>
                )}
              </article>
            );
          })}

          <article className="card-hover rounded-2xl border border-ink/10 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white">
                <Coffee size={21} aria-hidden="true" />
              </span>
              <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-mineral">
                {t.station}
              </span>
            </div>
            <h3 className="mt-3 font-display text-base font-bold tracking-tight text-ink">
              {t.tablesPage.cashierStation}
            </h3>
            <p className="mt-0.5 text-xs text-ink/50">{t.cashier.name}</p>
          </article>
        </div>
      </div>

      {/* Table QR Modal */}
      {qrModalTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
                  <QrCode size={16} />
                </span>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-ink">QR Order · {qrModalTable.name}</h3>
                  <p className="text-[11px] text-ink/50">{qrModalTable.area}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQrModalTable(null)}
                className="text-ink/50 hover:text-ink"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-xs text-ink/60">
              Pelanggan cukup scan QR ini di meja untuk melihat menu dan memesan langsung.
            </p>

            {/* QR Code Container */}
            <div className="my-4 mx-auto flex h-60 w-60 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink/20 bg-slate-50 p-3 shadow-inner">
              {qrImageDataUrl ? (
                <img
                  src={qrImageDataUrl}
                  alt={`QR ${qrModalTable.name}`}
                  className="h-48 w-48 rounded-xl object-contain shadow-xs bg-white p-1.5"
                />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center">
                  <span className="text-xs text-ink/40 animate-pulse">Membuat QR...</span>
                </div>
              )}
              <span className="mt-1.5 text-xs font-bold text-ink tracking-wide">
                {qrModalTable.name} · {qrModalTable.area}
              </span>
            </div>

            {/* Direct URL display with LAN Wi-Fi badge */}
            <div className="rounded-xl bg-slate-100 p-2.5 text-left text-xs text-ink/80 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-accent-dark">
                <Wifi size={13} />
                <span>URL Akses HP & Wi-Fi:</span>
              </div>
              <div className="font-mono text-[11px] break-all text-ink/70">
                {tableOrderUrl(qrModalTable)}
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-4 space-y-2">
              <a
                href={tableOrderUrl(qrModalTable)}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent font-bold text-ink hover:bg-accent/90 text-xs shadow-sm"
              >
                <ExternalLink size={15} />
                Buka Tampilan Pelanggan
              </a>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="flex-1 gap-1.5 rounded-xl font-semibold text-xs"
                >
                  {hasCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {hasCopied ? "Tersalin!" : "Salin Link"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrintQr([qrModalTable])}
                  className="flex-1 gap-1.5 rounded-xl font-semibold text-xs"
                >
                  <Printer size={14} />
                  Cetak Stiker
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PaymentModal open={payingOrder !== null} order={payingOrder ?? undefined} onClose={() => setPayingOrder(null)} />

      <TableModal
        open={modalOpen}
        tableToEdit={selectedTable}
        availableAreas={availableAreas}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
