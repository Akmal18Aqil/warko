import type { PricingSettings } from "@wakro/shared";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { t } from "../../locales/id";
import { savePricing } from "../../state/pricing";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";

const TAX_RATE_PRESETS = [0, 10, 11, 12] as const;
const SERVICE_RATE_PRESETS = [0, 5, 7, 10] as const;
const MAX_RATE_PERCENT = 100;

function isValidRate(rate: number): boolean {
  return Number.isFinite(rate) && rate >= 0 && rate <= MAX_RATE_PERCENT;
}

interface RateFieldProps {
  toggleLabel: string;
  rateLabel: string;
  presets: readonly number[];
  enabled: boolean;
  rate: string;
  onEnabledChange: (enabled: boolean) => void;
  onRateChange: (rate: string) => void;
}

function RateField({ toggleLabel, rateLabel, presets, enabled, rate, onEnabledChange, onRateChange }: RateFieldProps) {
  const toggleId = useId();
  return (
    <div className="rounded-xl border border-ink/10 bg-mineral/30 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={toggleId} className="text-sm font-bold text-ink">
          {toggleLabel}
        </label>
        <input
          id={toggleId}
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          className="h-4 w-4 cursor-pointer rounded accent-accent"
        />
      </div>
      {enabled && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Input
            type="number"
            size="sm"
            min={0}
            max={MAX_RATE_PERCENT}
            step="any"
            label={rateLabel}
            value={rate}
            onChange={(event) => onRateChange(event.target.value)}
            wrapperClassName="w-32"
          />
          <div className="flex gap-1 pb-0.5">
            {presets.map((preset) => (
              <Button key={preset} variant="outline" size="sm" onClick={() => onRateChange(String(preset))}>
                {t.settings.pricing.presetRate(preset)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Edits tax and service charge; mounted only while open so the form always starts from the saved values. */
export function PricingModal({ pricing, onClose }: { pricing: PricingSettings; onClose: () => void }) {
  const [taxEnabled, setTaxEnabled] = useState(pricing.taxEnabled);
  const [taxRate, setTaxRate] = useState(String(pricing.taxRate));
  const [serviceEnabled, setServiceEnabled] = useState(pricing.serviceChargeEnabled);
  const [serviceRate, setServiceRate] = useState(String(pricing.serviceChargeRate));
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTaxRate = Number.parseFloat(taxRate);
    const nextServiceRate = Number.parseFloat(serviceRate);
    if (!isValidRate(nextTaxRate) || !isValidRate(nextServiceRate)) {
      toast.error(t.settings.pricing.invalidRate);
      return;
    }
    setSaving(true);
    try {
      await savePricing({
        taxEnabled,
        taxRate: nextTaxRate,
        serviceChargeEnabled: serviceEnabled,
        serviceChargeRate: nextServiceRate,
      });
      toast.success(t.settings.pricing.saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.settings.pricing.saveFailed);
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm" closeOnBackdrop={!saving}>
      <ModalHeader title={t.settings.pricing.modalTitle} subtitle={t.settings.pricing.modalSubtitle} />
      <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-4">
          <RateField
            toggleLabel={t.settings.pricing.taxToggle}
            rateLabel={t.settings.pricing.taxRate}
            presets={TAX_RATE_PRESETS}
            enabled={taxEnabled}
            rate={taxRate}
            onEnabledChange={setTaxEnabled}
            onRateChange={setTaxRate}
          />
          <RateField
            toggleLabel={t.settings.pricing.serviceToggle}
            rateLabel={t.settings.pricing.serviceRate}
            presets={SERVICE_RATE_PRESETS}
            enabled={serviceEnabled}
            rate={serviceRate}
            onEnabledChange={setServiceEnabled}
            onRateChange={setServiceRate}
          />
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="outline" disabled={saving} onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button size="sm" type="submit" loading={saving}>
            {t.common.save}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
