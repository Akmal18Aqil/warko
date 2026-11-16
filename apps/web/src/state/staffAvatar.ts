/** Avatar colours staff can carry; every entry is a theme token class. */
const AVATAR_CLASSES = {
  accent: "bg-accent text-white",
  accentDark: "bg-accent-dark text-white",
  success: "bg-success-dark text-white",
  warning: "bg-warning-dark text-white",
  error: "bg-error-dark text-white",
  ink: "bg-ink-soft text-white",
} as const;

export const STAFF_AVATAR = AVATAR_CLASSES;

const KNOWN = new Set<string>(Object.values(AVATAR_CLASSES));

/** Palette names used by older saved staff lists and by the API's role defaults. */
const LEGACY_HUES: Array<[hue: string, avatar: string]> = [
  ["emerald", AVATAR_CLASSES.success],
  ["green", AVATAR_CLASSES.success],
  ["teal", AVATAR_CLASSES.ink],
  ["cyan", AVATAR_CLASSES.accentDark],
  ["amber", AVATAR_CLASSES.warning],
  ["yellow", AVATAR_CLASSES.warning],
  ["sky", AVATAR_CLASSES.accent],
  ["blue", AVATAR_CLASSES.accent],
  ["rose", AVATAR_CLASSES.error],
  ["red", AVATAR_CLASSES.error],
];

/** Maps a stored avatar class string onto a theme-token class (raw palette names are no longer generated). */
export function normalizeAvatarColor(stored: string): string {
  if (KNOWN.has(stored)) return stored;
  const hue = LEGACY_HUES.find(([name]) => stored.includes(`-${name}-`));
  return hue ? hue[1] : AVATAR_CLASSES.accent;
}
