import { useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";
import { Button } from "../../ui/Button";
import { getAvailablePrinterDrivers, getPrinterDriver, setPrinterDriver } from "../../services/printer/index";
import { STORE_PROFILE } from "../../lib/storeProfile";
import { SettingsCard } from "./SettingsCard";

const TEST_PRINT_AMOUNT = 25_000;

export function PrinterCard() {
  const [driver, setDriver] = useState(() => getPrinterDriver());
  const drivers = getAvailablePrinterDrivers();

  const choose = (id: (typeof drivers)[number]["id"]) => {
    if (id === driver.id) return;
    setPrinterDriver(id);
    const updated = getPrinterDriver();
    setDriver(updated);
    toast.success(t.settings.printer.changed(updated.label));
  };

  const testPrint = async () => {
    const amount = formatIDR(TEST_PRINT_AMOUNT);
    try {
      await driver.printReceipt({
        orderNo: 0,
        total: amount,
        details: [STORE_PROFILE.outlet, t.printing.receipt.sampleNote],
        lines: [{ qty: 1, name: t.settings.printer.testItem, amount }],
      });
    } catch (err) {
      toast.warning(err instanceof Error ? err.message : t.settings.printer.testFailed);
    }
  };

  return (
    <SettingsCard
      icon={<Printer size={19} aria-hidden="true" />}
      label={t.settings.printer.label}
      value={driver.label}
      note={t.settings.printer.note}
    >
      <div className="flex flex-wrap gap-2">
        <div role="radiogroup" aria-label={t.settings.printer.drivers} className="flex flex-wrap gap-2">
          {drivers.map((option) => (
            <Button
              key={option.id}
              role="radio"
              aria-checked={option.id === driver.id}
              variant={option.id === driver.id ? "ink" : "outline"}
              size="sm"
              onClick={() => choose(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => void testPrint()}>
          {t.settings.printer.testPrint}
        </Button>
      </div>
    </SettingsCard>
  );
}
