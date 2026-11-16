import { Check, Clock } from "lucide-react";
import type { MenuItem } from "../data/menu";
import { formatIDR, isLowStock, isSoldOut } from "../data/menu";
import { t } from "../locales/en";
import { FoodImage } from "./FoodImage";
import { Badge } from "./ui/Badge";
import { cn } from "../lib/cn";

export function ProductCard({
  item,
  inOrder,
  onAdd,
}: {
  item: MenuItem;
  inOrder: boolean;
  onAdd: (item: MenuItem) => void;
}) {
  const soldOut = isSoldOut(item);
  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      disabled={soldOut}
      aria-label={soldOut ? `${item.name}, HABIS` : ariaLabel(item, inOrder)}
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
            HABIS
          </span>
        )}
        {isLowStock(item) && (
          <span className="absolute right-2 top-2 rounded-sm bg-warning px-2 py-1 text-[11px] font-bold text-ink shadow-sm">
            Sisa {item.stock}
          </span>
        )}
        {inOrder && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm bg-accent px-2 py-1 text-[11px] font-bold text-white shadow-sm">
            <Check size={12} strokeWidth={3} aria-hidden="true" />
            {t.catalog.inOrder}
          </span>
        )}
        {item.badge && !inOrder && (
          <span className="absolute left-2 top-2">
            <Badge tone="dark">{item.badge}</Badge>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[15px] font-semibold leading-snug text-ink">
            {item.name}
          </h3>
          <p className="shrink-0 font-display text-[15px] font-bold tracking-tight text-ink">
            {formatIDR(item.price)}
          </p>
        </div>
        <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-ink/55">
          {item.description}
        </p>
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-ink/45">
          <Clock size={12} aria-hidden="true" />
          {item.kind} · {item.prepMinutes} {t.catalog.minutesSuffix}
        </p>
      </div>
    </button>
  );
}

function ariaLabel(item: MenuItem, inOrder: boolean): string {
  return inOrder
    ? `${item.name}, ${formatIDR(item.price)}. Tambah satu porsi lagi ke pesanan`
    : `${item.name}, ${formatIDR(item.price)}. Tambahkan ke pesanan`;
}
