import { AlertTriangle } from "lucide-react";
import { t } from "../../locales/id";
import { Button } from "../../ui/Button";

interface PendingOrderNoticeProps {
  submitting: boolean;
  onRetry: () => void;
}

/** Shown while a sent order's outcome is unknown; new orders stay blocked until it is resolved. */
export function PendingOrderNotice({ submitting, onRetry }: PendingOrderNoticeProps) {
  const text = t.selfOrder.pending;
  return (
    <section role="status" className="space-y-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
      <div className="flex gap-2.5">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="font-bold text-warning-dark">{text.title}</h2>
          <p className="text-sm text-ink">{text.body}</p>
        </div>
      </div>
      <Button className="w-full" loading={submitting} disabled={submitting} onClick={onRetry}>
        {submitting ? text.retrying : text.retry}
      </Button>
    </section>
  );
}
