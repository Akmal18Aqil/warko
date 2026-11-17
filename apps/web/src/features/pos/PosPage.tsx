import { ScanLine, Search } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Header } from "../../app/Header";
import type { MenuItem } from "../../data/menu";
import { useBarcodeGunScanner } from "../../hooks/useBarcodeGunScanner";
import { parseTableQr, resolveTable } from "../../lib/tableQr";
import { t } from "../../locales/id";
import { addItem, selectTable, useCart } from "../../state/cart";
import { useCategories, useProducts, useTables } from "../../state/catalog";
import { IconButton } from "../../ui/Button";
import { Empty } from "../../ui/Empty";
import { Input } from "../../ui/Input";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { BarcodeScanner } from "../scanner/BarcodeScanner";
import { CartPanel } from "./CartPanel";
import { PaymentModal } from "./PaymentModal";
import { PosMetricStrip } from "./PosMetricStrip";
import { ProductCard } from "./ProductCard";

export default function PosPage() {
  const products = useProducts();
  const categories = useCategories();
  const tables = useTables();
  const { lines } = useCart();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [payOpen, setPayOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const searchId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById(searchId)?.focus();
        return;
      }
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);
      if (!payOpen && !scanOpen && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [payOpen, scanOpen, searchId]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((item) => {
      const inCategory = category === ALL_CATEGORIES || item.category === category;
      const matchesQuery =
        q.length === 0 || item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q) || item.barcode.includes(q);
      return inCategory && matchesQuery;
    });
  }, [products, query, category]);

  const inOrderIds = useMemo(() => new Set(lines.map((line) => line.itemId)), [lines]);

  const handleAdd = (item: MenuItem) => {
    addItem(item.id);
    if (!inOrderIds.has(item.id)) {
      toastAdd(item.name);
    }
  };

  const handleScanProduct = (item: MenuItem) => {
    addItem(item.id);
  };

  const handleScanCode = (code: string) => {
    const tableKey = parseTableQr(code);
    if (tableKey === null) return;
    const table = resolveTable(tables, tableKey);
    if (!table) {
      toast.error(t.pos.scan.tableNotFound);
      return;
    }
    selectTable(table);
    toast.success(t.pos.scan.tableSelected(table.name), {
      description: t.pos.scan.tableSelectedBody(table.area),
    });
  };

  // Passive USB / Bluetooth hardware barcode gun scanner listener
  useBarcodeGunScanner({
    enabled: !payOpen,
    onProductFound: (product) => {
      addItem(product.id);
      toast.success(t.scanner.added(product.name), {
        description: t.pos.scan.gunBody(product.barcode),
      });
    },
    onProductNotFound: (code) => {
      handleScanCode(code);
    },
  });

  return (
    <div className="service-rail-surface flex min-h-screen flex-col min-[1200px]:h-screen min-[1200px]:overflow-hidden">
      <Header title={t.app.header.readyTitle} showSavedStatus />
      <div className="shrink-0 px-5 pt-5 md:px-10 md:pt-6">
        <PosMetricStrip />
      </div>

      <div className="flex flex-1 min-h-0 flex-col gap-8 p-5 md:px-10 md:pb-6 min-[1200px]:flex-row min-[1200px]:gap-8 min-[1200px]:overflow-hidden">
        <section aria-label={t.pos.catalog.title} className="min-w-0 flex-1 flex flex-col min-h-0 min-[1200px]:overflow-hidden">
          <div className="shrink-0 space-y-4 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-caps text-2xs font-bold text-text-muted">{t.pos.catalog.eyebrow}</p>
                <h2 className="font-display text-lg font-bold tracking-tight text-ink">{t.pos.catalog.title}</h2>
              </div>
              <div className="flex w-full max-w-md items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-text-light"
                  />
                  <Input
                    id={searchId}
                    size="sm"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label={t.pos.catalog.searchLabel}
                    placeholder={t.pos.catalog.searchPlaceholder}
                    className="h-9.5 pl-9"
                  />
                </div>
                <IconButton
                  label={t.scanner.open}
                  onClick={() => setScanOpen(true)}
                  className="h-9.5 min-h-9.5 w-9.5 min-w-9.5 shrink-0 rounded-lg bg-accent text-white hover:bg-accent-dark hover:text-white"
                >
                  <ScanLine size={17} aria-hidden="true" />
                </IconButton>
                <span
                  aria-hidden="true"
                  className="kbd-hint font-mono shrink-0 rounded border border-border bg-surface px-1.5 py-0.5 text-2xs font-semibold text-text-muted"
                >
                  {t.pos.catalog.shortcutK}
                </span>
              </div>
            </div>

            <SegmentedTabs
              label={t.pos.catalog.categoriesLabel}
              tabs={[ALL_CATEGORIES, ...categories.map((c) => c.name)].map((name) => ({ id: name, label: name }))}
              value={category}
              onChange={setCategory}
              className="flex-wrap"
            />
          </div>

          <div className="min-h-0 overflow-visible pr-1 min-[1200px]:flex-1 min-[1200px]:overflow-y-auto">
            {filteredItems.length === 0 ? (
              <Empty
                className="mt-6 rounded-xl border border-dashed border-border"
                title={t.pos.catalog.emptyResult}
                subtitle={t.pos.catalog.emptyResultBody}
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 pb-3 sm:grid-cols-2 min-[1500px]:grid-cols-3">
                {filteredItems.map((item) => (
                  <ProductCard key={item.id} item={item} inOrder={inOrderIds.has(item.id)} onAdd={handleAdd} />
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
      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onProduct={handleScanProduct} onScanCode={handleScanCode} />
    </div>
  );
}

const ALL_CATEGORIES = t.pos.catalog.allCategories;

function toastAdd(name: string) {
  toast.success(t.pos.toasts.addedTitle(name), { description: t.pos.toasts.addedBody });
}
