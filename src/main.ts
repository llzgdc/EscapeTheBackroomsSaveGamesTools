/**
 * Application entry point - optimized startup
 * Optimization strategies:
 * 1. Lazy-load non-critical modules
 * 2. Parallel initialization
 * 3. On-demand icon loading
 * 4. Minimize synchronous blocking
 */

// Polyfills - must be loaded first
import "./utils/polyfills";

// FontAwesome styles (prevent icon size issues if style injection fails in production)
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config as faConfig } from "@fortawesome/fontawesome-svg-core";
faConfig.autoAddCss = false;

import * as vueRuntime from "vue";
import type { I18n, Composer } from "vue-i18n";
import App from "./App.vue";

import { setAppContext } from "./appContext";
import storage, { initStorage } from "./services/storageService";
import { initGlobalFloatingButtonProtection } from "./utils/floatingButtonProtection";
import { useAppStore } from "./stores/appStore";
const { createApp } = vueRuntime;

// Create app instance immediately (no async wait)
const app = createApp(App);

// Critical path: only load modules required for startup
import router from "./router";
import { createPinia } from "pinia";
import "./styles/animations.css";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";

// Lazy-loaded module references
let i18nInstance: I18n | null = null;

// Load critical icons (required for startup)
const loadCriticalIcons = async () => {
  const { FontAwesomeIcon: FAIcon } = await import("@fortawesome/vue-fontawesome");
  const { registerCriticalIcons } = await import("./utils/icons-critical");

  registerCriticalIcons();

  return FAIcon;
};

// Lazy load full icon set
const loadAllIcons = async (): Promise<void> => {
  const { registerIcons } = await import("./utils/icons-full");
  registerIcons();
};

// Initialize i18n — delegates to the loader singleton
const initI18n = async (): Promise<I18n> => {
  const { createI18nInstance } = await import("./i18n/loader");
  i18nInstance = await createI18nInstance();
  return i18nInstance;
};

// Lazy-load other languages
const loadOtherLocales = async (): Promise<void> => {
  if (!i18nInstance) return;

  const global = i18nInstance.global as Composer;
  const currentLocale = global.locale.value;
  const locales = ["zh-CN", "en-US", "zh-TW"].filter((l) => l !== currentLocale);

  for (const locale of locales) {
    const msgs = global.messages.value as Record<string, unknown>;
    if (!msgs[locale]) {
      const messages = (await import(`./i18n/locales/${locale}/index`)).default;
      global.setLocaleMessage(locale, messages as Record<string, unknown>);
    }
  }
};

// Main initialization flow
async function initApp(): Promise<typeof app> {
  const startTime = performance.now();

  // Phase 1: Initialize critical modules in parallel
  console.info("[Startup] Initializing critical modules...");
  const [, FAIcon, i18n] = await Promise.all([initStorage(), loadCriticalIcons(), initI18n()]);

  console.info(`[Startup] Critical modules loaded: ${(performance.now() - startTime).toFixed(0)}ms`);

  // Phase 2: Configure Vue app
  console.info("[Startup] Configuring Vue app...");
  app.use(createPinia());
  app.use(router);
  app.use(i18n);
  app.component("FontAwesomeIcon", FAIcon);

  setAppContext({ i18n: i18n.global as Composer, router, vue: vueRuntime, storage });

  // Phase 3: Mount app (user-visible)
  console.info("[Startup] Mounting app...");
  app.mount("#app");
  console.info(`[Startup] App mounted: ${(performance.now() - startTime).toFixed(0)}ms`);

  // Phase 4: Show window after render completes
  // Disable transition animations to prevent theme flash on startup
  document.documentElement.classList.add("no-transition");

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 50);
      });
    });
  });

  console.info("[Startup] Preparing to show window...");
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const appWindow = getCurrentWindow();
    await appWindow.show();
    console.info(`[Startup] Window shown: ${(performance.now() - startTime).toFixed(0)}ms`);
  } catch (error) {
    console.warn("[Startup] Failed to show window:", error instanceof Error ? error.message : error);
  }

  // Restore transition animations after window is shown
  requestAnimationFrame(() => {
    document.documentElement.classList.remove("no-transition");
  });

  // Phase 5: Background-load non-critical modules (non-blocking)
  requestIdleCallback(
    () => {
      Promise.all([loadAllIcons(), loadOtherLocales(), initWindowTitle(i18n)])
        .then(() => {
          console.info(`[Startup] Full initialization: ${(performance.now() - startTime).toFixed(0)}ms`);
        })
        .catch((err) => {
          console.warn("[Startup] Background init failed:", err instanceof Error ? err.message : err);
        });
    },
    { timeout: 2000 },
  );

  return app;
}

// Window title setup (delayed)
async function initWindowTitle(i18nInstance: I18n): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const appWindow = getCurrentWindow();
    const composer = i18nInstance.global as Composer;
    const title = composer.t("app.name");
    await appWindow.setTitle(title);

    // Watch store for language changes (replaces window event listener)
    const { watch } = await import("vue");
    const appStore = useAppStore();
    watch(
      () => appStore.language,
      async () => {
        const newTitle = composer.t("app.name");
        await appWindow.setTitle(newTitle);
      },
    );
  } catch (error) {
    console.warn("[Window] Failed to set title:", error);
  }
}

// Start the app
initApp().catch((error: unknown) => {
  const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
  console.error("[Startup] App failed to start:", errorMsg);
});

// Floating button protection (delayed initialization)
requestIdleCallback(
  () => {
    initGlobalFloatingButtonProtection();
  },
  { timeout: 3000 },
);

// Disable interactions in production mode (prevent shortcuts, text selection, etc.)
if (import.meta.env.PROD) {
  import("./utils/disableInteractions")
    .then(({ disableInteractions }) => {
      disableInteractions();
    })
    .catch((err) => {
      console.warn("[Startup] Failed to load disableInteractions:", err instanceof Error ? err.message : err);
    });
}
