import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { OrderRow } from "../lib/db";
import { escPosPayload, receiptFromOrder } from "../lib/receipt";
import { getPrinterDriver } from "../services/printer";

export type ReportPayload = {
  title: string;
  period: string;
  rows: Array<{ label: string; orders: number; items: number; sales: string }>;
  totalSales: string;
  totalOrders: number;
};

type PrintMode = "receipt" | "report" | "order";

type PrintContextValue = {
  mode: PrintMode;
  report: ReportPayload | null;
  /** Order whose receipt is being printed by the browser driver. */
  order: OrderRow | null;
  printReport: (payload: ReportPayload) => void;
  /** Prints a stored order's receipt with the configured driver (browser or ESC/POS Bluetooth). */
  printOrderReceipt: (order: OrderRow) => Promise<void>;
};

const PrintContext = createContext<PrintContextValue | null>(null);

export function PrintProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PrintMode>("receipt");
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [order, setOrder] = useState<OrderRow | null>(null);

  const printReport = useCallback((payload: ReportPayload) => {
    setReport(payload);
    setMode("report");
    setTimeout(() => {
      window.print();
      setMode("receipt");
    }, 80);
  }, []);

  const printOrderReceipt = useCallback(async (target: OrderRow) => {
    const driver = getPrinterDriver();
    if (driver.id !== "browser") {
      await driver.printReceipt(escPosPayload(receiptFromOrder(target)));
      return;
    }
    setOrder(target);
    setMode("order");
    await new Promise<void>((resolve) =>
      setTimeout(() => {
        window.print();
        setMode("receipt");
        resolve();
      }, 80),
    );
  }, []);

  const value = useMemo(
    () => ({ mode, report, order, printReport, printOrderReceipt }),
    [mode, report, order, printReport, printOrderReceipt],
  );

  return <PrintContext.Provider value={value}>{children}</PrintContext.Provider>;
}

export function usePrint(): PrintContextValue {
  const ctx = useContext(PrintContext);
  if (!ctx) throw new Error("usePrint harus dipakai di dalam PrintProvider");
  return ctx;
}
