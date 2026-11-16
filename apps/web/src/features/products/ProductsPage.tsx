import { useMemo, useState } from "react";
import { AlertTriangle, Layers, Plus, ScanLine, Search, Tag } from "lucide-react";
import { toast } from "sonner";
import { CATALOG_WRITE_ROLES } from "@wakro/shared";
import { isLowStock, isSoldOut, LOW_STOCK_THRESHOLD, type MenuItem } from "../../data/menu";
import { useBarcodeGunScanner } from "../../hooks/useBarcodeGunScanner";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import { useCategories, useProducts } from "../../state/catalog";
import { Header } from "../../app/Header";
import { useCan } from "../../app/useCan";
import { Button, IconButton } from "../../ui/Button";
import { Empty } from "../../ui/Empty";
import { Input } from "../../ui/Input";
import { PageHeader } from "../../ui/PageHeader";
import { BarcodeScanner } from "../scanner/BarcodeScanner";
import { CategoryManagerModal } from "./CategoryManagerModal";
import { ProductModal } from "./ProductModal";
import { ProductRow } from "./ProductRow";
import { useProductCounts } from "./useProductCounts";
import { StockModal } from "./StockModal";

type StockFilter = "all" | "alert";

/** What the product form is doing: closed, adding a new product, or editing `item`. */
type FormState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; item: MenuItem };

export default function ProductsPage() {
  const products = useProducts();
  const categories = useCategories();
  const countByCategory = useProductCounts();
  const [query, setQuery] = useState("");
  /** `null` shows every category. */
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [stockItemId, setStockItemId] = useState<string | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const canEditCatalog = useCan(CATALOG_WRITE_ROLES);
  const text = t.products;

  const soldOutCount = products.filter(isSoldOut).length;
  const lowCount = products.filter(isLowStock).length;
  const stockItem = stockItemId ? products.find((p) => p.id === stockItemId) : undefined;

  const showProduct = (barcode: string) => {
    setQuery(barcode);
    setCategoryFilter(null);
  };

  // Passive USB / Bluetooth hardware scanner listener in the catalog.
  useBarcodeGunScanner({
    enabled: form.mode === "closed" && !categoryManagerOpen && !scannerOpen && !stockItem,
    onProductFound: (product) => {
      showProduct(product.barcode);
      toast.success(text.gun.found(product.name), { description: text.gun.foundDetail(product.barcode, product.category) });
    },
    onProductNotFound: (code) => {
      setQuery(code);
      toast.info(text.gun.searching(code));
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((item) => {
      const matchQuery =
        q.length === 0 ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.barcode.includes(q);
      const matchCategory = categoryFilter === null || item.category === categoryFilter;
      const matchStock = stockFilter === "all" || isSoldOut(item) || isLowStock(item);
      return matchQuery && matchCategory && matchStock;
    });
  }, [products, query, categoryFilter, stockFilter]);

  const chipClass = (active: boolean) =>
    cn(
      "flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all",
      active ? "border-accent-dark bg-accent font-bold text-white shadow-sm" : "border-border bg-surface text-ink/60 hover:text-ink",
    );

  return (
    <div className="service-rail-surface flex min-h-screen flex-col">
      <Header title={text.title} />
      <div className="mx-auto w-full max-w-7xl flex-1 space-y-5 p-5 md:p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <PageHeader subtitle={text.subtitle} className="mb-0">
            <p className="text-xs font-semibold text-text-light">{text.summary(products.length, categories.length)}</p>
            {!canEditCatalog && <p className="mt-0.5 text-xs font-semibold text-text-muted">{text.readOnlyNote}</p>}
          </PageHeader>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-light"
                />
                <Input
                  type="search"
                  size="sm"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label={text.searchPlaceholder}
                  placeholder={text.searchPlaceholder}
                  className="w-40 pl-9 shadow-clay sm:w-52"
                />
              </div>
              <IconButton
                label={text.scanBarcode}
                onClick={() => setScannerOpen(true)}
                className="shrink-0 border border-border bg-surface hover:border-accent-dark hover:bg-accent hover:text-white"
              >
                <ScanLine size={17} aria-hidden="true" />
              </IconButton>
            </div>

            {canEditCatalog && (
              <>
                <Button variant="outline" size="sm" onClick={() => setCategoryManagerOpen(true)} className="font-semibold">
                  <Layers size={15} className="text-accent-dark" aria-hidden="true" />
                  {text.manageCategories}
                </Button>

                <Button size="sm" onClick={() => setForm({ mode: "add" })} className="font-semibold">
                  <Plus size={15} aria-hidden="true" />
                  {text.addNew}
                </Button>
              </>
            )}
          </div>
        </div>

        {(soldOutCount > 0 || lowCount > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warning/60 bg-warning/10 px-4 py-3 text-warning-dark">
            <p className="flex items-center gap-2 text-xs font-semibold">
              <AlertTriangle size={16} aria-hidden="true" />
              {soldOutCount > 0 && <span>{text.stockAlert.soldOut(soldOutCount)}</span>}
              {lowCount > 0 && <span>{text.stockAlert.low(lowCount, LOW_STOCK_THRESHOLD)}</span>}
            </p>
            <Button size="sm" variant="outline" onClick={() => setStockFilter(stockFilter === "alert" ? "all" : "alert")}>
              {stockFilter === "alert" ? text.stockAlert.showAll : text.stockAlert.showRestock}
            </Button>
          </div>
        )}

        <div role="group" aria-label={text.categoryFilterLabel} className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button type="button" aria-pressed={categoryFilter === null} onClick={() => setCategoryFilter(null)} className={chipClass(categoryFilter === null)}>
            {text.filterAll(products.length)}
          </button>
          {categories.map((cat) => {
            const selected = categoryFilter === cat.name;
            return (
              <button key={cat.id} type="button" aria-pressed={selected} onClick={() => setCategoryFilter(cat.name)} className={chipClass(selected)}>
                <span>{cat.name}</span>
                <span className={cn("rounded-full px-1.5 text-2xs", selected ? "bg-ink/10 text-ink" : "bg-mineral text-ink/50")}>
                  {countByCategory.get(cat.name) ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface shadow-clay">
            <Empty
              icon={<Tag size={24} aria-hidden="true" />}
              title={text.empty.title}
              subtitle={text.empty.subtitle}
              action={
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCategoryFilter(null);
                      setStockFilter("all");
                      setQuery("");
                    }}
                  >
                    {text.empty.reset}
                  </Button>
                  {canEditCatalog && (
                    <Button size="sm" onClick={() => setForm({ mode: "add" })}>
                      <Plus size={14} aria-hidden="true" />
                      {text.empty.addProduct}
                    </Button>
                  )}
                </div>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-clay">
            {filtered.map((item) => (
              <ProductRow
                key={item.id}
                item={item}
                onStock={() => setStockItemId(item.id)}
                onEdit={canEditCatalog ? () => setForm({ mode: "edit", item }) : undefined}
              />
            ))}
          </ul>
        )}
      </div>

      {stockItem && <StockModal item={stockItem} onClose={() => setStockItemId(null)} />}

      {form.mode !== "closed" && (
        <ProductModal itemToEdit={form.mode === "edit" ? form.item : null} onClose={() => setForm({ mode: "closed" })} />
      )}

      {categoryManagerOpen && <CategoryManagerModal onClose={() => setCategoryManagerOpen(false)} />}

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title={text.scanner.title}
        subtitle={text.scanner.subtitle}
        onScanCode={(code) => {
          setQuery(code);
          setScannerOpen(false);
        }}
        onProduct={(product) => {
          showProduct(product.barcode);
          setScannerOpen(false);
        }}
      />
    </div>
  );
}
