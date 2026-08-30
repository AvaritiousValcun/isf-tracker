import { describe, it, expect, vi } from "vitest";
import { resolveTheme, applyResolvedTheme, readStoredThemeMode, writeStoredThemeMode } from "./theme";

describe("resolveTheme", () => {
  it("resolves explicit light mode to light regardless of OS preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
  });

  it("resolves explicit dark mode to dark regardless of OS preference", () => {
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("resolves system mode to dark when the OS prefers dark", () => {
    expect(resolveTheme("system", true)).toBe("dark");
  });

  it("resolves system mode to light when the OS prefers light", () => {
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("applyResolvedTheme", () => {
  it("writes the resolved theme onto the root element's data-theme dataset", () => {
    const root = { dataset: {} as DOMStringMap };
    applyResolvedTheme(root as unknown as HTMLElement, "dark");
    expect(root.dataset.theme).toBe("dark");

    applyResolvedTheme(root as unknown as HTMLElement, "light");
    expect(root.dataset.theme).toBe("light");
  });
});

describe("stored theme mode", () => {
  it("round-trips a written theme mode through storage", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };

    writeStoredThemeMode(storage, "dark");
    expect(readStoredThemeMode(storage)).toBe("dark");

    writeStoredThemeMode(storage, "system");
    expect(readStoredThemeMode(storage)).toBe("system");
  });

  it("returns null for missing or invalid stored values", () => {
    expect(readStoredThemeMode({ getItem: () => null })).toBeNull();
    expect(readStoredThemeMode({ getItem: () => "not-a-real-theme" })).toBeNull();
  });
});

describe("full toggle simulation (light -> dark -> system, with OS changes)", () => {
  it("matches what the running app would paint at each step", () => {
    const root = { dataset: {} as DOMStringMap };
    let prefersDark = false; // OS is in light mode

    const apply = (mode: "light" | "dark" | "system") => applyResolvedTheme(root as unknown as HTMLElement, resolveTheme(mode, prefersDark));

    apply("light");
    expect(root.dataset.theme).toBe("light");

    apply("dark");
    expect(root.dataset.theme).toBe("dark");

    apply("system");
    expect(root.dataset.theme).toBe("light"); // OS still light

    // Simulate the OS switching to dark mode while in "system" mode,
    // exactly like the app's matchMedia "change" listener would trigger.
    prefersDark = true;
    apply("system");
    expect(root.dataset.theme).toBe("dark");

    // Switching back to an explicit mode should stop following the OS.
    apply("light");
    expect(root.dataset.theme).toBe("light");
    prefersDark = false; // even if OS flips again
    apply("light");
    expect(root.dataset.theme).toBe("light");
  });
});
