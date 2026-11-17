import { Minus, Plus, ScanLine, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatIDR } from "../../data/menu";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import { useCategories, useProducts } from "../../state/catalog";
import { Empty } from "../../ui/Empty";
import type { WaiterDraft } from "./useWaiterDraft";

/** Category filter, search, scanner shortcut and the product grid with inline quantity steppers. */
export function MenuGrid({ cart, onScan }: { cart: WaiterDraft["cart"]; onScan: () => void }) {
  const products = useProducts();
  const categories = useCategories();
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const qtyById = useMemo(() => new Map(cart.lines.map((line) => [line.itemId, line.qty])), [cart.lines]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === null || p.category === category) &&
        (needle === "" || p.name.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle)),
    );
  }, [products, category, query]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex min-w-0 max-w-full flex-wrap gap-1.5 pb-1">
          <legend className="sr-only">{t.waiter.categoriesLabel}</legend>
          {[null, ...categories.map((c) => c.name)].map((name) => (
            <button
              key={name ?? "all"}
              type="button"
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
              className={cn(
                "min-h-10 rounded-xl px-3.5 py-2 text-xs font-bold transition-all",
                category === name
                  ? "bg-accent text-white shadow-sm"
                  : "border border-border bg-surface text-ink/70 hover:border-border-hover",
              )}
            >
              {name ?? t.waiter.allCategories}
            </button>
          ))}
        </fieldset>

        <div className="flex w-full items-center gap-1.5 sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.waiter.searchPlaceholder}
              aria-label={t.waiter.searchLabel}
              className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-xs font-medium text-ink shadow-clay focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onScan}
            title={t.waiter.scan}
            aria-label={t.waiter.scan}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-ink/70 shadow-xs transition-all hover:border-accent-dark hover:bg-accent hover:text-white"
          >
            <ScanLine size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty title={t.waiter.noMenuMatch} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => {
            const qty = qtyById.get(p.id);
            return (
              <div key={p.id} className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-surface p-3 shadow-clay">
                <div>
                  {p.image && (
                    <div className="mb-2 h-24 w-full overflow-hidden rounded-xl bg-surface-muted">
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <div className="line-clamp-2 text-xs font-bold leading-snug text-ink">{p.name}</div>
                  <div className="mt-1 font-display text-xs font-bold text-ink">{formatIDR(p.price)}</div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
                  {qty ? (
                    <div className="flex w-full items-center justify-between rounded-lg bg-surface-muted p-1">
                      <button
                        type="button"
                        onClick={() => cart.decrease(p.id)}
                        aria-label={t.waiter.decreaseItem(p.name)}
                        className="flex h-7 w-7 items-center justify-center rounded bg-surface text-ink shadow-sm"
                      >
                        <Minus size={13} aria-hidden="true" />
                      </button>
                      <span className="text-xs font-bold text-ink">{qty}</span>
                      <button
                        type="button"
                        onClick={() => cart.add(p.id)}
                        aria-label={t.waiter.increaseItem(p.name)}
                        className="flex h-7 w-7 items-center justify-center rounded bg-accent text-white shadow-sm"
                      >
                        <Plus size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => cart.add(p.id)}
                      aria-label={t.waiter.pickItem(p.name)}
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-accent text-xs font-bold text-white shadow-sm hover:bg-accent-dark active:scale-95"
                    >
                      <Plus size={14} aria-hidden="true" />
                      {t.waiter.pick}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
