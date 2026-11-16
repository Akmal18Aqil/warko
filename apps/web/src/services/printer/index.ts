import { BrowserPrintDriver } from "./BrowserPrintDriver";
import { EscPosBluetoothDriver } from "./EscPosBluetoothDriver";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import type { PrinterDriver, ReceiptPayload } from "./types";

export type { PrinterDriver, ReceiptPayload };

const browserDriver = new BrowserPrintDriver();
const bluetoothDriver = new EscPosBluetoothDriver();

const drivers: Record<string, PrinterDriver> = {
  browser: browserDriver,
  "escpos-bluetooth": bluetoothDriver,
};

export function getAvailablePrinterDrivers(): PrinterDriver[] {
  return [browserDriver, bluetoothDriver];
}

export function getPrinterDriver(): PrinterDriver {
  if (typeof window !== "undefined") {
    const savedId = localStorage.getItem(STORAGE_KEYS.printerDriver);
    if (savedId && drivers[savedId]) {
      return drivers[savedId];
    }
  }
  return browserDriver;
}

export function setPrinterDriver(id: "browser" | "escpos-bluetooth"): void {
  if (typeof window !== "undefined" && drivers[id]) {
    localStorage.setItem(STORAGE_KEYS.printerDriver, id);
  }
}
