import { Banknote, Vault } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { formatIDR } from "../../data/menu";
import { playDrawerBeep } from "../../lib/audioFeedback";
import { isPaid, runningOrdersCount, salesToday } from "../../lib/orderStatus";
import { t } from "../../locales/id";
import { useOrders } from "../../state/orders";
import { Button } from "../../ui/Button";
import { MetricCell, MetricStrip } from "../../ui/MetricStrip";

/** Running orders, today's sales and average order at the top of the cashier screen. */
export function PosMetricStrip() {
  const [, setLocation] = useLocation();
  const orders = useOrders();
  const paidOrders = orders.filter(isPaid);
  const avgOrder =
    paidOrders.length > 0 ? Math.round(paidOrders.reduce((sum, o) => sum + o.total, 0) / paidOrders.length) : 0;

  const handleOpenDrawerClick = () => {
    playDrawerBeep();
    toast.success(t.pos.metrics.drawerBeepTitle, {
      description: t.pos.metrics.drawerBeepBody,
      icon: <Vault size={16} className="text-accent-dark" />,
      action: { label: t.pos.metrics.openCashModule, onClick: () => setLocation("/laci-kas") },
    });
  };

  return (
    <MetricStrip label={t.pos.metrics.label}>
      <MetricCell active label={t.pos.metrics.running} value={String(runningOrdersCount(orders)).padStart(2, "0")} />
      <MetricCell label={t.pos.metrics.todaySales} value={formatIDR(salesToday(orders))} />
      <MetricCell label={t.pos.metrics.avgOrder} value={formatIDR(avgOrder)} />
      <div className="flex items-center justify-center p-3">
        <Button variant="outline" size="sm" onClick={handleOpenDrawerClick} className="h-8 text-xs">
          <Banknote size={15} />
          {t.pos.metrics.openDrawer}
        </Button>
      </div>
    </MetricStrip>
  );
}
