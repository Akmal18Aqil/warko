import type { CashMovementCategory, CashMovementType } from "@wakro/shared";

/** Prefilled float in the open-shift form; the cashier can change it. */
export const DEFAULT_STARTING_CASH = 200_000;

/** One-tap nominal shortcuts in the cash movement form. */
export const QUICK_AMOUNTS = [10_000, 20_000, 50_000, 100_000, 200_000] as const;

/** Banknotes and coins the drawer count offers, largest first. `tone` is a theme-token class set. */
export type Denomination = { value: number; tone: string; coin?: boolean };

export const DENOMINATIONS: readonly Denomination[] = [
  { value: 100_000, tone: "border-error/30 bg-error/10 text-error-dark" },
  { value: 50_000, tone: "border-accent/30 bg-accent/10 text-accent-dark" },
  { value: 20_000, tone: "border-success/30 bg-success/15 text-success-dark" },
  { value: 10_000, tone: "border-tag-purple/40 bg-tag-purple/15 text-ink" },
  { value: 5_000, tone: "border-warning/40 bg-warning/15 text-warning-dark" },
  { value: 2_000, tone: "border-border bg-mineral text-ink-soft" },
  { value: 1_000, tone: "border-tag-teal/40 bg-tag-teal/15 text-ink" },
  { value: 500, tone: "border-border bg-mineral text-ink-soft", coin: true },
];

/** Denomination value (rupiah) to number of notes or coins. */
export type DenominationCounts = Record<number, number>;

export const CATEGORIES_BY_TYPE: Record<CashMovementType, readonly CashMovementCategory[]> = {
  CASH_IN: ["setoran", "modal_awal", "tips", "lainnya"],
  CASH_OUT: ["operasional", "bahan_baku", "tips", "lainnya"],
};

export const DEFAULT_CATEGORY: Record<CashMovementType, CashMovementCategory> = {
  CASH_IN: "setoran",
  CASH_OUT: "operasional",
};

export const MOVEMENT_TYPES = ["CASH_IN", "CASH_OUT"] as const satisfies readonly CashMovementType[];

export type MovementFilter = "ALL" | CashMovementType;
export const MOVEMENT_FILTERS = ["ALL", ...MOVEMENT_TYPES] as const satisfies readonly MovementFilter[];
