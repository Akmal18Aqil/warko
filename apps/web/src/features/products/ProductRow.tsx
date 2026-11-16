import { PackageCheck } from "lucide-react";
import { formatIDR, isLowStock, isSoldOut, type MenuItem } from "../../data/menu";
import { t } from "../../locales/id";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { FoodImage } from "../../ui/FoodImage";

function StockBadge({ item }: { item: MenuItem }) {
  const text = t.products.row;
  const stock = item.stock;
  if (stock === undefined || stock === null) return <span className="text-xs2 font-semibold text-text-light">{text.untracked}</span>;
  if (isSoldOut(item)) return <Badge tone="error">{text.soldOut}</Badge>;
  if (isLowStock(item)) return <Badge tone="warning">{text.remaining(stock)}</Badge>;
  return <Badge tone="success">{text.inStock(stock)}</Badge>;
}

/** `onEdit` is omitted for roles that may only adjust stock. */
export function ProductRow({ item, onStock, onEdit }: { item: MenuItem; onStock: () => void; onEdit?: () => void }) {
  const text = t.products.row;
  return (
    <li className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-mineral/40 md:px-5">
      <FoodImage item={item} className="h-12 w-12 shrink-0 rounded-xl border border-border object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-ink">{item.name}</p>
          {item.badge && (
            <Badge tone="accent" className="rounded-md px-1.5 py-0.5 text-2xs font-bold">
              {item.badge}
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-text-muted">{item.description}</p>
        <p className="mt-0.5 font-mono text-xs2 text-text-light">{text.meta(item.barcode, item.kind)}</p>
      </div>
      <span className="hidden shrink-0 sm:block">
        <Badge>{item.category}</Badge>
      </span>
      <p className="w-28 shrink-0 text-right font-display text-sm font-bold tracking-tight text-ink">{formatIDR(item.price)}</p>
      <span className="w-24 shrink-0 text-center">
        <StockBadge item={item} />
      </span>
      <Button variant="outline" size="sm" className="shrink-0" onClick={onStock} aria-label={text.stockAria(item.name)}>
        <PackageCheck size={14} aria-hidden="true" />
        {text.stock}
      </Button>
      {onEdit && (
        <Button variant="outline" size="sm" className="shrink-0" onClick={onEdit} aria-label={text.editAria(item.name)}>
          {t.common.edit}
        </Button>
      )}
    </li>
  );
}
