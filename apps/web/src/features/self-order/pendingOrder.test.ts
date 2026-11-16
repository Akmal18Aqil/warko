import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import { cartUnchanged, readPendingOrder } from "./pendingOrder";

describe("pending self-order", () => {
  it("restores the original table, cart, total, and idempotency key", () => {
    const saved = {
      tableId: "meja-1",
      customerName: "Tamu",
      lines: [{ itemId: "kopi", qty: 2 }],
      clientRef: "a".repeat(32),
      paymentChoice: "pay-later",
      expectedTotal: 22200,
    };
    const storage = { getItem: (key: string) => (key === STORAGE_KEYS.selfPendingOrder ? JSON.stringify(saved) : null) } as Storage;
    expect(readPendingOrder(storage)).toEqual(saved);
  });

  it("rejects malformed persisted orders", () => {
    const storage = { getItem: () => '{"lines":[]}' } as unknown as Storage;
    expect(readPendingOrder(storage)).toBeNull();
  });

  it("detects whether the cart was edited while the order was being sent", () => {
    const lines = [{ itemId: "kopi", qty: 1 }];
    expect(cartUnchanged(lines, [...lines])).toBe(true);
    expect(cartUnchanged(lines, [{ itemId: "kopi", qty: 2 }])).toBe(false);
  });
});
