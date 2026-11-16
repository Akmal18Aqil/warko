import { useMemo, useState } from "react";
import { Plus, Search, Layers, Tag, ScanLine, PackageCheck, AlertTriangle } from "lucide-react";
import { formatIDR, isLowStock, isSoldOut, LOW_STOCK_THRESHOLD, type MenuItem } from "../data/menu";
import { t } from "../locales/en";
import { Header } from "../components/Header";
import { FoodImage } from "../components/FoodImage";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ProductModal } from "../components/ProductModal";
import { CategoryManagerModal } from "../components/CategoryManagerModal";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { useBarcodeGunScanner } from "../hooks/useBarcodeGunScanner";
import { usePos } from "../components/PosContext";
import { toast } from "sonner";
import { cn } from "../lib/cn";

export default function Products() {
  const { products, categories, addProduct, updateProduct, deleteProduct, adjustStock } = usePos();
  const [stockItem, setStockItem] = useState<MenuItem | null>(null);
  const [stockFilter, setStockFilter] = useState<"all" | "alert">("all");
  const soldOutCount = products.filter(isSoldOut).length;
  const lowCount = products.filter(isLowStock).length;
  const [query, setQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("Semua");
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Passive USB / Bluetooth hardware scanner listener in Products Catalog
  useBarcodeGunScanner({
    enabled: !modalOpen && !categoryManagerOpen && !scannerOpen,
    onProductFound: (product) => {
      setQuery(product.barcode);
      setSelectedCategoryFilter("Semua");
      toast.success(`Produk Ditemukan: ${product.name}`, {
        description: `Barcode: ${product.barcode} • Kategori: ${product.category}`,
      });
    },
    onProductNotFound: (code) => {
      setQuery(code);
      toast.info(`Mencari Barcode: ${code}`);
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

      const matchCategory =
        selectedCategoryFilter === "Semua" || item.category === selectedCategoryFilter;

      const matchStock = stockFilter === "all" || isSoldOut(item) || isLowStock(item);

      return matchQuery && matchCategory && matchStock;
    });
  }, [products, query, selectedCategoryFilter, stockFilter]);

  const handleOpenAdd = () => {
    setSelectedProduct(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setSelectedProduct(item);
    setModalOpen(true);
  };

  const handleSave = async (item: MenuItem) => {
    if (selectedProduct) {
      await updateProduct(item);
    } else {
      await addProduct(item);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteProduct(id);
  };

  return (
    <div className="service-rail-surface flex min-h-screen flex-col">
      <Header title={t.productsPage.title} />
      <div className="flex-1 p-5 md:p-8 space-y-5 max-w-7xl w-full mx-auto">
        {/* Top Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-ink/55">{t.productsPage.subtitle}</p>
            <p className="text-xs font-semibold text-ink/40 mt-0.5">
              Total: {products.length} produk terdaftar • {categories.length} kategori aktif
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="search"
                  aria-label={t.productsPage.searchPlaceholder}
                  placeholder={t.productsPage.searchPlaceholder}
                  className="h-10 w-40 sm:w-52 rounded-xl border border-ink/15 bg-white pl-9 pr-3 text-sm text-ink placeholder:text-ink/40 focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-accent/60"
                />
              </div>

              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                title="Pindai Barcode Produk"
                aria-label="Pindai Barcode Produk"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink/15 bg-white text-ink/70 hover:bg-accent hover:text-white hover:border-accent-dark transition-all shadow-sm"
              >
                <ScanLine size={17} />
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCategoryManagerOpen(true)}
              className="gap-1.5 font-semibold"
            >
              <Layers size={15} className="text-accent-dark" />
              Kelola Kategori
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAdd}
              className="gap-1.5 font-semibold"
            >
              <Plus size={15} />
              {t.productsPage.addNew}
            </Button>
          </div>
        </div>

        {(soldOutCount > 0 || lowCount > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
            <p className="flex items-center gap-2 text-xs font-semibold">
              <AlertTriangle size={16} className="text-amber-700" aria-hidden="true" />
              {soldOutCount > 0 && <span>{soldOutCount} menu HABIS (terkunci di menu pelanggan & kasir).</span>}
              {lowCount > 0 && <span>{lowCount} menu stok menipis (&lt; {LOW_STOCK_THRESHOLD} porsi).</span>}
            </p>
            <Button size="sm" variant="outline" onClick={() => setStockFilter(stockFilter === "alert" ? "all" : "alert")}>
              {stockFilter === "alert" ? "Tampilkan semua" : "Lihat yang perlu restock"}
            </Button>
          </div>
        )}

        {/* Dynamic Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter("Semua")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border",
              selectedCategoryFilter === "Semua"
                ? "bg-ink text-white border-ink shadow-sm"
                : "bg-white text-ink/60 border-ink/15 hover:text-ink"
            )}
          >
            Semua ({products.length})
          </button>

          {categories.map((cat) => {
            const count = products.filter((p) => p.category === cat.name).length;
            const isSelected = selectedCategoryFilter === cat.name;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat.name)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border flex items-center gap-1.5",
                  isSelected
                    ? "bg-accent text-white border-accent-dark shadow-sm font-bold"
                    : "bg-white text-ink/60 border-ink/15 hover:text-ink"
                )}
              >
                <span>{cat.name}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full",
                    isSelected ? "bg-ink/10 text-ink" : "bg-mineral text-ink/50"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Product List */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 p-12 text-center bg-white shadow-sm">
            <Tag className="w-10 h-10 mx-auto text-ink/30 mb-2" />
            <p className="font-display font-bold text-ink/70 text-base">
              {t.productsPage.emptyResult}
            </p>
            <p className="mt-1 text-xs text-ink/50">
              Tidak ada produk pada kategori/kata kunci ini.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedCategoryFilter("Semua")}>
                Reset Filter
              </Button>
              <Button size="sm" variant="primary" onClick={handleOpenAdd}>
                <Plus size={14} className="mr-1" /> Tambah Produk Baru
              </Button>
            </div>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm divide-y divide-ink/6">
            {filtered.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-mineral/40 transition-colors md:px-5"
              >
                <FoodImage
                  item={item}
                  className="h-12 w-12 shrink-0 rounded-xl border border-ink/10 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-ink">{item.name}</p>
                    {item.badge && (
                      <span className="rounded-md bg-accent/30 px-1.5 py-0.5 text-[10px] font-bold text-ink">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-ink/50">{item.description}</p>
                  <p className="mt-0.5 text-[11px] font-mono text-ink/40">
                    Barcode: {item.barcode} • Jenis: {item.kind}
                  </p>
                </div>
                <span className="hidden shrink-0 sm:block">
                  <Badge>{item.category}</Badge>
                </span>
                <p className="w-28 shrink-0 text-right font-display text-sm font-bold tracking-tight text-ink">
                  {formatIDR(item.price)}
                </p>
                <span className="w-24 shrink-0 text-center">
                  {isSoldOut(item) ? (
                    <Badge tone="error">HABIS</Badge>
                  ) : isLowStock(item) ? (
                    <Badge tone="warning">Sisa {item.stock}</Badge>
                  ) : item.stock === undefined || item.stock === null ? (
                    <span className="text-[11px] font-semibold text-ink/40">Tidak dilacak</span>
                  ) : (
                    <Badge tone="success">Stok {item.stock}</Badge>
                  )}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => setStockItem(item)}
                >
                  <PackageCheck size={14} aria-hidden="true" /> Stok
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => handleOpenEdit(item)}
                >
                  {t.productsPage.edit}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {stockItem && (
        <StockModal
          item={products.find((p) => p.id === stockItem.id) ?? stockItem}
          onClose={() => setStockItem(null)}
          onApply={adjustStock}
        />
      )}

      {/* Product Edit / Create Modal */}
      <ProductModal
        open={modalOpen}
        itemToEdit={selectedProduct}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {/* Dynamic Category Manager Modal (With 2-Step Verification) */}
      <CategoryManagerModal
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
      />

      {/* Barcode Catalog Scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Pindai Barcode Katalog Produk"
        subtitle="Arahkan barcode produk untuk mencari & memfilter secara otomatis"
        onScanCode={(code) => {
          setQuery(code);
          setScannerOpen(false);
        }}
        onProduct={(product) => {
          setQuery(product.barcode);
          setSelectedCategoryFilter("Semua");
          setScannerOpen(false);
        }}
      />
    </div>
  );
}

/** Owner/cashier ready-stock control: set today's portions, restock, or stop tracking. */
function StockModal({
  item,
  onClose,
  onApply,
}: {
  item: MenuItem;
  onClose: () => void;
  onApply: (item: MenuItem, mode: "set" | "add", qty: number | null) => Promise<void>;
}) {
  const tracked = item.stock !== undefined && item.stock !== null;
  const [mode, setMode] = useState<"set" | "add">(tracked ? "add" : "set");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const qty = Number.parseInt(value, 10);
  const valid = Number.isSafeInteger(qty) && (mode === "set" ? qty >= 0 : qty !== 0) && Math.abs(qty) <= 1_000_000;
  const preview = valid ? (mode === "set" ? qty : (item.stock ?? 0) + qty) : null;

  const run = async (nextMode: "set" | "add", nextQty: number | null, message: string) => {
    setSaving(true);
    try {
      await onApply(item, nextMode, nextQty);
      toast.success(message);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stok gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div>
          <h2 id="stock-title" className="font-display text-base font-bold text-ink">
            Stok Siap Jual · {item.name}
          </h2>
          <p className="mt-0.5 text-xs text-ink/55">
            Saat ini: {tracked ? `${item.stock} porsi` : "tidak dilacak (selalu tersedia)"}. Stok berkurang otomatis saat terjual
            dan menu terkunci HABIS di angka 0.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!tracked}
            aria-pressed={mode === "add"}
            onClick={() => setMode("add")}
            className={cn(
              "rounded-xl border py-2 text-xs font-bold disabled:opacity-40",
              mode === "add" ? "border-accent-dark bg-accent text-white" : "border-ink/15 text-ink/60",
            )}
          >
            Tambah / Kurangi
          </button>
          <button
            type="button"
            aria-pressed={mode === "set"}
            onClick={() => setMode("set")}
            className={cn(
              "rounded-xl border py-2 text-xs font-bold",
              mode === "set" ? "border-accent-dark bg-accent text-white" : "border-ink/15 text-ink/60",
            )}
          >
            Atur Jumlah
          </button>
        </div>

        <label className="block text-xs font-bold uppercase tracking-wider text-ink/60">
          {mode === "set" ? "Jumlah porsi tersedia" : "Perubahan (contoh 10 atau -2)"}
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            min={mode === "set" ? 0 : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </label>
        {preview !== null && (
          <p className={cn("text-xs font-semibold", preview < 0 ? "text-coral" : "text-ink/70")}>
            Stok menjadi: {preview < 0 ? "tidak boleh negatif" : `${preview} porsi${preview === 0 ? " (HABIS)" : ""}`}
          </p>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          {tracked ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => void run("set", null, `${item.name} tidak lagi dilacak stoknya.`)}
            >
              Berhenti lacak
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <Button
              size="sm"
              disabled={!valid || saving || (preview ?? 0) < 0}
              onClick={() => void run(mode, qty, `Stok ${item.name} diperbarui.`)}
            >
              Simpan
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
