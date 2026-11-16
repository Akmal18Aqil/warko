/**
 * Category identity colours. The `id` is persisted on the category row, so it must never change;
 * `bg`/`border` are the theme tag tokens that render it.
 */
export const CATEGORY_COLORS = [
  { id: "accent", bg: "bg-accent", border: "border-accent-dark" },
  { id: "amber", bg: "bg-tag-amber", border: "border-tag-amber-dark" },
  { id: "rose", bg: "bg-tag-rose", border: "border-tag-rose-dark" },
  { id: "blue", bg: "bg-tag-blue", border: "border-tag-blue-dark" },
  { id: "emerald", bg: "bg-tag-emerald", border: "border-tag-emerald-dark" },
  { id: "purple", bg: "bg-tag-purple", border: "border-tag-purple-dark" },
  { id: "teal", bg: "bg-tag-teal", border: "border-tag-teal-dark" },
] as const;

type CategoryColorId = (typeof CATEGORY_COLORS)[number]["id"];

export const DEFAULT_CATEGORY_COLOR: CategoryColorId = "accent";

/** Resolves a persisted colour id; unknown or missing ids fall back to the default colour. */
export function categoryColor(id: string | undefined) {
  return CATEGORY_COLORS.find((color) => color.id === id) ?? CATEGORY_COLORS[0];
}
