import { ScanLine, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Header } from "../../app/Header";
import type { MenuItem } from "../../data/menu";
import { useBarcodeGunScanner } from "../../hooks/useBarcodeGunScanner";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { parseTableQr, resolveTable } from "../../lib/tableQr";
import { t } from "../../locales/id";
import { addItem, selectTable, useCart } from "../../state/cart";
import { useCategories, useProducts, useTables } from "../../state/catalog";
import { IconButton } from "../../ui/Button";
import { Empty } from "../../ui/Empty";
import { Input } from "../../ui/Input";
import { Modal } from "../../ui/Modal";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { BarcodeScanner } from "../scanner/BarcodeScanner";
import { CartPanel } from "./CartPanel";
import { PaymentModal } from "./PaymentModal";
import { PosCartBar } from "./PosCartBar";
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
  const [cartOpen, setCartOpen] = useState(false);
  const cartCloseRef = useRef<HTMLButtonElement>(null);
  const searchId = useId();
  // Wide screens keep the ticket beside the catalog; narrower ones reach it through the cart bar and sheet.
  const railCart = useMediaQuery(RAIL_CART_QUERY);

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

  const qtyById = useMemo(() => new Map(lines.map((line) => [line.itemId, line.qty])), [lines]);

  const handleAdd = (item: MenuItem) => {
    addItem(item.id);
    // On narrow screens the cart bar and the card badge already show the change; a toast would cover the catalog.
    if (railCart && !qtyById.has(item.id)) {
      toastAdd(item.name);
    }
  };

  const openPayment = () => {
    setCartOpen(false);
    setPayOpen(true);
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
      <div className="hidden shrink-0 px-5 pt-5 md:block md:px-10 md:pt-6">
        <PosMetricStrip />
      </div>

      <div className="flex flex-1 min-h-0 flex-col gap-8 px-5 pb-5 md:px-10 md:pb-6 min-[1200px]:flex-row min-[1200px]:gap-8 min-[1200px]:overflow-hidden min-[1200px]:pt-5">
        <section aria-label={t.pos.catalog.title} className="min-w-0 flex-1 flex flex-col min-h-0 min-[1200px]:overflow-hidden">
          <div className="sticky top-0 z-20 -mx-5 shrink-0 space-y-3 bg-mineral/95 px-5 py-3 backdrop-blur md:max-[1199px]:-mx-10 md:max-[1199px]:px-10 min-[1200px]:static min-[1200px]:mx-0 min-[1200px]:space-y-4 min-[1200px]:bg-transparent min-[1200px]:px-0 min-[1200px]:pb-2 min-[1200px]:pt-0 min-[1200px]:backdrop-blur-none">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="max-[1199px]:sr-only">
                <p className="label-caps text-2xs font-bold text-text-muted">{t.pos.catalog.eyebrow}</p>
                <h2 className="font-display text-lg font-bold tracking-tight text-ink">{t.pos.catalog.title}</h2>
              </div>
              <div className="flex w-full items-center gap-2 min-[1200px]:max-w-md">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-text-light"
                  />
                  <Input
                    id={searchId}
                    size={railCart ? "sm" : "lg"}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label={t.pos.catalog.searchLabel}
                    placeholder={t.pos.catalog.searchPlaceholder}
                    className={railCart ? "h-9.5 pl-9" : "pl-9"}
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
              className="scrollbar-none flex-nowrap overflow-x-auto *:min-h-10 *:flex-none *:whitespace-nowrap min-[1200px]:flex-wrap min-[1200px]:*:min-h-9 min-[1200px]:*:flex-1"
            />
          </div>

          <div className="min-h-0 overflow-visible pt-2 min-[1200px]:flex-1 min-[1200px]:overflow-y-auto min-[1200px]:pr-1 min-[1200px]:pt-0">
            {filteredItems.length === 0 ? (
              <Empty
                className="mt-6 rounded-xl border border-dashed border-border"
                title={t.pos.catalog.emptyResult}
                subtitle={t.pos.catalog.emptyResultBody}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 pb-3 sm:gap-5 md:max-[1199px]:grid-cols-3 min-[1500px]:grid-cols-3">
                {filteredItems.map((item) => (
                  <ProductCard key={item.id} item={item} qty={qtyById.get(item.id) ?? 0} onAdd={handleAdd} />
                ))}
              </div>
            )}
          </div>
        </section>

        {railCart && (
          <aside className="h-full w-[390px] shrink-0 min-[1536px]:w-[410px]">
            <CartPanel onPay={openPayment} />
          </aside>
        )}
      </div>

      {!railCart && lines.length > 0 && <PosCartBar onOpen={() => setCartOpen(true)} />}
      {!railCart && cartOpen && (
        <Modal onClose={() => setCartOpen(false)} placement="sheet" ariaLabel={t.pos.cart.title} initialFocusRef={cartCloseRef}>
          <CartPanel onPay={openPayment} onClose={() => setCartOpen(false)} closeRef={cartCloseRef} />
        </Modal>
      )}

      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} />
      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onProduct={handleScanProduct} onScanCode={handleScanCode} />
    </div>
  );
}

const ALL_CATEGORIES = t.pos.catalog.allCategories;
const RAIL_CART_QUERY = "(min-width: 1200px)";

function toastAdd(name: string) {
  toast.success(t.pos.toasts.addedTitle(name), { description: t.pos.toasts.addedBody });
}
