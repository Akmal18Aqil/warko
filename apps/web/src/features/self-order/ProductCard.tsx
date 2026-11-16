import { Plus, Utensils } from "lucide-react";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { formatIDR, isLowStock, isSoldOut, type MenuItem } from "../../data/menu";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import { QtyStepper } from "./QtyStepper";

interface ProductCardProps {
  product: MenuItem;
  qty: number;
  onAdd: () => void;
  onDecrease: () => void;
}

export function ProductCard({ product, qty, onAdd, onDecrease }: ProductCardProps) {
  const soldOut = isSoldOut(product);
  return (
    <article
      className={cn(
        "flex flex-col justify-between rounded-2xl border border-border bg-surface p-3.5 shadow-clay",
        soldOut && "opacity-60",
      )}
    >
      <div className="flex gap-3">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted">
          {product.image ? (
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <Utensils size={22} className="text-ink/30" aria-hidden="true" />
          )}
          {soldOut && (
            <span className="absolute inset-0 flex items-center justify-center bg-ink/70 text-xs font-black tracking-widest text-white">
              {t.selfOrder.menu.soldOutBadge}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold leading-snug text-ink">{product.name}</h3>
            <p className="mt-0.5 line-clamp-2 text-xs2 text-text-muted">{product.description}</p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-display text-sm font-bold text-ink">{formatIDR(product.price)}</span>
            {isLowStock(product) && <Badge tone="warning">{t.selfOrder.menu.stockLeft(product.stock ?? 0)}</Badge>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end border-t border-border/60 pt-2.5">
        {soldOut ? (
          <span className="text-xs font-bold text-error">{t.selfOrder.menu.soldOutToday}</span>
        ) : qty > 0 ? (
          <QtyStepper name={product.name} qty={qty} onDecrease={onDecrease} onIncrease={onAdd} />
        ) : (
          <Button size="sm" onClick={onAdd} aria-label={t.selfOrder.menu.increase(product.name)} className="px-3.5 font-bold">
            <Plus size={14} aria-hidden="true" />
            {t.common.add}
          </Button>
        )}
      </div>
    </article>
  );
}
