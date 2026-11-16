/** Row types, column lists and JSON serializers for catalog and cash-drawer data. */

export type ProductRow = {
  id: string;
  barcode: string;
  name: string;
  description: string;
  price: number;
  category: string;
  kind: string;
  prep_minutes: number;
  badge: string | null;
  image: string;
  stock: number | null;
};

export type TableRow = { id: string; name: string; seats: number; area: string; active: number };

export type CategoryRow = {
  id: string;
  name: string;
  kind: string;
  color: string | null;
  sort_order: number;
  is_default: number;
  created_at: number;
};

export type ShiftRow = {
  id: string;
  opened_at: number;
  closed_at: number | null;
  cashier_name: string;
  starting_cash: number;
  actual_cash: number | null;
  expected_cash: number | null;
  cash_difference: number | null;
  cash_sales_total: number | null;
  cash_in_total: number | null;
  cash_out_total: number | null;
  denominations: string | null;
  status: string;
  notes: string | null;
};

export type CashMovementRow = {
  id: string;
  shift_id: string | null;
  type: string;
  category: string;
  amount: number;
  description: string;
  cashier_name: string;
  occurred_at: number;
};

/** Products carry a category foreign key; the API still exposes the category name. */
export const PRODUCT_SELECT = `SELECT p.id, p.barcode, p.name, p.description, p.price, COALESCE(c.name, '') AS category,
  p.kind, p.prep_minutes, p.badge, p.image, p.stock
  FROM products p LEFT JOIN categories c ON c.id = p.category_id`;
export const PRODUCT_LIST_SQL = `${PRODUCT_SELECT} WHERE p.is_active = 1 ORDER BY p.name`;

export const TABLE_COLUMNS = "id, name, seats, area, active";
export const TABLE_LIST_SQL = `SELECT ${TABLE_COLUMNS} FROM restaurant_tables ORDER BY name`;
export const ACTIVE_TABLE_LIST_SQL = `SELECT ${TABLE_COLUMNS} FROM restaurant_tables WHERE active = 1 ORDER BY name`;

export const CATEGORY_COLUMNS = "id, name, kind, color, sort_order, is_default, created_at";
export const CATEGORY_LIST_SQL = `SELECT ${CATEGORY_COLUMNS} FROM categories ORDER BY sort_order`;

export const SHIFT_COLUMNS = `id, opened_at, closed_at, cashier_name, starting_cash, actual_cash, expected_cash,
  cash_difference, cash_sales_total, cash_in_total, cash_out_total, denominations, status, notes`;

export const MOVEMENT_COLUMNS = "id, shift_id, type, category, amount, description, cashier_name, occurred_at";

export function serializeProduct(p: ProductRow) {
  return {
    id: p.barcode,
    barcode: p.barcode,
    name: p.name,
    description: p.description,
    price: p.price,
    category: p.category,
    kind: p.kind,
    prepMinutes: p.prep_minutes,
    badge: p.badge,
    image: p.image,
    stock: p.stock,
  };
}

export function serializeTable(t: TableRow) {
  return { id: t.id, name: t.name, seats: t.seats, area: t.area, active: t.active === 1 };
}

export function serializeCategory(c: CategoryRow) {
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    color: c.color,
    sortOrder: c.sort_order,
    isDefault: c.is_default === 1,
    createdAt: c.created_at,
  };
}

function parseDenominations(raw: string | null): Record<string, unknown> | null {
  if (raw === null || raw === "") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function serializeShift(s: ShiftRow) {
  return {
    id: s.id,
    openedAt: s.opened_at,
    closedAt: s.closed_at,
    cashierName: s.cashier_name,
    startingCash: s.starting_cash,
    actualCash: s.actual_cash,
    expectedCash: s.expected_cash,
    cashDifference: s.cash_difference,
    cashSalesTotal: s.cash_sales_total,
    cashInTotal: s.cash_in_total,
    cashOutTotal: s.cash_out_total,
    denominations: parseDenominations(s.denominations),
    status: s.status,
    notes: s.notes,
  };
}

export function serializeCashMovement(m: CashMovementRow) {
  return {
    id: m.id,
    shiftId: m.shift_id,
    type: m.type,
    category: m.category,
    amount: m.amount,
    description: m.description,
    cashierName: m.cashier_name,
    createdAt: m.occurred_at,
  };
}
