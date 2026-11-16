const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

export const formatTime = (ms: number) => new Date(ms).toLocaleTimeString("id-ID", TIME);

export const formatShortDate = (ms: number) => new Date(ms).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

export const formatLongDate = (ms: number) =>
  new Date(ms).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export const formatDateTime = (ms: number) =>
  new Date(ms).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

/** Digits typed into a rupiah field, as a whole number (0 when empty). */
export function parseAmount(input: string): number {
  return Number.parseInt(input.replace(/\D/g, ""), 10) || 0;
}

/** Thousands-separated text for a rupiah field; empty input stays empty. */
export function formatAmountInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits === "" ? "" : Number.parseInt(digits, 10).toLocaleString("id-ID");
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** `+Rp 5.000` / `-Rp 5.000` for signed differences; zero has no sign. */
export function signed(amount: number, format: (value: number) => string): string {
  if (amount === 0) return format(0);
  return `${amount > 0 ? "+" : "-"}${format(Math.abs(amount))}`;
}
