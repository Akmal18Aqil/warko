import { describe, expect, it } from "vitest";
import type { CashMovementRow, OrderRow } from "../types/domain";
import { expectedDrawerCash } from "./cash";

const shift = { id: "s1", openedAt: 1_000, closedAt: undefined as number | undefined, startingCash: 200_000 };

const order = (no: number, patch: Partial<OrderRow>): OrderRow => ({
  no,
  status: "sudah-dibayar",
  paymentStatus: "paid",
  total: 50_000,
  itemCount: 1,
  orderType: "bawa-pulang",
  method: "tunai",
  cashShiftId: "s1",
  paidAt: 2_000,
  createdAt: 1_500,
  ...patch,
});

const movement = (id: string, patch: Partial<CashMovementRow>): CashMovementRow => ({
  id,
  shiftId: "s1",
  type: "CASH_IN",
  category: "lainnya",
  amount: 10_000,
  description: "",
  cashierName: "Kasir",
  createdAt: 2_000,
  ...patch,
});

describe("expectedDrawerCash", () => {
  it("is starting cash + cash sales + cash in - cash out", () => {
    const result = expectedDrawerCash(
      shift,
      [order(1, { total: 50_000 }), order(2, { total: 25_000 })],
      [movement("a", { amount: 15_000 }), movement("b", { type: "CASH_OUT", amount: 5_000 })],
    );
    expect(result).toMatchObject({ cashSales: 75_000, cashIn: 15_000, cashOut: 5_000, expected: 285_000 });
  });

  it("counts only paid cash orders recorded against the shift", () => {
    const closed = { ...shift, closedAt: 3_000 };
    const result = expectedDrawerCash(
      closed,
      [
        order(1, {}),
        order(2, { method: "qris" }),
        order(3, { paymentStatus: "unpaid", paidAt: undefined }),
        order(4, { paymentStatus: "refunded" }),
        order(5, { paidAt: 999 }),
        order(6, { paidAt: 3_001 }),
        order(7, { cashShiftId: "other" }),
        order(8, { cashShiftId: undefined }),
      ],
      [],
    );
    // Orders 1, 5 and 6 belong to the shift whatever their paid time; the display list keeps the time window.
    expect(result.cashSales).toBe(150_000);
    expect(result.paidOrders.map((o) => o.no)).toEqual([1, 2, 7, 8]);
    expect(result.expected).toBe(350_000);
  });

  it("excludes modal_awal cash-in because starting cash already counts it", () => {
    const result = expectedDrawerCash(
      shift,
      [],
      [movement("a", { category: "modal_awal", amount: 200_000 }), movement("b", { amount: 10_000 })],
    );
    expect(result).toMatchObject({ cashIn: 10_000, expected: 210_000 });
  });

  it("ignores movements recorded against other shifts or none", () => {
    const result = expectedDrawerCash(
      shift,
      [],
      [movement("a", { shiftId: "other", amount: 99_000 }), movement("b", { shiftId: undefined, amount: 99_000 })],
    );
    expect(result).toMatchObject({ cashIn: 0, cashOut: 0, expected: 200_000 });
  });
});
