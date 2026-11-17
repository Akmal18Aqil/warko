import { Check, Clock } from "lucide-react";
import type { MenuItem } from "../../data/menu";
import { formatIDR, isLowStock, isSoldOut } from "../../data/menu";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import { Badge } from "../../ui/Badge";
import { FoodImage } from "../../ui/FoodImage";

export function ProductCard({ item, qty, onAdd }: { item: MenuItem; qty: number; onAdd: (item: MenuItem) => void }) {
  const soldOut = isSoldOut(item);
  const inOrder = qty > 0;
  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      disabled={soldOut}
      aria-label={soldOut ? t.pos.catalog.soldOutAria(item.name) : ariaLabel(item, inOrder)}
      className={cn(
        "pressable group relative flex flex-col overflow-hidden rounded-sm border bg-surface text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        inOrder ? "border-accent bg-accent/5 ring-1 ring-accent/30" : "border-border",
        soldOut && "cursor-not-allowed opacity-55",
      )}
    >
      <div className="relative aspect-[5/3] w-full overflow-hidden border-b border-border bg-surface-muted">
        <FoodImage item={item} className="h-full w-full" />
        {soldOut && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/70 text-sm font-black tracking-[0.3em] text-white">
            {t.pos.catalog.soldOut}
          </span>
        )}
        {isLowStock(item) && (
          <span className="absolute right-2 top-2 rounded-sm bg-warning px-2 py-1 text-xs2 font-bold text-ink shadow-sm">
            {t.pos.catalog.lowStock(item.stock ?? 0)}
          </span>
        )}
        {inOrder && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm bg-accent px-2 py-1 text-xs2 font-bold text-white shadow-sm">
            <Check size={12} strokeWidth={3} aria-hidden="true" />
            {t.pos.catalog.inOrderQty(qty)}
          </span>
        )}
        {item.badge && !inOrder && (
          <span className="absolute left-2 top-2">
            <Badge tone="dark">{item.badge}</Badge>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3 sm:gap-1.5 sm:p-4">
        <div className="flex flex-col gap-0.5 min-[1200px]:flex-row min-[1200px]:items-start min-[1200px]:justify-between min-[1200px]:gap-2">
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-ink sm:text-base">{item.name}</h3>
          <p className="shrink-0 font-display text-sm font-bold tracking-tight text-ink sm:text-base">{formatIDR(item.price)}</p>
        </div>
        <p className="hidden flex-1 text-xs leading-relaxed text-text-muted sm:line-clamp-2">{item.description}</p>
        <p className="mt-auto flex items-center gap-1 pt-1 text-xs2 font-medium text-text-muted sm:mt-1.5 sm:pt-0">
          <Clock size={12} aria-hidden="true" />
          {item.kind} · {item.prepMinutes} {t.pos.catalog.minutesSuffix}
        </p>
      </div>
    </button>
  );
}

function ariaLabel(item: MenuItem, inOrder: boolean): string {
  const price = formatIDR(item.price);
  return inOrder ? t.pos.catalog.addMoreAria(item.name, price) : t.pos.catalog.addAria(item.name, price);
}
