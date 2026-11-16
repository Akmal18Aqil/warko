import { Printer } from "lucide-react";
import { formatIDR } from "../../data/menu";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import type { ShiftRecord } from "../../types/domain";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Empty } from "../../ui/Empty";
import { DifferencePill } from "./DifferencePill";
import { formatLongDate, formatTime } from "./format";

interface ShiftHistoryTableProps {
  shifts: readonly ShiftRecord[];
  onViewReport: (shift: ShiftRecord) => void;
}

const HEAD = "label-caps px-5 py-3 text-xs2 font-semibold text-ink/50";

export function ShiftHistoryTable({ shifts, onViewReport }: ShiftHistoryTableProps) {
  const text = t.cashDrawer.history;
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-clay">
      <div className="border-b border-ink/10 p-4 sm:p-5">
        <h3 className="font-display text-base font-bold text-ink">{text.title}</h3>
        <p className="mt-0.5 text-xs text-text-muted">{text.subtitle}</p>
      </div>

      {shifts.length === 0 ? (
        <Empty title={text.empty} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-mineral/60">
                <th scope="col" className={HEAD}>
                  {text.colShift}
                </th>
                <th scope="col" className={HEAD}>
                  {text.colCashier}
                </th>
                <th scope="col" className={cn(HEAD, "text-right")}>
                  {text.colStartingCash}
                </th>
                <th scope="col" className={cn(HEAD, "text-right")}>
                  {text.colCashSales}
                </th>
                <th scope="col" className={cn(HEAD, "text-right")}>
                  {text.colCounted}
                </th>
                <th scope="col" className={cn(HEAD, "text-center")}>
                  {text.colDifference}
                </th>
                <th scope="col" className={cn(HEAD, "text-center")}>
                  {text.colReport}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {shifts.map((shift) => (
                <tr key={shift.id} className="transition-colors hover:bg-mineral/40">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-ink">{formatLongDate(shift.openedAt)}</div>
                    <div className="text-xs text-text-muted">
                      {formatTime(shift.openedAt)} - {shift.closedAt ? formatTime(shift.closedAt) : text.running}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-ink">{shift.cashierName}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-ink-soft">{formatIDR(shift.startingCash)}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-ink-soft">{formatIDR(shift.cashSalesTotal ?? 0)}</td>
                  <td className="px-5 py-3.5 text-right font-display font-bold text-ink">{formatIDR(shift.actualCash ?? 0)}</td>
                  <td className="px-5 py-3.5 text-center">
                    {shift.status === "OPEN" ? (
                      <Badge tone="accent">{t.cashDrawer.banner.active}</Badge>
                    ) : (
                      <DifferencePill difference={shift.cashDifference ?? 0} />
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <Button variant="outline" size="sm" onClick={() => onViewReport(shift)} className="gap-1.5 text-xs font-medium">
                      <Printer size={14} className="text-text-muted" aria-hidden="true" />
                      {text.viewReport}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
