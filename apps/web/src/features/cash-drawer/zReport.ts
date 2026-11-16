import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";
import type { ReportRow, ZReportPayload } from "../../state/print";
import type { ShiftRecord } from "../../types/domain";
import { formatDateTime, signed } from "./format";

/** The end-of-shift report for a stored shift; the on-screen preview and the printed ticket both render this. */
export function buildZReportPayload(shift: ShiftRecord): ZReportPayload {
  const z = t.cashDrawer.zReport;
  const difference = shift.cashDifference ?? 0;

  const denominations: ReportRow[] = Object.entries(shift.denominations ?? {})
    .map(([value, qty]) => ({ value: Number.parseInt(value, 10), qty }))
    .filter(({ qty }) => qty > 0)
    .sort((a, b) => b.value - a.value)
    .map(({ value, qty }) => ({ label: `${formatIDR(value)} × ${qty}`, value: formatIDR(value * qty) }));

  return {
    details: [
      { label: z.cashier, value: shift.cashierName },
      { label: z.opened, value: formatDateTime(shift.openedAt) },
      { label: z.closed, value: shift.closedAt ? formatDateTime(shift.closedAt) : z.notClosed },
    ],
    figures: [
      { label: z.startingCash, value: formatIDR(shift.startingCash) },
      { label: z.cashSales, value: formatIDR(shift.cashSalesTotal ?? 0) },
      { label: z.cashIn, value: `+${formatIDR(shift.cashInTotal ?? 0)}` },
      { label: z.cashOut, value: `-${formatIDR(shift.cashOutTotal ?? 0)}` },
      { label: z.expected, value: formatIDR(shift.expectedCash ?? 0), strong: true },
      { label: z.counted, value: formatIDR(shift.actualCash ?? 0), strong: true },
      { label: z.difference, value: signed(difference, formatIDR), strong: true },
    ],
    denominations,
    notes: shift.notes || undefined,
  };
}
