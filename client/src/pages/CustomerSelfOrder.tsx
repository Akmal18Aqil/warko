import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import QRCode from "qrcode";
import {
  Banknote,
  CheckCircle2,
  ChefHat,
  Clock,
  MapPin,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  Search,
  ShoppingBag,
  Sparkles,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { usePos, type CartLine } from "../components/PosContext";
import { usePrint } from "../components/PrintContext";
import { OrderReceiptView } from "../components/OrderReceiptView";
import { Button } from "../components/ui/Button";
import { formatIDR, isLowStock, isSoldOut } from "../data/menu";
import type { OrderRow, TableRow } from "../lib/db";
import { cn } from "../lib/cn";
import { floorsOf, isPaid, kitchenStatusOf, newClientRef } from "../lib/orderStatus";
import {
  isPublicCustomer,
  loadPublicOrder,
  loadPublicPaymentOptions,
  RemoteDataError,
  startPublicQris,
  type QrisCharge,
} from "../lib/remote";

/** Orders this device placed: the key is the secret that unlocks status and e-receipt. */
type TrackedOrder = { no: number; key: string; tableId: string; createdAt: number };

const TRACKED_KEY = "wakro_self_orders_v1";
const TABLE_KEY = "wakro_self_table_v1";
const NAME_KEY = "wakro_self_customer_name";
const TRACK_TTL_MS = 12 * 60 * 60 * 1000;
const POLL_MS = 5000;

function readTracked(): TrackedOrder[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TRACKED_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter(
      (t): t is TrackedOrder =>
        typeof t === "object" &&
        t !== null &&
        typeof t.no === "number" &&
        typeof t.key === "string" &&
        typeof t.tableId === "string" &&
        typeof t.createdAt === "number" &&
        now - t.createdAt < TRACK_TTL_MS,
    );
  } catch {
    return [];
  }
}

function writeTracked(list: TrackedOrder[]): void {
  try {
    localStorage.setItem(TRACKED_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {}
}

/** QR stickers carry the table id; older stickers carried a name slug. Never guess a partial match. */
function resolveTable(tables: TableRow[], param: string | undefined): TableRow | undefined {
  if (!param) return undefined;
  let key = param;
  try {
    key = decodeURIComponent(param);
  } catch {}
  const lower = key.toLowerCase();
  return (
    tables.find((t) => t.id === key) ??
    tables.find((t) => t.id.toLowerCase() === lower) ??
    tables.find((t) => t.name.toLowerCase().replace(/\s+/g, "-") === lower)
  );
}

const STEPS = [
  { key: "queued", label: "Diterima Dapur" },
  { key: "preparing", label: "Sedang Dimasak" },
  { key: "ready", label: "Siap Diantar" },
  { key: "served", label: "Diantar" },
] as const;

export default function CustomerSelfOrder() {
  const { tableId: paramTableId } = useParams<{ tableId?: string }>();
  const {
    ready,
    dataSourceError,
    products,
    categories,
    tables,
    orders,
    createSelfOrder,
    taxEnabled,
    taxRate,
    serviceChargeEnabled,
    serviceChargeRate,
  } = usePos();
  const { printOrderReceipt } = usePrint();

  const activeTables = useMemo(() => tables.filter((t) => t.active !== false), [tables]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(() => localStorage.getItem(TABLE_KEY));
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [floorFilter, setFloorFilter] = useState<string | null>(null);

  // The QR in the URL wins over any remembered table.
  useEffect(() => {
    if (!ready) return;
    const fromUrl = resolveTable(activeTables, paramTableId);
    if (fromUrl) {
      setSelectedTableId(fromUrl.id);
      return;
    }
    if (paramTableId) toast.error("QR meja tidak dikenali. Silakan pilih lantai dan meja Anda.");
    if (!activeTables.some((t) => t.id === selectedTableId)) {
      setSelectedTableId(null);
      setIsTableSelectorOpen(true);
    }
    // selectedTableId is intentionally not a dependency: resolve once per load / URL change.
  }, [ready, paramTableId, activeTables]);

  useEffect(() => {
    if (selectedTableId) localStorage.setItem(TABLE_KEY, selectedTableId);
  }, [selectedTableId]);

  const currentTable = activeTables.find((t) => t.id === selectedTableId) ?? null;
  const floors = useMemo(() => floorsOf(activeTables), [activeTables]);

  const [customerName, setCustomerName] = useState(() => localStorage.getItem(NAME_KEY) || "");
  useEffect(() => {
    if (customerName) localStorage.setItem(NAME_KEY, customerName);
  }, [customerName]);

  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Kept across a failed network attempt so a retry cannot create a second order. */
  const pendingRef = useRef<string | null>(null);

  const [tracked, setTracked] = useState<TrackedOrder[]>(readTracked);
  const [remoteOrders, setRemoteOrders] = useState<Record<number, OrderRow>>({});
  const [receiptOrder, setReceiptOrder] = useState<OrderRow | null>(null);

  const [qrisAvailable, setQrisAvailable] = useState(!isPublicCustomer);
  const [qrisOrder, setQrisOrder] = useState<{ no: number; key: string } | null>(null);
  const [qrisCharge, setQrisCharge] = useState<QrisCharge | null>(null);
  const [qrisImage, setQrisImage] = useState("");
  /** Local demo only: the cart waiting for a simulated QRIS confirmation. */
  const [demoQrisOpen, setDemoQrisOpen] = useState(false);

  useEffect(() => {
    if (!isPublicCustomer) return;
    loadPublicPaymentOptions()
      .then((options) => setQrisAvailable(options.qris))
      .catch(() => setQrisAvailable(false));
  }, []);

  const trackedForTable = useMemo(
    () => tracked.filter((t) => !currentTable || t.tableId === currentTable.id),
    [tracked, currentTable],
  );

  // Live status: remote customers poll their own orders by secret key; local mode reads shared state.
  const refreshTracked = useCallback(async () => {
    if (!isPublicCustomer || tracked.length === 0) return;
    const results = await Promise.allSettled(tracked.map((t) => loadPublicOrder(t.no, t.key)));
    setRemoteOrders((prev) => {
      const next = { ...prev };
      results.forEach((r, i) => {
        if (r.status === "fulfilled") next[tracked[i].no] = r.value;
      });
      return next;
    });
  }, [tracked]);

  useEffect(() => {
    if (!isPublicCustomer) return;
    void refreshTracked();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshTracked();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshTracked]);

  const liveOrders: OrderRow[] = useMemo(
    () =>
      trackedForTable
        .map((t) => (isPublicCustomer ? remoteOrders[t.no] : orders.find((o) => o.no === t.no)))
        .filter((o): o is OrderRow => o !== undefined)
        .sort((a, b) => b.no - a.no),
    [orders, remoteOrders, trackedForTable],
  );

  // Close the QRIS sheet once the gateway confirmed the payment.
  const qrisLive = qrisOrder ? liveOrders.find((o) => o.no === qrisOrder.no) : undefined;
  useEffect(() => {
    if (qrisLive && isPaid(qrisLive)) {
      toast.success(`Pembayaran QRIS pesanan #${qrisLive.no} diterima!`);
      setQrisOrder(null);
      setQrisCharge(null);
      setReceiptOrder(qrisLive);
    }
  }, [qrisLive]);

  useEffect(() => {
    if (!qrisCharge) {
      setQrisImage("");
      return;
    }
    QRCode.toDataURL(qrisCharge.qrString, { width: 300, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrisImage)
      .catch(() => setQrisImage(""));
  }, [qrisCharge]);

  const qtyInCart = (itemId: string) => cartLines.find((l) => l.itemId === itemId)?.qty ?? 0;

  const handleAddItem = (itemId: string) => {
    const product = products.find((p) => p.id === itemId);
    if (!product) return;
    if (isSoldOut(product)) {
      toast.error(`${product.name} sedang HABIS`);
      return;
    }
    if (product.stock !== undefined && product.stock !== null && qtyInCart(itemId) >= product.stock) {
      toast.error(`Stok ${product.name} tinggal ${product.stock}`);
      return;
    }
    setCartLines((prev) => {
      const idx = prev.findIndex((l) => l.itemId === itemId);
      if (idx >= 0) return prev.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { itemId, qty: 1 }];
    });
  };

  const handleDecreaseItem = (itemId: string) => {
    setCartLines((prev) =>
      prev.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty - 1 } : l)).filter((l) => l.qty > 0),
    );
  };

  const handleSetNote = (itemId: string, note: string) => {
    setCartLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, note: note.slice(0, 200) } : l)));
  };

  // Drop cart lines whose product disappeared or sold out after a menu refresh.
  useEffect(() => {
    setCartLines((prev) => {
      const next = prev.filter((l) => {
        const p = products.find((x) => x.id === l.itemId);
        return p !== undefined && !isSoldOut(p);
      });
      return next.length === prev.length ? prev : next;
    });
  }, [products]);

  const cartSummary = useMemo(() => {
    let rawSubtotal = 0;
    let count = 0;
    for (const line of cartLines) {
      const prod = products.find((p) => p.id === line.itemId);
      if (prod) {
        rawSubtotal += prod.price * line.qty;
        count += line.qty;
      }
    }
    const serviceCharge = serviceChargeEnabled ? Math.round((rawSubtotal * serviceChargeRate) / 100) : 0;
    const tax = taxEnabled ? Math.round(((rawSubtotal + serviceCharge) * taxRate) / 100) : 0;
    return { rawSubtotal, tax, serviceCharge, total: rawSubtotal + serviceCharge + tax, count };
  }, [cartLines, products, serviceChargeEnabled, serviceChargeRate, taxEnabled, taxRate]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter(
      (p) =>
        (selectedCategory === "Semua" || p.category === selectedCategory) &&
        (q === "" || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
    );
  }, [products, selectedCategory, searchQuery]);

  const submitOrder = async (paymentChoice: "paid-now" | "pay-later"): Promise<{ order: OrderRow; key: string } | null> => {
    if (isSubmitting) return null;
    if (!currentTable) {
      setIsTableSelectorOpen(true);
      toast.error("Pilih lantai dan meja terlebih dahulu");
      return null;
    }
    if (cartLines.length === 0) {
      toast.error("Keranjang pesanan masih kosong");
      return null;
    }
    const key = pendingRef.current ?? newClientRef();
    pendingRef.current = key;
    setIsSubmitting(true);
    try {
      const created = await createSelfOrder({
        tableId: currentTable.id,
        customerName: customerName.trim() || `Tamu ${currentTable.name}`,
        lines: cartLines,
        clientRef: key,
        paymentChoice,
      });
      pendingRef.current = null;
      const entry: TrackedOrder = { no: created.no, key, tableId: currentTable.id, createdAt: Date.now() };
      const next = [entry, ...tracked.filter((t) => t.no !== created.no)];
      setTracked(next);
      writeTracked(next);
      if (isPublicCustomer) setRemoteOrders((prev) => ({ ...prev, [created.no]: created }));
      setCartLines([]);
      setIsCartOpen(false);
      return { order: created, key };
    } catch (err) {
      // Any server answer is final; only an unanswered request keeps the key for a safe retry.
      if (!(err instanceof RemoteDataError && err.status === undefined)) pendingRef.current = null;
      toast.error(err instanceof Error ? err.message : "Gagal mengirim pesanan. Silakan coba lagi.");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayAtCashier = async () => {
    const result = await submitOrder("pay-later");
    if (!result) return;
    toast.success(`Pesanan #${result.order.no} diterima dapur!`, {
      description: `Bayar tunai di kasir dengan menyebutkan nomor pesanan #${result.order.no}.`,
    });
  };

  const handlePayQris = async () => {
    if (!isPublicCustomer) {
      // Local demo mode: no gateway; the payment is simulated and labelled as such.
      if (!currentTable || cartLines.length === 0) {
        await submitOrder("paid-now");
        return;
      }
      setDemoQrisOpen(true);
      return;
    }
    const result = await submitOrder("pay-later");
    if (!result) return;
    await openQrisFor(result.order.no, result.key);
  };

  const openQrisFor = async (no: number, key: string) => {
    setQrisOrder({ no, key });
    setQrisCharge(null);
    try {
      setQrisCharge(await startPublicQris(no, key));
    } catch (err) {
      setQrisOrder(null);
      toast.error(err instanceof Error ? err.message : "QRIS belum tersedia. Silakan bayar di kasir.", {
        description: `Pesanan #${no} tetap diproses dapur dan bisa dibayar tunai di kasir.`,
      });
    }
  };

  const handleDemoQrisConfirm = async () => {
    const result = await submitOrder("paid-now");
    setDemoQrisOpen(false);
    if (!result) return;
    toast.success(`Pesanan #${result.order.no} lunas (simulasi QRIS demo).`);
    setReceiptOrder(result.order);
  };

  const handlePrintReceipt = (order: OrderRow) => {
    printOrderReceipt(order).catch((err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Struk gagal disimpan."),
    );
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-semibold text-ink/60">
        Memuat menu WAKRO…
      </div>
    );
  }

  if (dataSourceError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-bold text-ink">Menu belum dapat dimuat.</p>
        <p className="text-xs text-ink/60">{dataSourceError}</p>
        <Button onClick={() => window.location.reload()}>Coba lagi</Button>
      </div>
    );
  }

  return (
    <div className="service-rail-surface min-h-screen pb-28 text-ink">
      <header className="sticky top-0 z-30 bg-ink text-white shadow-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white">WAKRO Digital · Warung WakRo Baru</h1>
            <button
              type="button"
              onClick={() => setIsTableSelectorOpen(true)}
              className="mt-0.5 flex items-center gap-1 text-xs font-bold text-accent hover:underline"
            >
              <MapPin size={12} />
              <span>{currentTable ? `${currentTable.name} · ${currentTable.area}` : "Pilih lantai & meja"}</span>
            </button>
          </div>
          {liveOrders.length > 0 && (
            <button
              type="button"
              onClick={() => document.getElementById("live-order-tracker")?.scrollIntoView({ behavior: "smooth" })}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white shadow-sm"
            >
              <Clock size={13} />
              Status #{liveOrders[0].no}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-3.5 px-4 pt-4">
        <section className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <label htmlFor="customer-name-input" className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Nama pemesan
            </label>
            <button
              type="button"
              onClick={() => setIsTableSelectorOpen(true)}
              className="text-[11px] font-bold text-ink/60 underline hover:text-ink"
            >
              Ganti meja
            </button>
          </div>
          <input
            id="customer-name-input"
            type="text"
            maxLength={60}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nama Anda (opsional)"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-ink focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </section>

        {liveOrders.length > 0 && (
          <section id="live-order-tracker" className="space-y-3">
            {liveOrders.map((order) => (
              <LiveOrderCard
                key={order.no}
                order={order}
                qrisAvailable={qrisAvailable && isPublicCustomer}
                onReceipt={() => setReceiptOrder(order)}
                onPayQris={() => {
                  const entry = tracked.find((t) => t.no === order.no);
                  if (entry) void openQrisFor(entry.no, entry.key);
                }}
              />
            ))}
          </section>
        )}

        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari makanan atau minuman…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-ink shadow-xs placeholder:text-ink/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        <div className="flex flex-wrap gap-2 pb-1">
          {["Semua", ...categories.map((c) => c.name)].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "min-h-[40px] whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all",
                selectedCategory === cat
                  ? "bg-accent text-white shadow-sm"
                  : "border border-slate-200 bg-white text-ink/70 hover:border-ink/20",
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filteredProducts.map((product) => {
            const qty = qtyInCart(product.id);
            const soldOut = isSoldOut(product);
            const low = isLowStock(product);
            return (
              <article
                key={product.id}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm",
                  soldOut && "opacity-60",
                )}
              >
                <div className="flex gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <Utensils size={22} className="m-auto mt-7 text-ink/30" aria-hidden="true" />
                    )}
                    {soldOut && (
                      <span className="absolute inset-0 flex items-center justify-center bg-ink/70 text-xs font-black tracking-widest text-white">
                        HABIS
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold leading-snug text-ink">{product.name}</h3>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-ink/55">{product.description}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-bold text-ink">{formatIDR(product.price)}</span>
                      {low && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                          Sisa {product.stock}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-2.5">
                  {soldOut ? (
                    <span className="text-xs font-bold text-coral">Menu habis hari ini</span>
                  ) : qty > 0 ? (
                    <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => handleDecreaseItem(product.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-ink shadow-sm"
                        aria-label={`Kurangi ${product.name}`}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-ink">{qty}</span>
                      <button
                        type="button"
                        onClick={() => handleAddItem(product.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white shadow-sm"
                        aria-label={`Tambah ${product.name}`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleAddItem(product.id)}
                      className="h-8 gap-1.5 rounded-xl px-3.5 text-xs font-bold"
                    >
                      <Plus size={14} />
                      Tambah
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="py-16 text-center">
            <Utensils size={36} className="mx-auto mb-2 text-ink/30" />
            <p className="text-sm font-medium text-ink/60">Tidak ada menu yang sesuai.</p>
          </div>
        )}
      </main>

      {cartSummary.count > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl bg-ink px-5 py-3.5 text-white shadow-xl ring-2 ring-accent/40"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
                  {cartSummary.count}
                </span>
                <div className="text-left">
                  <div className="text-xs text-white/70">{currentTable ? currentTable.name : "Pilih meja"}</div>
                  <div className="font-display text-base font-bold">{formatIDR(cartSummary.total)}</div>
                </div>
              </div>
              <span className="flex items-center gap-2 text-sm font-bold">
                Lihat Keranjang <ShoppingBag size={18} />
              </span>
            </button>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-label="Keranjang pesanan" className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <h2 className="text-base font-bold text-ink">
                  Pesanan {currentTable ? `${currentTable.name} · ${currentTable.area}` : ""}
                </h2>
                <p className="text-xs text-ink/60">Atas nama: {customerName.trim() || "Tamu"}</p>
              </div>
              <button
                type="button"
                aria-label="Tutup keranjang"
                onClick={() => setIsCartOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-ink/60 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {cartLines.map((line) => {
                const prod = products.find((p) => p.id === line.itemId);
                if (!prod) return null;
                return (
                  <div key={line.itemId} className="rounded-xl border border-slate-200/80 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-ink">{prod.name}</div>
                      <div className="font-display text-sm font-bold text-ink">{formatIDR(prod.price * line.qty)}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <input
                        type="text"
                        value={line.note || ""}
                        maxLength={200}
                        onChange={(e) => handleSetNote(line.itemId, e.target.value)}
                        placeholder="Catatan: pedas, tanpa es, dll."
                        aria-label={`Catatan ${prod.name}`}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <div className="flex items-center gap-2 rounded-lg bg-white p-1 shadow-sm">
                        <button
                          type="button"
                          aria-label={`Kurangi ${prod.name}`}
                          onClick={() => handleDecreaseItem(line.itemId)}
                          className="flex h-7 w-7 items-center justify-center rounded text-ink hover:bg-slate-100"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-4 text-center text-xs font-bold">{line.qty}</span>
                        <button
                          type="button"
                          aria-label={`Tambah ${prod.name}`}
                          onClick={() => handleAddItem(line.itemId)}
                          className="flex h-7 w-7 items-center justify-center rounded bg-accent text-white"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="space-y-1.5 rounded-xl bg-slate-100/70 p-3 text-xs">
                <div className="flex justify-between text-ink/70">
                  <span>Subtotal ({cartSummary.count} item)</span>
                  <span>{formatIDR(cartSummary.rawSubtotal)}</span>
                </div>
                {serviceChargeEnabled && (
                  <div className="flex justify-between text-ink/70">
                    <span>Biaya layanan ({serviceChargeRate}%)</span>
                    <span>{formatIDR(cartSummary.serviceCharge)}</span>
                  </div>
                )}
                {taxEnabled && (
                  <div className="flex justify-between text-ink/70">
                    <span>Pajak ({taxRate}%)</span>
                    <span>{formatIDR(cartSummary.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 font-display text-sm font-bold text-ink">
                  <span>Total</span>
                  <span>{formatIDR(cartSummary.total)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 rounded-b-3xl border-t border-slate-100 bg-white p-4">
              {qrisAvailable && (
                <Button
                  type="button"
                  onClick={() => void handlePayQris()}
                  disabled={isSubmitting || !currentTable}
                  className="h-12 w-full gap-2 rounded-xl text-sm font-bold"
                >
                  <QrCode size={18} />
                  Bayar Sekarang via QRIS{isPublicCustomer ? "" : " (demo)"}
                </Button>
              )}
              <Button
                type="button"
                variant={qrisAvailable ? "outline" : "primary"}
                onClick={() => void handlePayAtCashier()}
                disabled={isSubmitting || !currentTable}
                className="h-12 w-full gap-2 rounded-xl text-sm font-bold"
              >
                <Banknote size={18} />
                Pesan &amp; Bayar Tunai di Kasir
              </Button>
              {!currentTable && <p className="text-center text-xs font-semibold text-coral">Pilih meja terlebih dahulu.</p>}
            </div>
          </div>
        </div>
      )}

      {demoQrisOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-5 text-center shadow-2xl">
            <h3 className="text-sm font-bold text-ink">Simulasi QRIS (mode demo lokal)</h3>
            <p className="text-xs text-ink/60">
              Mode demo tidak terhubung ke payment gateway. Tombol di bawah hanya menyimulasikan pembayaran berhasil.
            </p>
            <p className="font-display text-xl font-bold text-ink">{formatIDR(cartSummary.total)}</p>
            <Button className="h-11 w-full font-bold" disabled={isSubmitting} onClick={() => void handleDemoQrisConfirm()}>
              <CheckCircle2 size={16} /> Simulasikan pembayaran berhasil
            </Button>
            <button type="button" onClick={() => setDemoQrisOpen(false)} className="text-xs font-semibold text-ink/55 hover:text-ink">
              Batal
            </button>
          </div>
        </div>
      )}

      {qrisOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label="Pembayaran QRIS" className="w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl">
            <h3 className="text-sm font-bold text-ink">Bayar QRIS · Pesanan #{qrisOrder.no}</h3>
            <p className="mt-1 text-xs text-ink/60">Scan dengan aplikasi bank atau e-wallet apa pun.</p>
            <div className="mx-auto my-4 flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-dashed border-ink/20 bg-white p-2">
              {qrisImage ? (
                <img src={qrisImage} alt="Kode QRIS pembayaran" className="h-60 w-60" />
              ) : (
                <span className="animate-pulse text-xs text-ink/50">Membuat QRIS…</span>
              )}
            </div>
            {qrisCharge && (
              <>
                <p className="font-display text-xl font-bold text-ink">{formatIDR(qrisCharge.amount)}</p>
                <p className="mt-1 text-[11px] text-ink/55">
                  Berlaku sampai {new Date(qrisCharge.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.
                  Status lunas muncul otomatis setelah pembayaran diterima.
                </p>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setQrisOrder(null);
                setQrisCharge(null);
              }}
              className="mt-4 text-xs font-semibold text-ink/55 hover:text-ink"
            >
              Tutup (bayar di kasir saja)
            </button>
          </div>
        </div>
      )}

      {receiptOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label="Struk digital" className="max-h-[90vh] w-full max-w-sm space-y-3 overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <OrderReceiptView order={liveOrders.find((o) => o.no === receiptOrder.no) ?? receiptOrder} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setReceiptOrder(null)}>
                Tutup
              </Button>
              <Button className="flex-1 gap-1.5" onClick={() => handlePrintReceipt(liveOrders.find((o) => o.no === receiptOrder.no) ?? receiptOrder)}>
                <ReceiptText size={15} /> Simpan / Cetak
              </Button>
            </div>
          </div>
        </div>
      )}

      {isTableSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label="Pilih meja" className="w-full max-w-md space-y-4 rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                <MapPin size={16} /> Pilih lantai &amp; nomor meja
              </h3>
              {currentTable && (
                <button type="button" aria-label="Tutup" onClick={() => setIsTableSelectorOpen(false)} className="text-ink/50 hover:text-ink">
                  ✕
                </button>
              )}
            </div>
            <p className="text-xs text-ink/60">Pastikan sesuai dengan stiker QR di meja Anda.</p>
            <div className="flex flex-wrap gap-2">
              {floors.map((floor) => (
                <button
                  key={floor}
                  type="button"
                  onClick={() => setFloorFilter(floor)}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs font-bold",
                    (floorFilter ?? currentTable?.area ?? floors[0]) === floor ? "bg-ink text-white" : "border border-ink/15 bg-white text-ink/70",
                  )}
                >
                  {floor}
                </button>
              ))}
            </div>
            <div className="grid max-h-64 grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3">
              {activeTables
                .filter((t) => t.area === (floorFilter ?? currentTable?.area ?? floors[0]))
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTableId(t.id);
                      setIsTableSelectorOpen(false);
                      toast.success(`Meja aktif: ${t.name} · ${t.area}`);
                    }}
                    className={cn(
                      "rounded-2xl border p-3 text-left transition-all",
                      t.id === selectedTableId
                        ? "border-ink bg-ink text-white ring-2 ring-accent/50"
                        : "border-ink/10 bg-mineral/40 text-ink hover:border-ink/30 hover:bg-white",
                    )}
                  >
                    <p className="text-xs font-bold">{t.name}</p>
                    <p className="mt-0.5 text-[10px] opacity-60">{t.seats} kursi</p>
                  </button>
                ))}
            </div>
            {activeTables.length === 0 && <p className="text-xs text-coral">Belum ada meja aktif. Hubungi kasir.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveOrderCard({
  order,
  qrisAvailable,
  onReceipt,
  onPayQris,
}: {
  order: OrderRow;
  qrisAvailable: boolean;
  onReceipt: () => void;
  onPayQris: () => void;
}) {
  const stage = kitchenStatusOf(order);
  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.key === stage));
  const paid = isPaid(order);
  return (
    <article className="space-y-3 rounded-2xl border-2 border-accent bg-white p-4 shadow-md">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
            <ChefHat size={18} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">Pesanan #{order.no}</h2>
            <p className="text-[11px] text-ink/60">
              {order.tableName}
              {order.tableArea ? ` · ${order.tableArea}` : ""}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase",
            paid ? "bg-emerald-600 text-white" : "bg-coral text-white",
          )}
        >
          {paid ? "Lunas" : "Belum bayar"}
        </span>
      </div>

      {stage === "ready" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-emerald-950">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-emerald-700" />
          <p className="text-xs font-bold">Pesanan Anda siap dan sedang diantar ke meja.</p>
        </div>
      )}

      <ol className="grid grid-cols-4 gap-1 text-center text-[10px] font-semibold" aria-label="Progres pesanan">
        {STEPS.map((step, i) => (
          <li key={step.key} className="flex flex-col items-center gap-1" aria-current={i === stepIndex ? "step" : undefined}>
            <div className={cn("h-2 w-full rounded-full", i <= stepIndex ? "bg-accent" : "bg-slate-200")} />
            <span className={i <= stepIndex ? "font-bold text-ink" : "text-slate-400"}>{step.label}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-1 rounded-xl bg-slate-50 p-2.5 text-xs">
        {order.items?.map((it, idx) => (
          <div key={idx} className="flex justify-between text-ink/80">
            <span>
              <strong>{it.qty}×</strong> {it.name}
              {it.note && <span className="block text-[10px] italic text-ink/50">({it.note})</span>}
            </span>
            <span className="font-medium">{formatIDR(it.price * it.qty)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-slate-200 pt-1.5 font-bold text-ink">
          <span>Total</span>
          <span>{formatIDR(order.total)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {paid ? (
          <span className="font-semibold text-emerald-700">✅ Pembayaran diterima</span>
        ) : (
          <span className="font-semibold text-ink/70">Bayar tunai di kasir: sebutkan #{order.no}</span>
        )}
        <div className="flex gap-2">
          {!paid && qrisAvailable && (
            <Button size="sm" variant="outline" className="gap-1" onClick={onPayQris}>
              <QrCode size={13} /> Bayar QRIS
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1" onClick={onReceipt}>
            <ReceiptText size={13} /> {paid ? "Struk digital" : "Rincian"}
          </Button>
        </div>
      </div>
    </article>
  );
}
