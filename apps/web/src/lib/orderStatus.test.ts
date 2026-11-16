import { describe, expect, it } from "vitest";
import type { OrderRow } from "../types/domain";
import { isHandledBy, runningOrdersCount, salesToday } from "./orderStatus";

const order = (patch: Partial<OrderRow>): OrderRow => ({
  no: 1,
  status: "memasak",
  total: 10_000,
  itemCount: 1,
  orderType: "meja",
  createdAt: Date.now(),
  ...patch,
});

describe("isHandledBy", () => {
  const staff = { id: "staff-2" };

  it("matches the waiter id", () => {
    expect(isHandledBy(order({ waiterId: "staff-2" }), staff)).toBe(true);
  });

  it("does not match another waiter, even with the same name", () => {
    expect(isHandledBy(order({ waiterId: "staff-3", waiterName: "Budi Santoso" }), staff)).toBe(false);
  });

  it("does not match by name or customer name when the id is missing", () => {
    expect(isHandledBy(order({ waiterName: "Budi Santoso", customerName: "Budi" }), staff)).toBe(false);
  });
});

describe("order aggregates", () => {
  it("counts only kitchen-active orders as running", () => {
    const orders = [order({ kitchenStatus: "queued" }), order({ kitchenStatus: "served" }), order({ kitchenStatus: "ready" })];
    expect(runningOrdersCount(orders)).toBe(2);
  });

  it("sums only orders paid today", () => {
    const now = Date.now();
    const orders = [
      order({ paymentStatus: "paid", paidAt: now, total: 30_000 }),
      order({ paymentStatus: "paid", paidAt: now - 3 * 24 * 3600_000, total: 99_000 }),
      order({ paymentStatus: "unpaid", total: 5_000 }),
    ];
    expect(salesToday(orders)).toBe(30_000);
  });
});
