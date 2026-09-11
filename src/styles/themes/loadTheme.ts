/**
 * Lazy theme loader.
 *
 * Only light/dark themes are bundled in index.css. The extra themes
 * (ocean, forest, sunset, lavender, rose, mint, peach, sky) are
 * loaded on demand via Vite CSS code splitting the first time they
 * are activated. A dynamic import() keeps the CSS out of the initial
 * payload: Vite injects a <style> in dev and emits an async chunk in
 * the production build.
 */

const EXTRA_THEMES = ["ocean", "forest", "sunset", "lavender", "rose", "mint", "peach", "sky"] as const;

type ExtraTheme = (typeof EXTRA_THEMES)[number];

const themeLoaders: Record<ExtraTheme, () => Promise<unknown>> = {
  ocean: () => import("./ocean.css"),
  forest: () => import("./forest.css"),
  sunset: () => import("./sunset.css"),
  lavender: () => import("./lavender.css"),
  rose: () => import("./rose.css"),
  mint: () => import("./mint.css"),
  peach: () => import("./peach.css"),
  sky: () => import("./sky.css"),
};

const loaded = new Set<ExtraTheme>();

/** Load an extra theme CSS. Idempotent and safe to call concurrently. */
export async function loadTheme(theme: ExtraTheme): Promise<void> {
  if (loaded.has(theme)) return;
  loaded.add(theme);

  try {
    await themeLoaders[theme]();
  } catch (error) {
    loaded.delete(theme);
    throw error;
  }
}

/** Preload a set of themes (called during idle time after startup). */
export async function preloadThemes(themes: readonly ExtraTheme[]): Promise<void> {
  await Promise.all(themes.map((theme) => loadTheme(theme)));
}

/** Check if a theme name is an extra (lazy-loaded) theme. */
export function isExtraTheme(theme: string): theme is ExtraTheme {
  return (EXTRA_THEMES as readonly string[]).includes(theme);
}
