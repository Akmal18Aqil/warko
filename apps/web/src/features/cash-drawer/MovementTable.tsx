import { ArrowDownLeft, ArrowUpRight, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { formatIDR } from "../../data/menu";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import type { CashMovementRow } from "../../types/domain";
import { Badge } from "../../ui/Badge";
import { Empty } from "../../ui/Empty";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { MOVEMENT_FILTERS, type MovementFilter } from "./constants";
import { formatShortDate, formatTime } from "./format";

interface MovementTableProps {
  movements: readonly CashMovementRow[];
  /** Admins may delete any movement; others only those of the open shift. */
  canDelete: (movement: CashMovementRow) => boolean;
  onDelete: (movement: CashMovementRow) => void;
}

const HEAD = "label-caps px-5 py-3 text-xs2 font-semibold text-ink/50";

export function MovementTable({ movements, canDelete, onDelete }: MovementTableProps) {
  const text = t.cashDrawer.movements;
  const [filter, setFilter] = useState<MovementFilter>("ALL");
  const shown = useMemo(() => (filter === "ALL" ? movements : movements.filter((m) => m.type === filter)), [movements, filter]);
  const filterTabs = MOVEMENT_FILTERS.map((id) => ({ id, label: id === "ALL" ? text.filterAll : t.cashDrawer.movementType[id] }));

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-clay">
      <div className="flex flex-col justify-between gap-3 border-b border-ink/10 p-4 sm:flex-row sm:items-center sm:p-5">
        <div>
          <h3 className="font-display text-base font-bold text-ink">{text.title}</h3>
          <p className="mt-0.5 text-xs text-text-muted">{text.subtitle}</p>
        </div>
        <SegmentedTabs tabs={filterTabs} value={filter} onChange={setFilter} label={text.filterLabel} />
      </div>

      {shown.length === 0 ? (
        <Empty title={text.empty} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-mineral/60">
                <th scope="col" className={HEAD}>
                  {text.colTime}
                </th>
                <th scope="col" className={HEAD}>
                  {text.colType}
                </th>
                <th scope="col" className={HEAD}>
                  {text.colDescription}
                </th>
                <th scope="col" className={HEAD}>
                  {text.colStaff}
                </th>
                <th scope="col" className={cn(HEAD, "text-right")}>
                  {text.colAmount}
                </th>
                <th scope="col" className={cn(HEAD, "text-center")}>
                  {text.colAction}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {shown.map((mov) => {
                const incoming = mov.type === "CASH_IN";
                return (
                  <tr key={mov.id} className="transition-colors hover:bg-mineral/40">
                    <td className="px-5 py-3.5 font-mono text-xs text-text-muted">
                      {formatShortDate(mov.createdAt)} • {formatTime(mov.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Badge tone={incoming ? "success" : "error"} className="gap-1">
                          {incoming ? <ArrowDownLeft size={12} aria-hidden="true" /> : <ArrowUpRight size={12} aria-hidden="true" />}
                          {t.cashDrawer.movementType[mov.type]}
                        </Badge>
                        <span className="text-xs text-text-muted">{t.cashDrawer.categoryShort[mov.category]}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-ink">{mov.description}</td>
                    <td className="px-5 py-3.5 text-xs text-text-muted">{mov.cashierName}</td>
                    <td className={cn("px-5 py-3.5 text-right font-display font-bold", incoming ? "text-success-dark" : "text-error-dark")}>
                      {incoming ? "+" : "-"}
                      {formatIDR(mov.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {canDelete(mov) ? (
                        <button
                          type="button"
                          onClick={() => onDelete(mov)}
                          aria-label={text.deleteLabel(mov.description)}
                          title={t.common.delete}
                          className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-error/10 hover:text-error-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
