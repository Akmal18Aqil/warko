import { Banknote, Vault } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Button } from "./ui/Button";
import { playDrawerBeep } from "../lib/audioFeedback";
import { useOrders } from "../state/orders";
import { formatIDR } from "../data/menu";
import { t } from "../locales/en";
import { isPaid, runningOrdersCount, salesToday } from "../lib/orderStatus";

export function MetricStrip() {
  const [, setLocation] = useLocation();
  const orders = useOrders();
  const running = runningOrdersCount(orders);
  const paidOrders = orders.filter(isPaid);
  const avgOrder =
    paidOrders.length > 0
      ? Math.round(
          paidOrders.reduce((sum, o) => sum + o.total, 0) / paidOrders.length,
        )
      : 0;

  const handleOpenDrawerClick = () => {
    playDrawerBeep();
    toast.success("Bunyi laci kas diputar", {
      description: "Perintah buka laci ke printer belum didukung; buka laci secara manual.",
      icon: <Vault size={16} className="text-accent-dark" />,
      action: {
        label: "Buka Modul Kas",
        onClick: () => setLocation("/laci-kas"),
      },
    });
  };

  return (
    <section
      aria-label="Ringkasan operasional"
      className="grid grid-cols-2 divide-ink/8 overflow-hidden rounded-2xl border border-ink/8 bg-white lg:grid-cols-4 lg:divide-x shadow-2xs"
    >
      <MetricCell
        active
        label={t.metrics.running}
        value={String(running).padStart(2, "0")}
      />
      <MetricCell
        label={t.metrics.todaySales}
        value={formatIDR(salesToday(orders))}
      />
      <MetricCell
        label={t.metrics.avgOrder}
        value={formatIDR(avgOrder)}
      />
      <div className="flex items-center justify-center p-3">
        <Button variant="outline" size="sm" onClick={handleOpenDrawerClick} className="h-8 text-xs">
          <Banknote size={15} />
          {t.metrics.openDrawer}
        </Button>
      </div>
    </section>
  );
}

function MetricCell({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="relative min-w-0 px-4 py-3.5 md:px-5">
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent"
        />
      )}
      <p className="label-caps text-[10px] font-semibold text-ink/50">{label}</p>
      <p className="mt-0.5 truncate font-display text-base font-bold tracking-tight text-ink md:text-lg">
        {value}
      </p>
    </div>
  );
}
