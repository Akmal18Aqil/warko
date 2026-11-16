import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { localSource } from "./local";

describe("local data source", () => {
  beforeAll(async () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    await localSource.init();
  });

  afterAll(async () => {
    db.close();
    await db.delete();
    vi.unstubAllGlobals();
  });

  it("loads seeded restaurant tables and persists table changes", async () => {
    const snapshot = await localSource.loadSnapshot();
    expect(snapshot.tables.length).toBeGreaterThan(0);
    const table = { id: "test-table", name: "Meja Uji", seats: 4, area: "Lantai 1" };
    await localSource.saveTable(table);
    expect(await localSource.loadTables()).toContainEqual(table);
    await localSource.deleteTable(table.id);
    expect(await localSource.loadTables()).not.toContainEqual(table);
  });

  it("accepts cash only while a shift is open, like the API", async () => {
    const unpaid = { no: 0, status: "memasak" as const, paymentStatus: "unpaid" as const, kitchenStatus: "queued" as const,
      total: 11_100, itemCount: 0, items: [], orderType: "bawa-pulang" as const, createdAt: 0 };
    const paidCash = { ...unpaid, paymentStatus: "paid" as const, method: "tunai" as const };
    await expect(localSource.saveOrder(paidCash, { clientRef: "cash-no-shift", cashReceived: 20_000 })).rejects.toThrow("Buka shift");

    const open = await localSource.saveOrder(unpaid, { clientRef: "open-order" });
    await expect(localSource.settleOrder(open.no, "tunai", "Kasir", 20_000)).rejects.toThrow("Buka shift");
    expect((await localSource.loadSnapshot()).cashShiftOpen).toBe(false);

    await localSource.saveShift({ id: "shift-test", openedAt: Date.now(), cashierName: "Kasir", startingCash: 0, status: "OPEN" });
    expect((await localSource.settleOrder(open.no, "tunai", "Kasir", 20_000)).order.paymentStatus).toBe("paid");
    expect((await localSource.loadSnapshot()).cashShiftOpen).toBe(true);
  });

  it("does not restore deleted data when the database is reopened", async () => {
    await db.products.clear();
    db.close();
    await localSource.init();
    expect(await localSource.loadProducts()).toEqual([]);
  });
});
