import { ArrowDownLeft, ArrowUpRight, DollarSign } from "lucide-react";
import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";
import { MetricCell, MetricStrip } from "../../ui/MetricStrip";
import type { ShiftFigures } from "./useCashDrawer";

interface CashMetricsProps {
  startingCash: number;
  figures: ShiftFigures;
}

export function CashMetrics({ startingCash, figures }: CashMetricsProps) {
  const text = t.cashDrawer.metrics;
  return (
    <MetricStrip label={text.label}>
      <MetricCell
        active
        tone="accent"
        icon={<DollarSign size={18} aria-hidden="true" />}
        label={text.drawer}
        value={formatIDR(figures.expected)}
        footnote={text.startingCash(formatIDR(startingCash))}
      />
      <MetricCell
        tone="accent"
        icon={<ArrowDownLeft size={18} aria-hidden="true" />}
        label={text.cashSales}
        value={formatIDR(figures.cashSales)}
        footnote={text.nonCash(formatIDR(figures.nonCashSales), figures.paidOrders.length)}
      />
      <MetricCell
        tone="success"
        icon={<ArrowDownLeft size={18} aria-hidden="true" />}
        label={text.cashIn}
        value={`+${formatIDR(figures.cashIn)}`}
        footnote={text.cashInNote}
      />
      <MetricCell
        tone="error"
        icon={<ArrowUpRight size={18} aria-hidden="true" />}
        label={text.cashOut}
        value={`-${formatIDR(figures.cashOut)}`}
        footnote={text.cashOutNote}
      />
    </MetricStrip>
  );
}
