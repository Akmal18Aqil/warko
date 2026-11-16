import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { OrderRow } from "../types/domain";
import { escPosPayload, receiptFromOrder } from "../lib/receipt";
import { getPrinterDriver } from "../services/printer/index";

export type ReportPayload = {
  title: string;
  period: string;
  rows: Array<{ label: string; orders: number; items: number; sales: string }>;
  totalSales: string;
  totalOrders: number;
};

export type ReportRow = { label: string; value: string; strong?: boolean };

/** End-of-shift (Z) report, already formatted for paper. */
export type ZReportPayload = {
  /** Cashier, opening and closing time. */
  details: ReportRow[];
  /** Starting cash, sales, cash in / out, expected, counted and difference. */
  figures: ReportRow[];
  /** Counted notes and coins; empty when the cash was typed in as one amount. */
  denominations: ReportRow[];
  notes?: string;
};

/** What the print layer renders. Without a job it shows the live cashier cart as a receipt preview. */
type PrintJob =
  | { kind: "cart" }
  | { kind: "order"; order: OrderRow }
  | { kind: "report"; report: ReportPayload }
  | { kind: "zreport"; report: ZReportPayload };

type PrintContextValue = {
  job: PrintJob;
  printReport: (payload: ReportPayload) => void;
  printZReport: (payload: ZReportPayload) => void;
  /** Prints a stored order's receipt with the configured driver (browser or ESC/POS Bluetooth). */
  printOrderReceipt: (order: OrderRow) => Promise<void>;
};

const CART_JOB: PrintJob = { kind: "cart" };

const PrintContext = createContext<PrintContextValue | null>(null);

export function PrintProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<PrintJob>(CART_JOB);

  /** Renders `next` into the print layer, opens the browser print dialog, then restores the cart preview. */
  const printWithBrowser = useCallback(
    (next: PrintJob) =>
      new Promise<void>((resolve) => {
        setJob(next);
        setTimeout(() => {
          window.print();
          setJob(CART_JOB);
          resolve();
        }, 80);
      }),
    [],
  );

  const printReport = useCallback((report: ReportPayload) => void printWithBrowser({ kind: "report", report }), [printWithBrowser]);
  const printZReport = useCallback((report: ZReportPayload) => void printWithBrowser({ kind: "zreport", report }), [printWithBrowser]);

  const printOrderReceipt = useCallback(
    async (order: OrderRow) => {
      const driver = getPrinterDriver();
      if (driver.id !== "browser") {
        await driver.printReceipt(escPosPayload(receiptFromOrder(order)));
        return;
      }
      await printWithBrowser({ kind: "order", order });
    },
    [printWithBrowser],
  );

  const value = useMemo(
    () => ({ job, printReport, printZReport, printOrderReceipt }),
    [job, printReport, printZReport, printOrderReceipt],
  );

  return <PrintContext.Provider value={value}>{children}</PrintContext.Provider>;
}

export function usePrint(): PrintContextValue {
  const ctx = useContext(PrintContext);
  if (!ctx) throw new Error("usePrint harus dipakai di dalam PrintProvider");
  return ctx;
}
