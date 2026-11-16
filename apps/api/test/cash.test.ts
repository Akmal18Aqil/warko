import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { api, readJson, resetDb, seedCategory, seedProduct, signIn } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

function putShift(session: string, id: string, body: Record<string, unknown>) {
  return api(`/api/resources/shifts/${id}`, { session, method: "PUT", body: { id, ...body } });
}

function putMovement(session: string, id: string, body: Record<string, unknown>) {
  return api(`/api/resources/cashMovements/${id}`, { session, method: "PUT", body: { id, type: "CASH_IN", category: "lainnya", amount: 1_000, ...body } });
}

beforeEach(async () => {
  await resetDb();
  await seedCategory();
  await seedProduct("A1", { price: 10_000 });
});

describe("closing a shift", () => {
  it("computes the cash totals on the server from orders and movements", async () => {
    const cashier = await signIn("kasir", "Sari");
    const openedAt = Date.now() - 1_000;
    const opened = await putShift(cashier.session, "shift-1", { openedAt, startingCash: 100_000, status: "OPEN" });
    expect(opened.status).toBe(200);
    expect((await readJson(opened)).data).toMatchObject({ cashierName: "Sari", expectedCash: null, cashSalesTotal: null });

    // 22.200 in cash counts; the QRIS order does not.
    const paidCash = await api("/api/orders", {
      session: cashier.session,
      body: { orderType: "bawa-pulang", items: [{ barcode: "A1", qty: 2 }], expectedTotal: 22_200, method: "tunai", cashReceived: 25_000 },
    });
    expect(paidCash.status).toBe(201);
    await api("/api/orders", {
      session: cashier.session,
      body: { orderType: "bawa-pulang", items: [{ barcode: "A1", qty: 1 }], expectedTotal: 11_100, method: "qris" },
    });

    // The opening float is already in startingCash and must not be counted again.
    await putMovement(cashier.session, "m-float", { shiftId: "shift-1", type: "CASH_IN", category: "modal_awal", amount: 100_000 });
    await putMovement(cashier.session, "m-in", { shiftId: "shift-1", type: "CASH_IN", amount: 5_000 });
    await putMovement(cashier.session, "m-out", { shiftId: "shift-1", type: "CASH_OUT", amount: 2_000 });
    await putMovement(cashier.session, "m-gone", { shiftId: "shift-1", type: "CASH_OUT", amount: 99_000 });
    expect((await api("/api/resources/cashMovements/m-gone", { session: cashier.session, method: "DELETE" })).status).toBe(200);

    const closed = await putShift(cashier.session, "shift-1", {
      openedAt,
      closedAt: Date.now() + 1_000,
      startingCash: 100_000,
      actualCash: 130_000,
      denominations: { "100000": 1, "10000": 3 },
      status: "CLOSED",
    });
    expect(closed.status).toBe(200);
    expect((await readJson(closed)).data).toMatchObject({
      status: "CLOSED",
      cashierName: "Sari",
      cashSalesTotal: 22_200,
      cashInTotal: 5_000,
      cashOutTotal: 2_000,
      expectedCash: 125_200,
      actualCash: 130_000,
      cashDifference: 4_800,
      denominations: { "100000": 1, "10000": 3 },
    });
  });

  it("attributes a concurrent cash payment to the shift only if it commits before closing", async () => {
    const { session } = await signIn("kasir");
    const openedAt = Date.now() - 1_000;
    expect((await putShift(session, "race-shift", { openedAt, status: "OPEN" })).status).toBe(200);
    const [payment, closed] = await Promise.all([
      api("/api/orders", {
        session,
        body: { orderType: "bawa-pulang", items: [{ barcode: "A1", qty: 1 }], expectedTotal: 11_100, method: "tunai", cashReceived: 15_000 },
      }),
      putShift(session, "race-shift", { openedAt, closedAt: Date.now() + 1_000, actualCash: 0, status: "CLOSED" }),
    ]);
    expect(payment.status).toBe(201);
    expect(closed.status).toBe(200);
    const created = (await readJson(payment)).data;
    const stored = await env.DB.prepare("SELECT cash_shift_id FROM orders WHERE no = ?").bind(created.no).first<{ cash_shift_id: string | null }>();
    expect((await readJson(closed)).data.cashSalesTotal).toBe(stored?.cash_shift_id === "race-shift" ? 11_100 : 0);
  });

  it("includes settlement in its open shift even when the client close clock is behind", async () => {
    const { session } = await signIn("kasir");
    const openedAt = Date.now() - 60_000;
    await putShift(session, "clock-shift", { openedAt, status: "OPEN" });
    const created = await api("/api/orders", {
      session, body: { orderType: "bawa-pulang", items: [{ barcode: "A1", qty: 1 }], expectedTotal: 11_100 },
    });
    const no = (await readJson(created)).data.no;
    expect((await api(`/api/orders/${no}/payment`, { session, body: { method: "tunai", cashReceived: 15_000 } })).status).toBe(200);
    const closed = await putShift(session, "clock-shift", { openedAt, closedAt: openedAt + 1, actualCash: 11_100, status: "CLOSED" });
    expect((await readJson(closed)).data.cashSalesTotal).toBe(11_100);
  });

  it("rejects totals, cashier names and unknown fields sent by the client", async () => {
    const { session } = await signIn("kasir");
    const response = await putShift(session, "shift-1", {
      openedAt: Date.now(),
      status: "OPEN",
      expectedCash: 1,
      cashSalesTotal: 2,
      cashierName: "Orang Lain",
    });
    expect(response.status).toBe(422);
    expect(Object.keys((await readJson(response)).errors).sort()).toEqual(["cashSalesTotal", "cashierName", "expectedCash"]);
  });

  it("keeps the original cashier when another role edits the shift", async () => {
    const cashier = await signIn("kasir", "Sari");
    const admin = await signIn("admin", "Bu Admin");
    const openedAt = Date.now() - 5_000;
    await putShift(cashier.session, "shift-1", { openedAt, status: "OPEN" });
    const edited = await putShift(admin.session, "shift-1", { openedAt, status: "OPEN", notes: "dicek" });
    expect((await readJson(edited)).data).toMatchObject({ cashierName: "Sari", notes: "dicek" });
  });

  it("allows only one open shift and lets only admins edit a closed one", async () => {
    const cashier = await signIn("kasir");
    const now = Date.now();
    expect((await putShift(cashier.session, "s1", { openedAt: now - 9_000, closedAt: now - 8_000, actualCash: 0, status: "CLOSED" })).status).toBe(200);
    expect((await putShift(cashier.session, "s2", { openedAt: now, status: "OPEN" })).status).toBe(200);
    expect((await putShift(cashier.session, "s3", { openedAt: now, status: "OPEN" })).status).toBe(409);
    expect((await putShift(cashier.session, "s1", { openedAt: now - 9_000, closedAt: now - 8_000, actualCash: 5, status: "CLOSED" })).status).toBe(403);
  });
});

describe("cash movements", () => {
  async function closedShiftWithMovement() {
    const cashier = await signIn("kasir");
    const admin = await signIn("admin");
    const now = Date.now();
    await putShift(cashier.session, "shift-1", { openedAt: now - 5_000, status: "OPEN" });
    await putMovement(cashier.session, "m1", { shiftId: "shift-1", amount: 4_000 });
    await putShift(cashier.session, "shift-1", { openedAt: now - 5_000, closedAt: now, actualCash: 4_000, status: "CLOSED" });
    return { cashier, admin };
  }

  it("records the signed-in staff member and rejects a client cashierName", async () => {
    const cashier = await signIn("kasir", "Sari");
    const created = await putMovement(cashier.session, "m1", { amount: 2_500 });
    expect((await readJson(created)).data).toMatchObject({ id: "m1", cashierName: "Sari", amount: 2_500 });
    const forged = await putMovement(cashier.session, "m2", { cashierName: "Orang Lain" });
    expect(forged.status).toBe(422);
  });

  it("freezes movements of a closed shift for all roles", async () => {
    const { cashier, admin } = await closedShiftWithMovement();
    expect((await putMovement(cashier.session, "m1", { shiftId: "shift-1", amount: 9_000 })).status).toBe(403);
    expect((await api("/api/resources/cashMovements/m1", { session: cashier.session, method: "DELETE" })).status).toBe(403);
    expect((await putMovement(cashier.session, "m-new", { shiftId: "shift-1" })).status).toBe(403);
    expect((await putMovement(admin.session, "m1", { shiftId: "shift-1", amount: 9_000 })).status).toBe(403);
    expect((await api("/api/resources/cashMovements/m1", { session: admin.session, method: "DELETE" })).status).toBe(403);
  });

  it("soft-deletes: the row stays for audit but disappears from lists", async () => {
    const cashier = await signIn("kasir");
    await putMovement(cashier.session, "m1", {});
    await putMovement(cashier.session, "m2", {});
    expect((await api("/api/resources/cashMovements/m1", { session: cashier.session, method: "DELETE" })).status).toBe(200);
    const listed = await readJson(await api("/api/resources/cashMovements", { session: cashier.session }));
    expect(listed.data.map((m: { id: string }) => m.id)).toEqual(["m2"]);
    const row = await env.DB.prepare("SELECT deleted_at FROM cash_movements WHERE id = 'm1'").first<{ deleted_at: number | null }>();
    expect(row!.deleted_at).not.toBeNull();
    expect((await putMovement(cashier.session, "m1", {})).status).toBe(409);
  });

  it("hides cash data from floor and kitchen staff", async () => {
    const { session } = await signIn("pelayan");
    expect((await api("/api/resources/shifts", { session })).status).toBe(403);
    expect((await api("/api/resources/cashMovements", { session })).status).toBe(403);
  });
});

describe("paged lists", () => {
  it("walks shifts newest-first with an opaque cursor", async () => {
    const { session } = await signIn("kasir");
    const base = Date.now() - 10 * DAY;
    for (let i = 0; i < 5; i++) {
      const openedAt = base + i * DAY;
      await putShift(session, `s${i}`, { openedAt, closedAt: openedAt + 1_000, actualCash: 0, status: "CLOSED" });
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const response: Response = await api(`/api/resources/shifts?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { session });
      const page: { data: { id: string }[]; nextCursor: string | null } = await readJson(response);
      seen.push(...page.data.map((s) => s.id));
      cursor = page.nextCursor;
      pages++;
    } while (cursor);
    expect(seen).toEqual(["s4", "s3", "s2", "s1", "s0"]);
    expect(pages).toBe(3);
  });

  it("pages cash movements and validates cursor and limit", async () => {
    const { session } = await signIn("kasir");
    const now = Date.now();
    for (let i = 0; i < 3; i++) await putMovement(session, `m${i}`, { createdAt: now - i * 1_000 });
    const first = await readJson(await api("/api/resources/cashMovements?limit=2", { session }));
    expect(first.data.map((m: { id: string }) => m.id)).toEqual(["m0", "m1"]);
    const second = await readJson(await api(`/api/resources/cashMovements?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`, { session }));
    expect(second.data.map((m: { id: string }) => m.id)).toEqual(["m2"]);
    expect(second.nextCursor).toBeNull();
    expect((await api("/api/resources/cashMovements?cursor=garbage", { session })).status).toBe(422);
    expect((await api("/api/resources/cashMovements?limit=501", { session })).status).toBe(422);
  });

  it("returns only the open shift for ?status=OPEN and one shift by id", async () => {
    const { session } = await signIn("kasir");
    const now = Date.now();
    await putShift(session, "old", { openedAt: now - 9_000, closedAt: now - 8_000, actualCash: 0, status: "CLOSED" });
    await putShift(session, "current", { openedAt: now, status: "OPEN" });
    const open = await readJson(await api("/api/resources/shifts?status=OPEN", { session }));
    expect(open.data.map((s: { id: string }) => s.id)).toEqual(["current"]);
    expect((await readJson(await api("/api/resources/shifts/old", { session }))).data.id).toBe("old");
    expect((await api("/api/resources/shifts/missing", { session })).status).toBe(404);
  });

  it("pages the order report by (created_at, no)", async () => {
    const { session } = await signIn("kasir");
    for (let i = 0; i < 5; i++) {
      await api("/api/orders", { session, body: { orderType: "bawa-pulang", items: [{ barcode: "A1", qty: 1 }], expectedTotal: 11_100 } });
    }
    const range = `from=${Date.now() - DAY}&to=${Date.now() + DAY}`;
    const first = await readJson(await api(`/api/reports/orders?${range}&limit=3`, { session }));
    expect(first.data).toHaveLength(3);
    expect(first.data[0].items).toHaveLength(1);
    const second = await readJson(await api(`/api/reports/orders?${range}&limit=3&cursor=${encodeURIComponent(first.nextCursor)}`, { session }));
    expect(second.data).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    const numbers = [...first.data, ...second.data].map((o: { no: number }) => o.no);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(5);
  });
});

describe("bootstrap scope", () => {
  it("sends the open shift plus the last 31 days and their movements only", async () => {
    const { session } = await signIn("kasir");
    const now = Date.now();
    await putShift(session, "ancient", { openedAt: now - 60 * DAY, closedAt: now - 59 * DAY, actualCash: 0, status: "CLOSED" });
    await putShift(session, "recent", { openedAt: now - 5 * DAY, closedAt: now - 4 * DAY, actualCash: 0, status: "CLOSED" });
    await putShift(session, "open", { openedAt: now - 40 * DAY, status: "OPEN" });
    await putMovement(session, "m-ancient", { shiftId: "ancient", createdAt: now - 60 * DAY });
    await putMovement(session, "m-of-open", { shiftId: "open", createdAt: now - 40 * DAY });
    await putMovement(session, "m-recent", { createdAt: now - DAY });

    const { data } = await readJson(await api("/api/bootstrap", { session }));
    expect(data.shifts.map((s: { id: string }) => s.id)).toEqual(["recent", "open"]);
    expect(data.cashMovements.map((m: { id: string }) => m.id).sort()).toEqual(["m-of-open", "m-recent"]);
  });
});
