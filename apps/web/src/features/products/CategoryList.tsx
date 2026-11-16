import { Edit2, Trash2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import type { CategoryRow } from "../../types/domain";
import { Badge } from "../../ui/Badge";
import { IconButton } from "../../ui/Button";
import { categoryColor } from "./categoryColors";
import { KindIcon } from "./productKinds";

/** Category table with per-category product counts and edit / delete actions. */
export function CategoryList({
  categories,
  productCounts,
  onEdit,
  onDelete,
}: {
  categories: readonly CategoryRow[];
  productCounts: ReadonlyMap<string, number>;
  onEdit: (category: CategoryRow) => void;
  onDelete: (category: CategoryRow) => void;
}) {
  const text = t.products.categories.list;
  const headClass = "label-caps px-4 py-3 text-xs2 font-semibold text-text-muted";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-mineral/60">
            <th scope="col" className={headClass}>
              {text.category}
            </th>
            <th scope="col" className={headClass}>
              {text.kind}
            </th>
            <th scope="col" className={cn(headClass, "text-center")}>
              {text.productCount}
            </th>
            <th scope="col" className={cn(headClass, "text-right")}>
              {text.actions}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {categories.map((cat) => {
            const count = productCounts.get(cat.name) ?? 0;
            return (
              <tr key={cat.id} className="transition-colors hover:bg-mineral/40">
                <td className="px-4 py-3 font-semibold text-ink">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", categoryColor(cat.color).bg)} />
                    <span>{cat.name}</span>
                    {cat.isDefault && <Badge className="px-1.5 py-0.5 text-2xs font-medium">{text.builtIn}</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge className="gap-1 rounded">
                    <KindIcon kind={cat.kind} size={11} />
                    {cat.kind}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center text-xs font-bold">
                  <span className={cn("rounded-full px-2.5 py-0.5", count > 0 ? "bg-accent/20 text-ink" : "bg-ink/5 text-text-light")}>
                    {text.productsCount(count)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton label={text.editAria(cat.name)} onClick={() => onEdit(cat)}>
                      <Edit2 size={14} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={text.deleteAria(cat.name)}
                      onClick={() => onDelete(cat)}
                      className="text-error hover:bg-error/10 hover:text-error-dark"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
