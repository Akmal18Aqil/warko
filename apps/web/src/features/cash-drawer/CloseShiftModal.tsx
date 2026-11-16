import { Calculator, Coins, Minus, Plus, ReceiptText } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatIDR } from "../../data/menu";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import { closeShift } from "../../state/shift";
import type { ShiftRecord } from "../../types/domain";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { DENOMINATIONS, type Denomination, type DenominationCounts } from "./constants";
import { DifferencePill } from "./DifferencePill";
import { errorMessage, formatAmountInput, parseAmount } from "./format";

interface CloseShiftModalProps {
  /** Cash the system expects in the drawer. */
  expectedCash: number;
  onClose: () => void;
  onClosed: (shift: ShiftRecord) => void;
}

function denominationName(d: Denomination): string {
  return d.coin ? t.cashDrawer.closeShiftModal.coinName(formatIDR(d.value)) : formatIDR(d.value);
}

function countedTotal(counts: DenominationCounts): number {
  return DENOMINATIONS.reduce((sum, d) => sum + d.value * (counts[d.value] ?? 0), 0);
}

export function CloseShiftModal({ expectedCash, onClose, onClosed }: CloseShiftModalProps) {
  const text = t.cashDrawer.closeShiftModal;
  const [useCalculator, setUseCalculator] = useState(true);
  const [counts, setCounts] = useState<DenominationCounts>({});
  const [manualCash, setManualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const countedCash = useMemo(() => (useCalculator ? countedTotal(counts) : parseAmount(manualCash)), [useCalculator, counts, manualCash]);
  const difference = countedCash - expectedCash;

  const setCount = (value: number, next: number) => setCounts((prev) => ({ ...prev, [value]: Math.max(0, next) }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      // Denominations are only meaningful when the total came from the calculator.
      const denominations = useCalculator
        ? Object.fromEntries(DENOMINATIONS.filter((d) => (counts[d.value] ?? 0) > 0).map((d) => [String(d.value), counts[d.value]]))
        : undefined;
      const closed = await closeShift(countedCash, notes.trim() || undefined, denominations);
      const toasts = t.cashDrawer.toast;
      const gap = closed.cashDifference ?? 0;
      if (gap === 0) toast.success(toasts.shiftClosedExact(formatIDR(countedCash)));
      else if (gap > 0) toast.warning(toasts.shiftClosedSurplus(formatIDR(gap)));
      else toast.error(toasts.shiftClosedMinus(formatIDR(Math.abs(gap))));
      onClosed(closed);
    } catch (error) {
      toast.error(errorMessage(error, t.cashDrawer.toast.shiftCloseFailed));
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader
        title={text.title}
        subtitle={text.subtitle}
        icon={
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-error/30 bg-error/15 text-error-dark">
            <Calculator size={20} aria-hidden="true" />
          </span>
        }
      />
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-ink/10 bg-mineral/60 p-3">
            <div className="flex items-center gap-2">
              <Coins size={16} className="text-accent-dark" aria-hidden="true" />
              <span className="text-xs font-semibold text-ink">{text.calculatorTitle}</span>
            </div>
            <button
              type="button"
              onClick={() => setUseCalculator(!useCalculator)}
              className="text-xs font-semibold text-accent-dark hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {useCalculator ? text.switchToManual : text.switchToCalculator}
            </button>
          </div>

          {useCalculator ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink-soft">{text.denominationsHint}</p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {DENOMINATIONS.map((d) => (
                  <DenominationRow
                    key={d.value}
                    denomination={d}
                    count={counts[d.value] ?? 0}
                    onChange={(next) => setCount(d.value, next)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <Input
              label={text.manualCash}
              type="text"
              inputMode="numeric"
              required
              value={manualCash}
              onChange={(e) => setManualCash(formatAmountInput(e.target.value))}
              placeholder={text.manualPlaceholder}
              size="lg"
              className="font-bold"
            />
          )}

          <div className="space-y-2 rounded-xl border border-ink/10 bg-mineral/60 p-4">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{text.expected}</span>
              <span className="font-mono font-bold text-ink">{formatIDR(expectedCash)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{text.counted}</span>
              <span className="font-mono text-base font-black text-ink">{formatIDR(countedCash)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-ink/10 pt-2">
              <span className="text-xs font-bold text-ink">{text.differenceStatus}</span>
              <DifferencePill difference={difference} large />
            </div>
          </div>

          <Input
            label={
              <>
                {text.notes} ({t.common.optional})
              </>
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={text.notesPlaceholder}
          />
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="danger" size="sm" loading={saving} className="gap-2 font-bold">
            <ReceiptText size={16} aria-hidden="true" />
            {text.submit}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

interface DenominationRowProps {
  denomination: Denomination;
  count: number;
  onChange: (next: number) => void;
}

function DenominationRow({ denomination, count, onChange }: DenominationRowProps) {
  const text = t.cashDrawer.closeShiftModal;
  const name = denominationName(denomination);
  const stepper =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-ink/15 bg-surface text-ink transition-colors hover:bg-mineral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink/10 bg-mineral/30 p-2.5">
      <div>
        <span className={cn("inline-block rounded border px-2 py-0.5 text-xs font-bold", denomination.tone)}>{name}</span>
        <div className="mt-0.5 font-mono text-xs text-text-muted">= {formatIDR(denomination.value * count)}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label={text.decrease(name)} onClick={() => onChange(count - 1)} className={stepper}>
          <Minus size={14} aria-hidden="true" />
        </button>
        <input
          type="number"
          min={0}
          aria-label={text.countOf(name)}
          value={count === 0 ? "" : count}
          onChange={(e) => onChange(Number.parseInt(e.target.value, 10) || 0)}
          placeholder="0"
          className="h-8 w-14 rounded-lg border border-ink/15 bg-surface text-center text-sm font-bold text-ink focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button type="button" aria-label={text.increase(name)} onClick={() => onChange(count + 1)} className={stepper}>
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
