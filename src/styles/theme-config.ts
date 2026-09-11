/**
 * ThemeManager - Core theme manager (simplified)
 *
 * Handles preset theme switching and persistence only.
 */

import { ref, readonly } from "vue";
import type { Ref, DeepReadonly } from "vue";
import { themeStorage } from "@/services/themeStorage";
import storage from "@/services/storageService";
import { loadTheme, isExtraTheme } from "./themes/loadTheme";

interface PresetTheme {
  id: string;
  name: string;
  type: string;
}

/**
 * Preset theme definitions
 */
export const PRESET_THEMES: Record<string, PresetTheme> = {
  light: { id: "light", name: "Light", type: "preset" },
  dark: { id: "dark", name: "Dark", type: "preset" },
  ocean: { id: "ocean", name: "Ocean", type: "preset" },
  forest: { id: "forest", name: "Forest", type: "preset" },
  sunset: { id: "sunset", name: "Sunset", type: "preset" },
  lavender: { id: "lavender", name: "Lavender", type: "preset" },
  rose: { id: "rose", name: "Rose", type: "preset" },
  mint: { id: "mint", name: "Mint", type: "preset" },
  peach: { id: "peach", name: "Peach", type: "preset" },
  sky: { id: "sky", name: "Sky", type: "preset" },
};

const DEFAULT_THEME_ID = "light";
const TRANSITION_DURATION = 250;

function prefersReducedMotion(): boolean {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

class ThemeManager {
  private _currentThemeId: Ref<string | null>;
  private _isInitialized: Ref<boolean>;
  private _transitionEnabled: boolean = false;
  private _transitionTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this._currentThemeId = ref<string | null>(null);
    this._isInitialized = ref(false);
  }

  get currentThemeId(): DeepReadonly<Ref<string | null>> {
    return readonly(this._currentThemeId);
  }

  get isInitialized(): DeepReadonly<Ref<boolean>> {
    return readonly(this._isInitialized);
  }

  async init(): Promise<void> {
    if (this._isInitialized.value) return;

    try {
      const domTheme = document.documentElement.getAttribute("data-theme");

      let activeThemeId: string | null = null;
      try {
        activeThemeId = await themeStorage.getActiveThemeId();
      } catch {
        activeThemeId = storage.getItem<string>("theme");
      }

      const themeToApply = activeThemeId || domTheme || DEFAULT_THEME_ID;
      this._transitionEnabled = false;
      await this.setTheme(themeToApply);
      this._transitionEnabled = true;
      this._setupTransitionStyles();
      this._isInitialized.value = true;
    } catch (error) {
      console.error("Failed to initialize ThemeManager:", error);
      this._currentThemeId.value = DEFAULT_THEME_ID;
      document.documentElement.setAttribute("data-theme", DEFAULT_THEME_ID);
      this._isInitialized.value = true;
    }
  }

  private _setupTransitionStyles(): void {
    if (document.getElementById("theme-transition-styles")) return;

    const style = document.createElement("style");
    style.id = "theme-transition-styles";
    style.textContent = `
      :root.theme-transitioning {
        transition: background-color ${TRANSITION_DURATION}ms ease, color ${TRANSITION_DURATION}ms ease !important;
      }
      :root.theme-transitioning body,
      :root.theme-transitioning .settings-container,
      :root.theme-transitioning .setting-group,
      :root.theme-transitioning .setting-item,
      :root.theme-transitioning .sidebar,
      :root.theme-transitioning .main-content {
        transition: background-color ${TRANSITION_DURATION}ms ease, color ${TRANSITION_DURATION}ms ease, border-color ${TRANSITION_DURATION}ms ease !important;
      }
      @media (prefers-reduced-motion: reduce) {
        :root.theme-transitioning,
        :root.theme-transitioning body,
        :root.theme-transitioning .settings-container,
        :root.theme-transitioning .setting-group,
        :root.theme-transitioning .setting-item,
        :root.theme-transitioning .sidebar,
        :root.theme-transitioning .main-content {
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  getCurrentTheme(): PresetTheme {
    const themeId = this._currentThemeId.value;
    return PRESET_THEMES[themeId as string] || PRESET_THEMES[DEFAULT_THEME_ID];
  }

  async setTheme(themeId: string): Promise<boolean> {
    if (!themeId) {
      console.warn("Invalid theme ID");
      return false;
    }

    if (!PRESET_THEMES[themeId]) {
      console.warn(`Theme not found: ${themeId}`);
      return false;
    }

    if (this._transitionEnabled && !prefersReducedMotion()) {
      document.documentElement.classList.add("theme-transitioning");
    }

    try {
      // Lazy-load extra theme CSS on first activation before flipping
      // data-theme, so the new selectors are available immediately.
      if (isExtraTheme(themeId)) {
        await loadTheme(themeId);
      }

      document.documentElement.setAttribute("data-theme", themeId);
      this._currentThemeId.value = themeId;

      // Persist to the Tauri config file when available, and always keep
      // the localStorage copy in sync — the inline script in index.html
      // reads it pre-paint to pick the startup background color.
      try {
        await themeStorage.setActiveThemeId(themeId);
      } catch {
        // Not running under Tauri (e.g. browser-only dev); localStorage still written below
      }
      storage.setItem("theme", themeId);

      if (this._transitionEnabled) {
        // Clear previous timeout so rapid theme switches don't prematurely
        // remove the transitioning class before the new transition completes.
        if (this._transitionTimeout) clearTimeout(this._transitionTimeout);
        this._transitionTimeout = setTimeout(() => {
          document.documentElement.classList.remove("theme-transitioning");
          this._transitionTimeout = null;
        }, TRANSITION_DURATION);
      }

      return true;
    } catch (error) {
      console.error("Failed to set theme:", error);
      document.documentElement.classList.remove("theme-transitioning");
      return false;
    }
  }

  async resetToDefault(): Promise<void> {
    await this.setTheme(DEFAULT_THEME_ID);
  }

  getAllThemes(): PresetTheme[] {
    return Object.values(PRESET_THEMES);
  }

  getSystemTheme(): string {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  themeExists(themeId: string): boolean {
    return !!PRESET_THEMES[themeId];
  }
}

// Create singleton instance
const themeManager = new ThemeManager();

export { themeManager, ThemeManager };
export default themeManager;

// Legacy API compatibility
export const themePresets: Record<string, PresetTheme> = PRESET_THEMES;
