import type { StaffRole } from "./domain";

/**
 * Which roles may do what. The API enforces these on every route; the browser-only demo backend
 * enforces the same lists, and the UI uses them to hide actions a role cannot perform.
 */

/** Every signed-in role may read menu, orders, tables, categories and pricing. */
export const READ_ROLES: readonly StaffRole[] = ["admin", "kasir", "pelayan", "dapur", "manajer"];
/** Menu, table, category and pricing management. */
export const CATALOG_WRITE_ROLES: readonly StaffRole[] = ["admin", "kasir"];
/** Cash-drawer data (shifts, cash movements) is financial; hidden from floor and kitchen staff. */
export const FINANCE_ROLES: readonly StaffRole[] = ["admin", "kasir", "manajer"];
/** Roles allowed to create orders (POS, waiter app). */
export const CREATE_ORDER_ROLES: readonly StaffRole[] = ["admin", "kasir", "pelayan"];
/** Roles allowed to record a payment when creating an order (cashier, waiter collecting at the table). */
export const CREATE_PAID_ROLES: readonly StaffRole[] = ["admin", "kasir", "pelayan"];
/** Roles allowed to give a discount. */
export const DISCOUNT_ROLES: readonly StaffRole[] = ["admin", "kasir"];
/** Roles allowed to move an order through its kitchen lifecycle. */
export const UPDATE_STATUS_ROLES: readonly StaffRole[] = ["admin", "kasir", "pelayan", "dapur"];
/** Roles allowed to settle an existing unpaid order at the cash register. */
export const SETTLE_ROLES: readonly StaffRole[] = ["admin", "kasir"];
/** Owner dashboard, reports and exports. */
export const REPORT_ROLES: readonly StaffRole[] = ["admin", "kasir", "manajer"];
/** Ready-stock adjustments (owner / manager and cashier). */
export const STOCK_ROLES: readonly StaffRole[] = ["admin", "kasir", "manajer"];
/** Staff accounts are managed by admins only. */
export const ADMIN_ROLES: readonly StaffRole[] = ["admin"];

/** 403 message when a role may not perform an action. */
export const ACCESS_DENIED_MESSAGE = "Peran Anda tidak diizinkan melakukan aksi ini.";
