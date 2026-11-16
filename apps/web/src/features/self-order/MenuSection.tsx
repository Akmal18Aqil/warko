import { useMemo, useState } from "react";
import { Search, Utensils } from "lucide-react";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { Empty } from "../../ui/Empty";
import type { MenuItem } from "../../data/menu";
import type { CartLine, CategoryRow } from "../../types/domain";
import { t } from "../../locales/id";
import { ProductCard } from "./ProductCard";

/** Tab id for "no category filter"; category ids are database ids and never empty. */
const ALL = "";

interface MenuSectionProps {
  products: MenuItem[];
  categories: CategoryRow[];
  lines: CartLine[];
  onAdd: (itemId: string) => void;
  onDecrease: (itemId: string) => void;
}

/** Search, category tabs and the product grid. Filter state is local: nothing else needs it. */
export function MenuSection({ products, categories, lines, onAdd, onDecrease }: MenuSectionProps) {
  const [categoryName, setCategoryName] = useState(ALL);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (categoryName === ALL || p.category === categoryName) &&
        (q === "" || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
    );
  }, [products, categoryName, query]);

  const tabs = [
    { id: ALL, label: t.selfOrder.menu.allCategories },
    ...categories.map((category) => ({ id: category.name, label: category.name })),
  ];

  return (
    <>
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-light" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.selfOrder.menu.searchPlaceholder}
          aria-label={t.selfOrder.menu.searchLabel}
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm font-medium text-ink shadow-clay placeholder:text-text-light focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <SegmentedTabs
        tabs={tabs}
        value={categoryName}
        onChange={setCategoryName}
        label={t.selfOrder.menu.categoriesLabel}
        className="flex-wrap"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            qty={lines.find((line) => line.itemId === product.id)?.qty ?? 0}
            onAdd={() => onAdd(product.id)}
            onDecrease={() => onDecrease(product.id)}
          />
        ))}
      </div>

      {visible.length === 0 && <Empty icon={<Utensils size={28} aria-hidden="true" />} title={t.selfOrder.menu.empty} />}
    </>
  );
}
