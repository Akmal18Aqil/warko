import { describe, expect, it } from "vitest";
import { PENDING_ORDER_KEY, readPendingOrder, shouldClearSubmittedCart } from "./pendingOrder";

describe("pending self-order", () => {
  it("restores the original table, cart, total, and idempotency key", () => {
    const saved = { tableId: "meja-1", customerName: "Tamu", lines: [{ itemId: "kopi", qty: 2 }], clientRef: "a".repeat(32), paymentChoice: "pay-later", expectedTotal: 22200 };
    const storage = { getItem: (key: string) => key === PENDING_ORDER_KEY ? JSON.stringify(saved) : null } as Storage;
    expect(readPendingOrder(storage)).toEqual(saved);
  });

  it("rejects malformed persisted orders", () => {
    const storage = { getItem: () => '{"lines":[]}' } as unknown as Storage;
    expect(readPendingOrder(storage)).toBeNull();
  });

  it("preserves a new identical cart when recovering an earlier order", () => {
    const lines = [{ itemId: "kopi", qty: 1 }];
    expect(shouldClearSubmittedCart(true, lines, [...lines])).toBe(false);
  });

  it("clears a newly submitted cart only if it remained unchanged", () => {
    const lines = [{ itemId: "kopi", qty: 1 }];
    expect(shouldClearSubmittedCart(false, lines, [...lines])).toBe(true);
    expect(shouldClearSubmittedCart(false, lines, [{ itemId: "kopi", qty: 2 }])).toBe(false);
  });
});
