import { MAX_MONEY } from "@wakro/shared";
import type { Env } from "../env";
import { assertBodyId, changes, validId } from "../guards";
import { conflict, HttpError, invalid, json, Reader } from "../http";
import { FINANCE_ROLES } from "../policy";
import { readCursor, readLimit, toPage } from "../pagination";
import type { AuthedContext, Route } from "../router";
import {
  MOVEMENT_COLUMNS, SHIFT_COLUMNS, serializeCashMovement, serializeShift, type CashMovementRow, type ShiftRow,
} from "../rows";
import { resourceRoutes } from "./resources";

const SHIFT_STATUSES = ["OPEN", "CLOSED"] as const;
const MOVEMENT_TYPES = ["CASH_IN", "CASH_OUT"] as const;
const MOVEMENT_CATEGORIES = ["modal_awal", "operasional", "bahan_baku", "setoran", "tips", "lainnya"] as const;

const MAX_DENOMINATIONS = 20;
const DEFAULT_PAGE = 100;
const MAX_PAGE = 500;

/** Bootstrap sends the open shift plus everything from the last 31 days, capped. */
const BOOTSTRAP_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;
const BOOTSTRAP_MAX_SHIFTS = 100;
const BOOTSTRAP_MAX_MOVEMENTS = 1000;

// ---- bootstrap slices ------------------------------------------------------

/** Open shift + shifts opened in the last 31 days, newest first. `limit` 0 returns nothing. */
export function recentShiftsStatement(env: Env, now: number, limit: number): D1PreparedStatement {
  return env.DB.prepare(
    `SELECT ${SHIFT_COLUMNS} FROM shifts WHERE status = 'OPEN' OR opened_at >= ?1
     ORDER BY opened_at DESC, id DESC LIMIT ?2`,
  ).bind(now - BOOTSTRAP_WINDOW_MS, limit);
}

/** Movements of the shifts above or from the last 31 days, newest first. `limit` 0 returns nothing. */
export function recentMovementsStatement(env: Env, now: number, limit: number): D1PreparedStatement {
  return env.DB.prepare(
    `SELECT ${MOVEMENT_COLUMNS} FROM cash_movements
      WHERE deleted_at IS NULL AND (occurred_at >= ?1 OR shift_id IN (
        SELECT id FROM (SELECT id FROM shifts WHERE status = 'OPEN' OR opened_at >= ?1
                        ORDER BY opened_at DESC, id DESC LIMIT ?2)))
      ORDER BY occurred_at DESC, id DESC LIMIT ?3`,
  ).bind(now - BOOTSTRAP_WINDOW_MS, BOOTSTRAP_MAX_SHIFTS, limit);
}

export const BOOTSTRAP_LIMITS = { shifts: BOOTSTRAP_MAX_SHIFTS, movements: BOOTSTRAP_MAX_MOVEMENTS } as const;

// ---- shifts --------------------------------------------------------------

/** GET /api/resources/shifts?status=&limit=&cursor= — newest first, keyset-paged on (opened_at, id). */
async function listShifts({ env, url }: AuthedContext): Promise<Response> {
  const limit = readLimit(url, DEFAULT_PAGE, MAX_PAGE);
  const cursor = readCursor(url);
  const status = url.searchParams.get("status");
  if (status !== null && !(SHIFT_STATUSES as readonly string[]).includes(status)) {
    throw invalid("status", `status harus salah satu dari: ${SHIFT_STATUSES.join(", ")}.`);
  }

  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (status !== null) {
    where.push("status = ?");
    binds.push(status);
  }
  if (cursor) {
    where.push("(opened_at, id) < (?, ?)");
    binds.push(cursor[0], String(cursor[1]));
  }
  const { results } = await env.DB.prepare(
    `SELECT ${SHIFT_COLUMNS} FROM shifts ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY opened_at DESC, id DESC LIMIT ?`,
  )
    .bind(...binds, limit + 1)
    .all<ShiftRow>();
  const page = toPage(results, limit, (row) => [row.opened_at, row.id]);
  return json({ data: page.rows.map(serializeShift), nextCursor: page.nextCursor });
}

async function findShift({ env }: AuthedContext, id: string): Promise<unknown | null> {
  const row = await loadShift(env, id);
  return row ? serializeShift(row) : null;
}

function loadShift(env: Env, id: string): Promise<ShiftRow | null> {
  return env.DB.prepare(`SELECT ${SHIFT_COLUMNS} FROM shifts WHERE id = ?`).bind(id).first<ShiftRow>();
}

function readDenominations(r: Reader): string | null {
  const value = r.object("denominations");
  if (value === undefined) return null;
  const entries = Object.entries(value);
  if (entries.length > MAX_DENOMINATIONS) {
    r.addError("denominations", `denominations maksimal ${MAX_DENOMINATIONS} pecahan.`);
    return null;
  }
  const clean: Record<string, number> = {};
  for (const [key, count] of entries) {
    if (!/^\d{1,9}$/.test(key)) {
      r.addError("denominations", "Kunci pecahan harus berupa angka.");
      return null;
    }
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || count > 1_000_000) {
      r.addError("denominations", "Jumlah lembar harus bilangan bulat 0-1000000.");
      return null;
    }
    clean[key] = count;
  }
  return JSON.stringify(clean);
}

/**
 * Shift totals are never taken from the client. While the shift is CLOSED, the statement itself sums
 * cash sales (paid `tunai` orders inside [openedAt, closedAt]) and the shift's live cash movements
 * (the `modal_awal` opening float is already part of startingCash, so it is not counted as cash in),
 * then derives expected cash and the difference, so the numbers always match what the database holds.
 */
async function upsertShift({ env, staff }: AuthedContext, id: string, body: Record<string, unknown>): Promise<unknown> {
  assertBodyId(body, id);
  const r = new Reader(body, { strict: true });
  r.allow("id");
  const openedAt = r.timestamp("openedAt");
  const closedAt = r.timestamp("closedAt", { optional: true });
  const startingCash = r.integer("startingCash", { min: 0, max: MAX_MONEY, optional: true });
  const actualCash = r.integer("actualCash", { min: 0, max: MAX_MONEY, optional: true });
  const denominations = readDenominations(r);
  const status = r.oneOf("status", SHIFT_STATUSES);
  const notes = r.string("notes", { max: 1000, optional: true });
  if (status === "CLOSED" && closedAt === undefined) r.addError("closedAt", "closedAt wajib diisi untuk shift yang ditutup.");
  if (status === "OPEN" && closedAt !== undefined) r.addError("closedAt", "Shift yang masih buka tidak boleh memiliki closedAt.");
  if (closedAt !== undefined && closedAt < openedAt) r.addError("closedAt", "closedAt tidak boleh sebelum openedAt.");
  r.done();

  const isAdmin = staff.role === "admin" ? 1 : 0;
  const existing = await env.DB.prepare("SELECT status FROM shifts WHERE id = ?").bind(id).first<{ status: string }>();
  if (existing?.status === "CLOSED" && !isAdmin) throw new HttpError(403, "Shift yang sudah ditutup hanya dapat diubah oleh admin.");
  if (status === "OPEN") {
    const other = await env.DB.prepare("SELECT 1 AS found FROM shifts WHERE status = 'OPEN' AND id <> ?").bind(id).first();
    if (other) throw conflict("Masih ada shift lain yang terbuka; tutup shift tersebut terlebih dahulu.");
  }

  // The guards are repeated inside the statement so concurrent writes cannot bypass them.
  // `cashier_name` is set once, from the session of whoever opened the shift.
  const result = await env.DB.prepare(
    `INSERT INTO shifts (id, opened_at, closed_at, cashier_name, starting_cash, actual_cash, expected_cash,
       cash_difference, cash_sales_total, cash_in_total, cash_out_total, denominations, status, notes,
       created_at, updated_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6,
       CASE WHEN ?8 = 'CLOSED' THEN ?5 + t.sales + t.cash_in - t.cash_out END,
       CASE WHEN ?8 = 'CLOSED' AND ?6 IS NOT NULL THEN ?6 - (?5 + t.sales + t.cash_in - t.cash_out) END,
       CASE WHEN ?8 = 'CLOSED' THEN t.sales END,
       CASE WHEN ?8 = 'CLOSED' THEN t.cash_in END,
       CASE WHEN ?8 = 'CLOSED' THEN t.cash_out END,
       ?7, ?8, ?9, ?10, ?10
     FROM (SELECT
       (SELECT COALESCE(SUM(total), 0) FROM orders
         WHERE payment_status = 'paid' AND method = 'tunai' AND paid_at >= ?2 AND paid_at <= ?3) AS sales,
       (SELECT COALESCE(SUM(amount), 0) FROM cash_movements
         WHERE shift_id = ?1 AND type = 'CASH_IN' AND category <> 'modal_awal' AND deleted_at IS NULL) AS cash_in,
       (SELECT COALESCE(SUM(amount), 0) FROM cash_movements
         WHERE shift_id = ?1 AND type = 'CASH_OUT' AND deleted_at IS NULL) AS cash_out) t
     WHERE (?8 = 'CLOSED' OR NOT EXISTS (SELECT 1 FROM shifts WHERE status = 'OPEN' AND id <> ?1))
     ON CONFLICT(id) DO UPDATE SET opened_at = excluded.opened_at, closed_at = excluded.closed_at,
       starting_cash = excluded.starting_cash, actual_cash = excluded.actual_cash,
       expected_cash = excluded.expected_cash, cash_difference = excluded.cash_difference,
       cash_sales_total = excluded.cash_sales_total, cash_in_total = excluded.cash_in_total,
       cash_out_total = excluded.cash_out_total, denominations = excluded.denominations,
       status = excluded.status, notes = excluded.notes, updated_at = excluded.updated_at
     WHERE (?11 = 1 OR shifts.status = 'OPEN')`,
  )
    .bind(id, openedAt, closedAt ?? null, staff.name, startingCash ?? 0, actualCash ?? null, denominations, status, notes ?? null, Date.now(), isAdmin)
    .run();
  if (changes(result) === 0) throw conflict("Shift berubah saat disimpan; muat ulang lalu coba lagi.");

  const row = await loadShift(env, id);
  if (!row) throw conflict("Shift tidak ditemukan setelah disimpan.");
  return serializeShift(row);
}

async function removeShift({ env, staff }: AuthedContext, id: string): Promise<void> {
  const isAdmin = staff.role === "admin" ? 1 : 0;
  if (!isAdmin) {
    const row = await env.DB.prepare("SELECT status FROM shifts WHERE id = ?").bind(id).first<{ status: string }>();
    if (row?.status === "CLOSED") throw new HttpError(403, "Shift yang sudah ditutup hanya dapat dihapus oleh admin.");
  }
  // Movements of a deleted shift are soft-deleted with it so the audit trail survives.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM shifts WHERE id = ? AND (? = 1 OR status = 'OPEN')").bind(id, isAdmin),
    env.DB.prepare("UPDATE cash_movements SET deleted_at = ? WHERE shift_id = ? AND deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM shifts WHERE id = ?)")
      .bind(Date.now(), id, id),
  ]);
}

// ---- cash movements ------------------------------------------------------

/** GET /api/resources/cashMovements?limit=&cursor= — newest first, keyset-paged on (occurred_at, id). */
async function listMovements({ env, url }: AuthedContext): Promise<Response> {
  const limit = readLimit(url, DEFAULT_PAGE, MAX_PAGE);
  const cursor = readCursor(url);
  const { results } = await env.DB.prepare(
    `SELECT ${MOVEMENT_COLUMNS} FROM cash_movements
      WHERE deleted_at IS NULL ${cursor ? "AND (occurred_at, id) < (?, ?)" : ""}
      ORDER BY occurred_at DESC, id DESC LIMIT ?`,
  )
    .bind(...(cursor ? [cursor[0], String(cursor[1])] : []), limit + 1)
    .all<CashMovementRow>();
  const page = toPage(results, limit, (row) => [row.occurred_at, row.id]);
  return json({ data: page.rows.map(serializeCashMovement), nextCursor: page.nextCursor });
}

/** Movements that belong to a CLOSED shift are frozen for everyone but admins. */
async function assertShiftsOpenForEdit(env: Env, staff: AuthedContext["staff"], shiftIds: (string | null)[]): Promise<void> {
  if (staff.role === "admin") return;
  const [a, b] = [shiftIds[0] ?? null, shiftIds[1] ?? null];
  const closed = await env.DB.prepare("SELECT 1 AS found FROM shifts WHERE status = 'CLOSED' AND id IN (?, ?)").bind(a, b).first();
  if (closed) throw new HttpError(403, "Mutasi kas pada shift yang sudah ditutup hanya dapat diubah oleh admin.");
}

async function upsertMovement({ env, staff }: AuthedContext, id: string, body: Record<string, unknown>): Promise<unknown> {
  assertBodyId(body, id);
  const r = new Reader(body, { strict: true });
  r.allow("id");
  const shiftIdInput = r.string("shiftId", { max: 100, optional: true });
  const type = r.oneOf("type", MOVEMENT_TYPES);
  const category = r.oneOf("category", MOVEMENT_CATEGORIES);
  const amount = r.integer("amount", { min: 0, max: MAX_MONEY });
  const description = r.string("description", { max: 500, optional: true });
  const createdAt = r.timestamp("createdAt", { optional: true });
  r.done();

  const shiftId = shiftIdInput ? validId("shiftId", shiftIdInput) : null;
  const isAdmin = staff.role === "admin" ? 1 : 0;
  const existing = await env.DB.prepare("SELECT shift_id, deleted_at FROM cash_movements WHERE id = ?")
    .bind(id)
    .first<{ shift_id: string | null; deleted_at: number | null }>();
  if (existing?.deleted_at != null) throw conflict("Mutasi kas ini sudah dihapus.");
  await assertShiftsOpenForEdit(env, staff, [existing?.shift_id ?? null, shiftId]);

  // The closed-shift guard is repeated inside the statement so a concurrent shift close cannot be bypassed.
  // The actor (`cashier_name`) is recorded once, from the session, and kept on later edits.
  const result = await env.DB.prepare(
    `INSERT INTO cash_movements (id, shift_id, type, category, amount, description, cashier_name, occurred_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, COALESCE(?8, ?10)
      WHERE (?9 = 1 OR NOT EXISTS (SELECT 1 FROM shifts WHERE id = ?2 AND status = 'CLOSED'))
     ON CONFLICT(id) DO UPDATE SET shift_id = excluded.shift_id, type = excluded.type,
       category = excluded.category, amount = excluded.amount, description = excluded.description,
       occurred_at = COALESCE(?8, cash_movements.occurred_at)
     WHERE cash_movements.deleted_at IS NULL
       AND (?9 = 1 OR NOT EXISTS (SELECT 1 FROM shifts WHERE id = cash_movements.shift_id AND status = 'CLOSED'))`,
  )
    .bind(id, shiftId, type, category, amount, description ?? "", staff.name, createdAt ?? null, isAdmin, Date.now())
    .run();
  if (changes(result) === 0) throw conflict("Mutasi kas berubah saat disimpan; muat ulang lalu coba lagi.");

  const row = await env.DB.prepare(`SELECT ${MOVEMENT_COLUMNS} FROM cash_movements WHERE id = ?`).bind(id).first<CashMovementRow>();
  if (!row) throw conflict("Mutasi kas tidak ditemukan setelah disimpan.");
  return serializeCashMovement(row);
}

/** Soft delete: the row stays for audit but never appears in lists or bootstrap again. */
async function removeMovement({ env, staff }: AuthedContext, id: string): Promise<void> {
  const existing = await env.DB.prepare("SELECT shift_id FROM cash_movements WHERE id = ? AND deleted_at IS NULL")
    .bind(id)
    .first<{ shift_id: string | null }>();
  if (!existing) return;
  await assertShiftsOpenForEdit(env, staff, [existing.shift_id]);
  await env.DB.prepare(
    `UPDATE cash_movements SET deleted_at = ?1
      WHERE id = ?2 AND deleted_at IS NULL
        AND (?3 = 1 OR NOT EXISTS (SELECT 1 FROM shifts WHERE id = cash_movements.shift_id AND status = 'CLOSED'))`,
  )
    .bind(Date.now(), id, staff.role === "admin" ? 1 : 0)
    .run();
}

// ---- routes --------------------------------------------------------------

export const cashRoutes: Route[] = [
  ...resourceRoutes({
    name: "shifts",
    readRoles: FINANCE_ROLES,
    writeRoles: FINANCE_ROLES,
    list: listShifts,
    find: findShift,
    upsert: upsertShift,
    remove: removeShift,
  }),
  ...resourceRoutes({
    name: "cashMovements",
    readRoles: FINANCE_ROLES,
    writeRoles: FINANCE_ROLES,
    list: listMovements,
    upsert: upsertMovement,
    remove: removeMovement,
  }),
];
