import { beforeEach, describe, expect, it } from "vitest";
import { api, readJson, resetDb, seedCategory, seedProduct, signIn } from "./helpers";

beforeEach(async () => {
  await resetDb();
  await seedCategory();
  await seedProduct("A1");
});

describe("GET /api/bootstrap", () => {
  it("returns an ETag and answers 304 while nothing changed", async () => {
    const { session } = await signIn("kasir");
    const first = await api("/api/bootstrap", { session });
    expect(first.status).toBe(200);
    const etag = first.headers.get("ETag")!;
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    expect(first.headers.get("Cache-Control")).toBe("no-store");
    expect((await readJson(first)).data.products).toHaveLength(1);

    const same = await api("/api/bootstrap", { session, headers: { "If-None-Match": etag } });
    expect(same.status).toBe(304);
    expect(await same.text()).toBe("");
    expect(same.headers.get("ETag")).toBe(etag);
  });

  it("returns a new body and ETag after data changes", async () => {
    const { session } = await signIn("kasir");
    const etag = (await api("/api/bootstrap", { session })).headers.get("ETag")!;
    await seedProduct("B1");
    const changed = await api("/api/bootstrap", { session, headers: { "If-None-Match": etag } });
    expect(changed.status).toBe(200);
    expect(changed.headers.get("ETag")).not.toBe(etag);
    expect((await readJson(changed)).data.products).toHaveLength(2);
  });

  it("leaves cash data out for roles that cannot see it", async () => {
    const cashier = await signIn("kasir");
    await api("/api/resources/shifts/s1", { session: cashier.session, method: "PUT", body: { id: "s1", openedAt: Date.now(), status: "OPEN" } });
    const waiter = await signIn("pelayan");
    const { data } = await readJson(await api("/api/bootstrap", { session: waiter.session }));
    expect(data.shifts).toEqual([]);
    expect(data.cashMovements).toEqual([]);
    // Waiters still learn whether cash payments are accepted.
    expect(data.cashShiftOpen).toBe(true);
  });

  it("reports that cash is not accepted while no shift is open", async () => {
    const { session } = await signIn("pelayan");
    expect((await readJson(await api("/api/bootstrap", { session }))).data.cashShiftOpen).toBe(false);
  });
});
