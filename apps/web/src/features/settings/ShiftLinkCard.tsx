import { Vault } from "lucide-react";
import { useLocation } from "wouter";
import { t } from "../../locales/id";
import { Button } from "../../ui/Button";
import { useActiveShift } from "../../state/shift";
import { SettingsCard } from "./SettingsCard";

/** Shift and drawer handling lives in the Laci Kas module; Settings only points to it. */
export function ShiftLinkCard() {
  const [, setLocation] = useLocation();
  const activeShift = useActiveShift();

  return (
    <SettingsCard
      icon={<Vault size={19} aria-hidden="true" />}
      label={t.settings.shift.label}
      value={activeShift ? t.settings.shift.active(activeShift.cashierName) : t.settings.shift.inactive}
      note={t.settings.shift.note}
      action={
        <Button variant="outline" size="sm" onClick={() => setLocation("/laci-kas")}>
          {t.settings.shift.open}
        </Button>
      }
    />
  );
}
