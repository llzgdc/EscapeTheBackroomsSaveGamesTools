/**
 * i18n loader - optimized
 * Supports on-demand language pack loading
 */
import { createI18n } from "vue-i18n";
import type { I18n, Composer } from "vue-i18n";
import storage from "@/services/storageService";

// Singleton instance
let i18nInstance: I18n | null = null;

/** Locales bundled with the app */
export const SUPPORTED_LOCALES = ["zh-CN", "zh-TW", "en-US"];

// Language pack cache — messages are dynamic imports, typed loosely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messagesCache: Record<string, any> = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const releaseNotesCache: Record<string, any> = {};

/**
 * Get user language preference
 */
const getUserLocale = (): string => {
  const saved = (storage.getItem("locale") as string) || (storage.getItem("language") as string);
  if (saved && ["zh-CN", "zh-TW", "en-US"].includes(saved)) {
    return saved;
  }

  const lang = navigator.language || "zh-CN";
  if (["zh-TW", "zh-HK", "zh-MO"].includes(lang)) return "zh-TW";
  if (lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("en")) return "en-US";
  return "zh-CN";
};

/**
 * Load language pack
 */
const loadLocaleMessages = async (locale: string): Promise<unknown> => {
  if (messagesCache[locale]) {
    return messagesCache[locale];
  }

  let messages: unknown;
  switch (locale) {
    case "zh-CN":
      messages = (await import("./locales/zh-CN/index")).default;
      break;
    case "zh-TW":
      messages = (await import("./locales/zh-TW/index")).default;
      break;
    case "en-US":
      messages = (await import("./locales/en-US/index")).default;
      break;
    default:
      messages = (await import("./locales/zh-CN/index")).default;
  }

  messagesCache[locale] = messages;
  return messages;
};

/**
 * Load release notes data (now a single object instead of an array)
 */
const loadReleaseNotes = async (locale: string): Promise<unknown> => {
  if (releaseNotesCache[locale]) {
    return releaseNotesCache[locale];
  }

  let notes: unknown;
  try {
    switch (locale) {
      case "zh-CN":
        notes = (await import("./locales/release-notes.zh-CN.json")).default;
        break;
      case "zh-TW":
        notes = (await import("./locales/release-notes.zh-TW.json")).default;
        break;
      case "en-US":
        notes = (await import("./locales/release-notes.en-US.json")).default;
        break;
      default:
        notes = (await import("./locales/release-notes.zh-CN.json")).default;
    }
    releaseNotesCache[locale] = notes;
  } catch {
    notes = null;
  }

  return notes;
};

/**
 * Create i18n instance
 */
export const createI18nInstance = async (): Promise<I18n> => {
  if (i18nInstance) return i18nInstance;

  const locale = getUserLocale();
  const messages = await loadLocaleMessages(locale);

  i18nInstance = createI18n({
    legacy: false,
    locale,
    fallbackLocale: "en-US",
    messages: { [locale]: messages },
    silentTranslationWarn: true,
    missingWarn: false,
    fallbackWarn: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // Lazily load other languages
  const loadRemaining = async (): Promise<void> => {
    const otherLocales = ["zh-CN", "zh-TW", "en-US"].filter((l) => l !== locale);
    for (const loc of otherLocales) {
      const msg = await loadLocaleMessages(loc);
      (i18nInstance!.global as Composer).setLocaleMessage(loc, msg as Record<string, unknown>);
    }
  };

  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(loadRemaining, { timeout: 5000 });
  } else {
    // Fallback for environments without requestIdleCallback (e.g. test runners)
    setTimeout(loadRemaining, 0);
  }

  return i18nInstance;
};

/**
 * Get current i18n instance
 */
export const getI18n = (): I18n | null => i18nInstance;

/**
 * Switch language
 * @returns Whether the switch was applied (false when the instance is not
 * ready yet or the locale is unsupported)
 */
export const switchLanguage = async (newLocale: string): Promise<boolean> => {
  if (!i18nInstance || !SUPPORTED_LOCALES.includes(newLocale)) {
    return false;
  }

  // Ensure language pack is loaded

  const msgValues = (i18nInstance.global as Composer).messages.value as Record<string, unknown>;
  if (!msgValues[newLocale]) {
    const messages = await loadLocaleMessages(newLocale);
    (i18nInstance.global as Composer).setLocaleMessage(newLocale, messages as Record<string, unknown>);
  }

  // In composition mode the composer's locale is a writable computed ref;
  // assigning `.value` is what actually triggers reactive translation updates.
  (i18nInstance.global as Composer).locale.value = newLocale;
  storage.setItem("locale", newLocale);
  storage.setItem("language", newLocale);

  // Dispatch language change event
  window.dispatchEvent(new CustomEvent("language-changed", { detail: { locale: newLocale } }));
  return true;
};

/**
 * Get current language
 */
export const getCurrentLanguage = (): string => {
  return (i18nInstance?.global as Composer)?.locale?.value || getUserLocale();
};

/**
 * Get release notes data
 */
export const getReleaseNotesData = async (locale?: string): Promise<unknown> => {
  const targetLocale = locale || getCurrentLanguage();
  return loadReleaseNotes(targetLocale);
};

/**
 * Preload i18n
 */
export const preloadI18n = (): Promise<I18n> => createI18nInstance();

export default {
  createI18nInstance,
  getI18n,
  switchLanguage,
  getCurrentLanguage,
  getReleaseNotesData,
  preloadI18n,
};
