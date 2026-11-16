import { Clock, PlusCircle, ReceiptText, Vault } from "lucide-react";
import { t } from "../../locales/id";
import type { ShiftRecord } from "../../types/domain";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { formatTime } from "./format";

interface ShiftStatusBannerProps {
  shift: ShiftRecord | null;
  /** Shown as the cashier while no shift is open. */
  staffName: string;
  onOpenDrawer: () => void;
  onOpenShift: () => void;
  onCloseShift: () => void;
}

export function ShiftStatusBanner({ shift, staffName, onOpenDrawer, onOpenShift, onCloseShift }: ShiftStatusBannerProps) {
  const text = t.cashDrawer.banner;
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-ink/10 bg-surface p-5 shadow-clay md:flex-row md:items-center">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-accent/30 bg-accent/20 text-accent-dark">
          <Vault size={24} aria-hidden="true" />
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-lg font-bold tracking-tight text-ink sm:text-xl">{text.title}</h2>
            {shift ? (
              <Badge tone="accent" className="gap-1.5">
                <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-dark" />
                {text.active}
              </Badge>
            ) : (
              <Badge>{text.closed}</Badge>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-text-muted sm:text-sm">
            <span>
              {text.cashier}: <strong className="font-semibold text-ink">{shift?.cashierName ?? staffName}</strong>
            </span>
            {shift ? (
              <>
                <span aria-hidden="true">•</span>
                <span className="flex items-center gap-1">
                  <Clock size={14} className="text-text-light" aria-hidden="true" />
                  {text.openedAt}: {formatTime(shift.openedAt)}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="outline" size="sm" onClick={onOpenDrawer} className="gap-2 font-medium">
          <Vault size={16} className="text-accent-dark" aria-hidden="true" />
          {text.openDrawer}
        </Button>
        {shift ? (
          <Button variant="danger" size="sm" onClick={onCloseShift} className="gap-2 font-semibold">
            <ReceiptText size={16} aria-hidden="true" />
            {text.closeShift}
          </Button>
        ) : (
          <Button size="sm" onClick={onOpenShift} className="gap-2 font-semibold">
            <PlusCircle size={16} aria-hidden="true" />
            {text.openShift}
          </Button>
        )}
      </div>
    </div>
  );
}
