/** Guest counts offered as one-tap choices when taking an order. */
export const GUEST_OPTIONS = [1, 2, 4, 6, 8] as const;

export const DEFAULT_GUESTS = 2;

/** How often the "x minutes ago" labels on the active-order cards refresh. */
export const ELAPSED_TICK_MS = 10_000;

export const MS_PER_MINUTE = 60_000;

export type WaiterPayMethod = "tunai" | "qris";
