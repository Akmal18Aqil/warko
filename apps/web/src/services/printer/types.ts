export type ReceiptPayload = {
  orderNo: number;
  total: string;
  lines: Array<{ qty: number; name: string; amount: string }>;
  /** Header lines under the order number: table/floor, cashier, date. */
  details?: string[];
  /** Rows between the items and TOTAL: subtotal, discount, service, tax. */
  summary?: Array<{ label: string; amount: string }>;
  /** Rows after TOTAL: payment method, cash received, change. */
  payment?: Array<{ label: string; amount: string }>;
};

export interface PrinterDriver {
  readonly id: "browser" | "escpos-bluetooth";
  readonly label: string;
  printReceipt(payload: ReceiptPayload): Promise<void>;
}
