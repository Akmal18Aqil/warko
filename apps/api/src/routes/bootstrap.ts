import { sha256Hex } from "../crypto";
import { batchTyped } from "../db";
import { jsonText } from "../http";
import { operationalOrderStatements, serializeOrders, type OrderDbRow, type OrderItemDbRow } from "../orders";
import { FINANCE_ROLES, READ_ROLES } from "../policy";
import { parsePricing, pricingStatement, type PricingRow } from "../pricing";
import {
  CATEGORY_LIST_SQL, PRODUCT_LIST_SQL, serializeCashMovement, serializeCategory, serializeProduct, serializeShift,
  serializeTable, TABLE_LIST_SQL, type CashMovementRow, type CategoryRow, type ProductRow, type ShiftRow, type TableRow,
} from "../rows";
import { get, type AuthedContext, type Route } from "../router";
import { BOOTSTRAP_LIMITS, recentMovementsStatement, recentShiftsStatement } from "./cash";

/** True when `If-None-Match` lists `etag` (weak validators and `*` included). */
function etagMatches(header: string | null, etag: string): boolean {
  if (header === null) return false;
  return header
    .split(",")
    .map((candidate) => candidate.trim().replace(/^W\//, ""))
    .some((candidate) => candidate === etag || candidate === "*");
}

/**
 * Everything the POS needs at start-up and on every poll. The body's SHA-256 is its ETag, so an
 * unchanged snapshot answers `304` with no body and the client keeps its state.
 */
async function bootstrap({ request, env, staff }: AuthedContext): Promise<Response> {
  const finance = FINANCE_ROLES.includes(staff.role);
  const now = Date.now();
  // One D1 batch = one consistent snapshot. Cash statements return no rows for non-finance roles.
  const [products, orders, items, tables, categories, pricing, shifts, movements, openShift] = await batchTyped<
    [ProductRow, OrderDbRow, OrderItemDbRow, TableRow, CategoryRow, PricingRow, ShiftRow, CashMovementRow, { open: number }]
  >(env.DB, [
    env.DB.prepare(PRODUCT_LIST_SQL),
    ...operationalOrderStatements(env, now),
    env.DB.prepare(TABLE_LIST_SQL),
    env.DB.prepare(CATEGORY_LIST_SQL),
    pricingStatement(env),
    recentShiftsStatement(env, now, finance ? BOOTSTRAP_LIMITS.shifts : 0),
    recentMovementsStatement(env, now, finance ? BOOTSTRAP_LIMITS.movements : 0),
    // Every role may know whether cash can be taken (the API refuses cash without an open shift).
    env.DB.prepare("SELECT EXISTS (SELECT 1 FROM shifts WHERE status = 'OPEN') AS open"),
  ]);

  const body = JSON.stringify({
    data: {
      products: products.map(serializeProduct),
      orders: serializeOrders(orders, items),
      tables: tables.map(serializeTable),
      categories: categories.map(serializeCategory),
      pricing: parsePricing(pricing),
      shifts: shifts.map(serializeShift),
      cashMovements: movements.map(serializeCashMovement),
      cashShiftOpen: openShift[0]?.open === 1,
    },
  });
  const etag = `"${await sha256Hex(body)}"`;
  if (etagMatches(request.headers.get("If-None-Match"), etag)) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "no-store" } });
  }
  return jsonText(body, 200, { ETag: etag });
}

export const bootstrapRoutes: Route[] = [get("/api/bootstrap", READ_ROLES, bootstrap)];
