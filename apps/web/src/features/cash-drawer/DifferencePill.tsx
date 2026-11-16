import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";
import { Badge } from "../../ui/Badge";
import { cn } from "../../lib/cn";

interface DifferencePillProps {
  /** Counted cash minus expected cash. */
  difference: number;
  large?: boolean;
}

/** Exact, surplus or short: the one way the drawer difference is shown. */
export function DifferencePill({ difference, large = false }: DifferencePillProps) {
  const text = t.cashDrawer.difference;
  const size = cn("gap-1.5", large && "px-3 py-1 text-xs");
  if (difference === 0) {
    return (
      <Badge tone="success" className={size}>
        <CheckCircle2 size={large ? 14 : 12} aria-hidden="true" />
        {text.exact}
      </Badge>
    );
  }
  if (difference > 0) {
    return (
      <Badge tone="warning" className={size}>
        {text.surplus(formatIDR(difference))}
      </Badge>
    );
  }
  return (
    <Badge tone="error" className={size}>
      <AlertTriangle size={large ? 14 : 12} aria-hidden="true" />
      {text.minus(formatIDR(Math.abs(difference)))}
    </Badge>
  );
}
