/**
 * i18n entry point.
 *
 * The app-level i18n instance is created once in main.ts via
 * createI18nInstance() from ./loader. This module re-exports the loader's
 * helpers and the release-notes data for backward compatibility.
 */
import releaseNotesZhCN from "./locales/release-notes.zh-CN.json";
import releaseNotesEnUS from "./locales/release-notes.en-US.json";
import releaseNotesZhTW from "./locales/release-notes.zh-TW.json";

export {
  createI18nInstance,
  switchLanguage,
  getCurrentLanguage,
  getReleaseNotesData,
  SUPPORTED_LOCALES,
} from "./loader";

interface ReleaseNotesData {
  version: string;
  [key: string]: unknown;
}

// Export release notes data for other modules to use
export const releaseNotesData: Record<string, ReleaseNotesData> = {
  "zh-CN": releaseNotesZhCN as ReleaseNotesData,
  "zh-TW": releaseNotesZhTW as ReleaseNotesData,
  "en-US": releaseNotesEnUS as ReleaseNotesData,
};
