/**
 * Domain vocabulary shared by the web app and the API Worker. Both sides import these so a status,
 * role or limit can never mean different things on either end of the wire.
 */

/** Upper bound for any rupiah amount accepted by the API. */
export const MAX_MONEY = 1_000_000_000;

export const STAFF_ROLES = ["admin", "kasir", "pelayan", "dapur", "manajer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PAYMENT_METHODS = ["kartu-qr", "tunai", "qris"] as const;
export type PayMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Kitchen lifecycle: draft -> queued -> preparing -> ready -> served. */
export const KITCHEN_STATUSES = ["draft", "queued", "preparing", "ready", "served"] as const;
export type KitchenStatus = (typeof KITCHEN_STATUSES)[number];

/** Legacy single status column, derived from the kitchen status. */
export type OrderStatus = "disimpan" | "memasak" | "siap" | "sudah-dibayar";
export type OrderType = "bawa-pulang" | "meja";
export type OrderSource = "pos" | "waiter" | "self-order";

export type CashMovementType = "CASH_IN" | "CASH_OUT";
export type CashMovementCategory = "modal_awal" | "operasional" | "bahan_baku" | "setoran" | "tips" | "lainnya";
