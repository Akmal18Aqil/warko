import { useEffect, useMemo, useRef, useState } from "react";
import { ScanLine, Search } from "lucide-react";
import { toast } from "sonner";
import type { MenuItem } from "../data/menu";
import { t } from "../locales/en";
import { Header } from "../components/Header";
import { MetricStrip } from "../components/MetricStrip";
import { ProductCard } from "../components/ProductCard";
import { CartPanel } from "../components/CartPanel";
import { PaymentModal } from "../components/PaymentModal";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { useBarcodeGunScanner } from "../hooks/useBarcodeGunScanner";
import { usePos } from "../components/PosContext";
import { cn } from "../lib/cn";

export default function Home() {
  const pos = usePos();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Semua");
  const [payOpen, setPayOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (
        !payOpen &&
        !scanOpen &&
        !typing &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        e.key.toLowerCase() === "p"
      ) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [payOpen, scanOpen]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pos.products.filter((item) => {
      const inCategory =
        category === "Semua" ||
        item.category === category ||
        (category === "Favorit" && item.badge !== undefined);
      const matchesQuery =
        q.length === 0 ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.barcode.includes(q);
      return inCategory && matchesQuery;
    });
  }, [pos.products, query, category]);

  const inOrderIds = useMemo(
    () => new Set(pos.lines.map((line) => line.itemId)),
    [pos.lines],
  );

  const handleAdd = (item: MenuItem) => {
    pos.addItem(item.id);
    if (!inOrderIds.has(item.id)) {
      toastAdd(item.name);
    }
  };

  const handleScanProduct = (item: MenuItem) => {
    pos.addItem(item.id);
  };

  const handleScanCode = (code: string) => {
    // Check if it was a table QR code
    const tableMatch = code.match(/order\/([a-zA-Z0-9_-]+)/) || code.match(/^meja[ -]?(\d+)$/i);
    if (tableMatch) {
      const slugOrNum = tableMatch[1].toLowerCase();
      const tbl = pos.tables.find(
        (t) =>
          t.name.toLowerCase().replace(/\s+/g, "-") === slugOrNum ||
          t.name.toLowerCase().includes(slugOrNum)
      );
      if (tbl) {
        pos.selectTable(tbl);
        toast.success(`Meja Berhasil Dipilih: ${tbl.name}`, {
          description: `Area ${tbl.area || "Utama"} diaktifkan untuk pesanan ini.`,
        });
      }
    }
  };

  const handleScanError = (code: string) => {
    toast.warning(t.scanner.notFound(code), {
      description: t.scanner.notFoundBody,
    });
  };

  // Passive USB / Bluetooth hardware barcode gun scanner listener
  useBarcodeGunScanner({
    enabled: !payOpen,
    onProductFound: (product) => {
      pos.addItem(product.id);
      toast.success(t.scanner.added(product.name), {
        description: `Barcode: ${product.barcode} (Scanner Gun)`,
      });
    },
    onProductNotFound: (code) => {
      handleScanCode(code);
    },
  });

  return (
    <div className="service-rail-surface flex min-h-screen flex-col min-[1200px]:h-screen min-[1200px]:overflow-hidden">
      <Header title={t.header.readyTitle} showSavedStatus />
      <div className="shrink-0 px-5 pt-5 md:px-10 md:pt-6">
        <MetricStrip />
      </div>

      <div className="flex flex-1 min-h-0 flex-col gap-8 p-5 md:px-10 md:pb-6 min-[1200px]:flex-row min-[1200px]:gap-8 min-[1200px]:overflow-hidden">
        <section aria-label={t.catalog.title} className="min-w-0 flex-1 flex flex-col min-h-0 min-[1200px]:overflow-hidden">
          <div className="shrink-0 space-y-4 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-caps text-[10px] font-bold text-ink/45">Menu Pass</p>
                <h2 className="font-display text-lg font-bold tracking-tight text-ink">
                  {t.catalog.title}
                </h2>
              </div>
              <div className="flex w-full max-w-md items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-ink/40"
                  />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    type="search"
                    aria-label={t.catalog.searchLabel}
                    placeholder={t.catalog.searchPlaceholder}
                    className="h-9.5 w-full rounded-lg border border-ink/15 bg-white pl-9 pr-3.5 text-xs text-ink placeholder:text-ink/40 focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-accent/60"
                  />
                </div>
                <button
                  type="button"
                  aria-label={t.scanner.open}
                  title={t.scanner.open}
                  onClick={() => setScanOpen(true)}
                  className="pressable flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-lg bg-accent text-white hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <ScanLine size={17} />
                </button>
                <kbd
                  aria-hidden="true"
                  className="kbd-hint shrink-0 rounded border border-ink/15 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink/50"
                >
                  {t.catalog.shortcutK}
                </kbd>
              </div>
            </div>

            <div role="tablist" aria-label="Kategori menu" className="flex flex-wrap gap-1.5">
              {["Semua", ...pos.categories.map((c) => c.name)].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={category === cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "pressable h-8 rounded-md px-3 text-xs font-semibold",
                    category === cat
                      ? "bg-accent font-bold text-white shadow-sm"
                      : "border border-ink/12 bg-surface text-ink/65 hover:border-ink/35 hover:text-ink",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 overflow-visible pr-1 min-[1200px]:flex-1 min-[1200px]:overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-ink/20 p-8 text-center">
                <p className="font-display font-semibold text-ink/70">
                  {t.catalog.emptyResult}
                </p>
                <p className="mt-1 text-sm text-ink/50">{t.catalog.emptyResultBody}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 pb-3 sm:grid-cols-2 min-[1500px]:grid-cols-3">
                {filteredItems.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    inOrder={inOrderIds.has(item.id)}
                    onAdd={handleAdd}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="h-auto w-full shrink-0 pb-16 md:pb-0 min-[1200px]:h-full min-[1200px]:w-[390px] min-[1536px]:w-[410px]">
          <CartPanel onPay={() => setPayOpen(true)} />
        </aside>
      </div>

      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} />
      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onProduct={handleScanProduct}
        onScanCode={handleScanCode}
        onError={handleScanError}
      />
    </div>
  );
}

function toastAdd(name: string) {
  toast.success(t.toasts.addedTitle(name), { description: t.toasts.addedBody });
}
