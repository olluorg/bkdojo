/**
 * Color theme selection.
 *
 * A device-specific UI preference, so it lives in localStorage only — never in
 * synced UserProgress (same rationale as llmProvider.ts). The choice is applied
 * by setting `data-theme` on <html>; styles.css keys the light palette off
 * `[data-theme="light"]` and treats dark as the default.
 *
 * `system` follows the OS `prefers-color-scheme` and re-applies live when it
 * flips; `dark` / `light` pin the palette regardless of the OS. The product is
 * light-first, so an unset preference defaults to the light palette (mirrored by
 * the no-FOUC bootstrap script in index.html).
 */
export type Theme = 'system' | 'dark' | 'light';

export const THEMES: readonly Theme[] = ['system', 'dark', 'light'];

export const THEME_LABELS: Record<Theme, string> = {
  system: 'Системная',
  dark: 'Тёмная',
  light: 'Светлая',
};

const STORAGE_KEY = 'bkdojo.theme';
const DEFAULT_THEME: Theme = 'light';

export function getTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' || value === 'system' ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore storage failures (private mode, quota) */
  }
  applyTheme(theme);
}

function prefersLight(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  } catch {
    return false;
  }
}

/** Resolve `system` to the OS preference and write `data-theme` on <html>. */
export function applyTheme(theme: Theme = getTheme()): void {
  const resolved = theme === 'system' ? (prefersLight() ? 'light' : 'dark') : theme;
  document.documentElement.dataset.theme = resolved;
}

/**
 * Wire up live OS-preference tracking. Re-applies the palette when the OS theme
 * flips, but only while the user's choice is `system`. Call once at startup.
 */
export function watchSystemTheme(): void {
  try {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', () => {
      if (getTheme() === 'system') applyTheme('system');
    });
  } catch {
    /* matchMedia unavailable — static theme only */
  }
}
