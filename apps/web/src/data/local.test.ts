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

  it("does not restore deleted data when the database is reopened", async () => {
    await db.products.clear();
    db.close();
    await localSource.init();
    expect(await localSource.loadProducts()).toEqual([]);
  });
});
