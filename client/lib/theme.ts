export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/**
 * Resolve a user's ThemeMode preference ("light" | "dark" | "system")
 * into the concrete theme that should actually be painted.
 *
 * "system" defers to the OS-level dark-mode media query; light/dark
 * are returned as-is. Kept as a pure function (no DOM access) so the
 * Light/Dark/System toggle can be unit-tested without a browser.
 */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}

/**
 * Apply a resolved theme to the document root so the CSS in global.css
 * (which keys off :root[data-theme="dark"]) takes effect.
 */
export function applyResolvedTheme(root: HTMLElement, resolved: ResolvedTheme): void {
  root.dataset.theme = resolved;
}

const STORAGE_KEY = "isf-theme";

export function readStoredThemeMode(storage: Pick<Storage, "getItem">): ThemeMode | null {
  const saved = storage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return null;
}

export function writeStoredThemeMode(storage: Pick<Storage, "setItem">, mode: ThemeMode): void {
  storage.setItem(STORAGE_KEY, mode);
}
