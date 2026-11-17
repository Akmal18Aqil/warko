import { Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatIDR } from "../../data/menu";
import { STORE_PROFILE } from "../../lib/storeProfile";
import { t } from "../../locales/id";
import { getAvailablePrinterDrivers, getPrinterDriver, setPrinterDriver } from "../../services/printer/index";
import { getPaperWidth, PAPER_WIDTHS, type PaperWidth, setPaperWidth } from "../../services/printer/paper";
import { Button } from "../../ui/Button";
import { SettingsCard } from "./SettingsCard";

const TEST_PRINT_AMOUNT = 25_000;

export function PrinterCard() {
  const [driver, setDriver] = useState(() => getPrinterDriver());
  const [paper, setPaper] = useState(getPaperWidth);
  const drivers = getAvailablePrinterDrivers();

  const choosePaper = (width: PaperWidth) => {
    if (width === paper) return;
    setPaperWidth(width);
    setPaper(width);
    toast.success(t.settings.printer.paperChanged(width));
  };

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
      value={`${driver.label} · ${t.settings.printer.paper(paper)}`}
      note={t.settings.printer.note}
    >
      <div className="flex flex-wrap gap-2">
        <fieldset className="flex min-w-0 flex-wrap gap-2">
          <legend className="sr-only">{t.settings.printer.drivers}</legend>
          {drivers.map((option) => (
            <Button
              key={option.id}
              aria-pressed={option.id === driver.id}
              variant={option.id === driver.id ? "ink" : "outline"}
              size="sm"
              onClick={() => choose(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </fieldset>
        <fieldset className="flex min-w-0 flex-wrap gap-2">
          <legend className="sr-only">{t.settings.printer.paperLabel}</legend>
          {PAPER_WIDTHS.map((width) => (
            <Button
              key={width}
              aria-pressed={width === paper}
              variant={width === paper ? "ink" : "outline"}
              size="sm"
              onClick={() => choosePaper(width)}
            >
              {t.settings.printer.paper(width)}
            </Button>
          ))}
        </fieldset>
        <Button variant="outline" size="sm" onClick={() => void testPrint()}>
          {t.settings.printer.testPrint}
        </Button>
      </div>
    </SettingsCard>
  );
}
