import { useState } from "react";
import { Percent } from "lucide-react";
import { CATALOG_WRITE_ROLES } from "@wakro/shared";
import { useCan } from "../../app/useCan";
import { t } from "../../locales/id";
import { Button } from "../../ui/Button";
import { usePricing } from "../../state/pricing";
import { PricingModal } from "./PricingModal";
import { SettingsCard } from "./SettingsCard";

export function PricingCard() {
  const pricing = usePricing();
  const [editing, setEditing] = useState(false);
  const canEdit = useCan(CATALOG_WRITE_ROLES);

  const parts = [
    pricing.taxEnabled ? t.settings.pricing.taxPart(pricing.taxRate) : null,
    pricing.serviceChargeEnabled ? t.settings.pricing.servicePart(pricing.serviceChargeRate) : null,
  ].filter((part): part is string => part !== null);

  return (
    <>
      <SettingsCard
        icon={<Percent size={19} aria-hidden="true" />}
        label={t.settings.pricing.label}
        value={parts.length > 0 ? parts.join(" + ") : t.settings.pricing.none}
        note={canEdit ? t.settings.pricing.note : t.settings.readOnly.pricing}
        action={
          canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              {t.settings.pricing.edit}
            </Button>
          )
        }
      />
      {editing && <PricingModal pricing={pricing} onClose={() => setEditing(false)} />}
    </>
  );
}
