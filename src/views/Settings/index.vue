<template>
  <div class="settings-container">
    <AppearanceSection @language-change="handleLanguageChange" />

    <AdvancedSection />

    <SystemUpdateSection />

    <DeveloperSection v-if="appStore.developerModeEnabled" />

    <!-- Version info -->
    <div class="version-info">
      <transition name="text-swift" mode="out-in">
        <div :key="appStore.language" class="version-text">
          {{ t("settings.versionInfo", { version: appVersion }) }}
        </div>
      </transition>
      <transition name="text-swift" mode="out-in">
        <div :key="appStore.language" class="version-detail">
          {{ t("settings.developedBy") }}
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import storage from "@/services/storageService";
import { notify } from "@/services/notificationService";
import { useAppStore } from "@/stores/appStore";
import { getAppContext } from "@/appContext";
import { APP_VERSION } from "@/config/version";
import AppearanceSection from "./sections/AppearanceSection.vue";
import AdvancedSection from "./sections/AdvancedSection.vue";
import SystemUpdateSection from "./sections/SystemUpdateSection.vue";
import DeveloperSection from "./sections/DeveloperSection.vue";

defineOptions({ name: "Settings" });

const { t } = useI18n({ useScope: "global" });
const appStore = useAppStore();

const appVersion = APP_VERSION;

/**
 * Set language with concurrency guard and rollback.
 * Uses a monotonic sequence counter: if a newer call has already started,
 * this call's window title update is skipped to avoid race conditions.
 */
async function setLanguage(lang) {
  const { i18n } = getAppContext();
  const previousLanguage = appStore.language;
  const previousLocale = i18n ? i18n.locale : null;

  // Monotonic sequence counter for concurrency guard
  if (!languageSwitchSeq) languageSwitchSeq = 0;
  const currentSeq = ++languageSwitchSeq;

  let rollbackNeeded = true;
  try {
    if (i18n) {
      i18n.locale = lang;
    }
    storage.setItem("language", lang);
    appStore.setLanguage(lang);

    await updateWindowTitle();

    // Discard stale window title result — a newer switch may have overwritten it
    if (languageSwitchSeq !== currentSeq) {
      // Re-apply current language title since a newer call's title may have been overwritten
      await invoke("set_window_title", { title: t("app.name") });
    }
    rollbackNeeded = false;
  } catch (error) {
    console.error(t("settings.languageSwitchFailed"), error);
  } finally {
    if (rollbackNeeded) {
      if (i18n && previousLocale) {
        i18n.locale = previousLocale;
      }
      storage.setItem("language", previousLanguage);
      appStore.setLanguage(previousLanguage);
      notify.error(t("settings.languageSwitchFailed"));
    }
  }
}

let languageSwitchSeq = 0;

async function updateWindowTitle() {
  try {
    // Get app name from current language file
    const appName = t("app.name");

    // Call backend to set window title
    await invoke("set_window_title", { title: appName });
  } catch (error) {
    console.error("Failed to update window title:", error);
    // Don't throw error; language switch should not fail due to title update failure
  }
}

async function handleLanguageChange(option) {
  await setLanguage(option.value);
}

async function initializeLanguage() {
  try {
    const { i18n } = getAppContext();
    const savedLanguage = storage.getItem("language") || "zh-CN";
    // Use global i18n instance to set language
    if (i18n) {
      i18n.locale = savedLanguage;
    }
  } catch (error) {
    console.error(t("settings.languageInitFailed"), error);
  }
}

onMounted(async () => {
  await initializeLanguage();
});
</script>

<style scoped>
.settings-container {
  height: 100%;
  padding: var(--space-8) var(--space-6);
  background-color: var(--bg-primary);
  overflow-y: auto;
  transition: background-color 0.25s ease;
}

.version-info {
  text-align: center;
  padding: var(--space-10) var(--space-5);
  color: var(--text-tertiary);
  transition: color 0.25s ease;
}

.version-text {
  font-size: 15px;
  margin-bottom: var(--space-2);
  transition: color 0.25s ease;
}

.version-detail {
  font-size: 13px;
  opacity: 0.8;
  transition:
    opacity 0.25s ease,
    color 0.25s ease;
}
</style>

<!-- Shared settings layout styles. Unscoped (namespaced under
     .settings-container) because the markup lives inside section components
     and teleported/scoped rules cannot reach it. -->
<style>
.settings-container .setting-group {
  background-color: var(--bg-secondary);
  border-radius: var(--radius-card);
  margin-bottom: var(--space-6);
  overflow: hidden;
  /* Unified shadow effect */
  filter: drop-shadow(var(--filter-shadow-sm));
  /* Add frosted glass effect */
  backdrop-filter: blur(20px);
  transition:
    background-color 0.25s ease,
    filter 0.25s ease;
}

.settings-container .section-header {
  padding: var(--space-4) var(--space-5) var(--space-3);
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 0.5px solid var(--divider-color);
  transition:
    color 0.25s ease,
    border-bottom-color 0.25s ease;
  /* Add subtle background color */
  background-color: rgba(0, 0, 0, 0.02);
}

.settings-container .setting-item {
  display: flex;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  position: relative;
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;
}

.settings-container .setting-item.theme-setting-item {
  flex-direction: column;
  align-items: flex-start;
  overflow: visible;
  /* Ensure scroll buttons are not clipped */
}

.settings-container .setting-item.theme-setting-item .setting-icon {
  position: absolute;
  top: var(--space-4);
  left: var(--space-5);
}

.settings-container .setting-item.theme-setting-item .setting-details {
  padding-left: 52px;
  overflow: visible;
  /* Ensure scroll buttons are not clipped */
}

.settings-container .setting-details.full-width {
  width: 100%;
  overflow: visible;
  /* Ensure scroll buttons are not clipped */
}

.settings-container .theme-selector-wrapper {
  margin-top: var(--space-3);
  padding-left: 0;
  margin-left: -52px;
  width: calc(100% + 52px);
  overflow: visible;
  /* Ensure scroll buttons are not clipped */
}

.settings-container .setting-item:hover {
  background-color: var(--bg-tertiary);
  /* Add subtle scale effect */
  transform: translateY(-0.5px);
}

.settings-container .setting-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: var(--space-3);
  color: var(--accent-color);
  /* Add rounded background */
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--accent-color) 10%, transparent);
}

/* Toggle switch styles */
.settings-container .switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.settings-container .switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.settings-container .slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: var(--radius-xl);
}

.settings-container .slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 0.3s;
  border-radius: var(--radius-circle);
}

.settings-container input:checked + .slider {
  background-color: var(--accent-color);
}

.settings-container input:checked + .slider:before {
  transform: translateX(26px);
}

.settings-container .setting-action {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.settings-container .setting-action .custom-dropdown {
  min-width: 140px;
  width: 140px;
}

.settings-container .setting-action .dropdown-display {
  padding: var(--space-2) var(--space-3);
  font-size: 14px;
  border-radius: var(--radius-dropdown);
  background: var(--dropdown-bg);
  border: 1px solid var(--dropdown-border);
  color: var(--dropdown-text);
  transition: all 0.2s ease;
  width: 100%;
}

.settings-container .setting-action .dropdown-display:hover {
  background: var(--dropdown-hover-bg);
}

.settings-container .setting-action .dropdown-icon {
  font-size: 10px;
  margin-left: var(--space-1-5);
}

.settings-container .setting-action .dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  width: 100%;
  background: var(--dropdown-bg);
  border: 1px solid var(--dropdown-border);
  border-radius: var(--radius-md);
  filter: drop-shadow(var(--filter-shadow-md));
  overflow: hidden;
  z-index: 1001;
  backdrop-filter: blur(20px);
  cursor: default;
  min-width: 140px;
}

.settings-container .setting-action .dropdown-option {
  padding: var(--space-2) var(--space-3);
  font-size: 14px;
  color: var(--dropdown-text);
  transition: all 0.2s ease;
  cursor: pointer;
  user-select: none;
}

.settings-container .setting-action .dropdown-option:hover {
  background: var(--dropdown-hover-bg);
}

.settings-container .setting-action .dropdown-option.selected {
  background: var(--dropdown-selected-bg);
  color: var(--dropdown-selected-text);
}

/* Text switch animation - clean fade in/out */
.text-swift-enter-active {
  transition: opacity 0.2s ease-out;
}

.text-swift-leave-active {
  transition: opacity 0.15s ease-out;
}

.text-swift-enter-from {
  opacity: 0;
}

.text-swift-enter-to {
  opacity: 1;
}

.text-swift-leave-from {
  opacity: 1;
}

.text-swift-leave-to {
  opacity: 0;
}

/* Responsive design */
@media (max-width: 768px) {
  .settings-container {
    padding: var(--space-4) var(--space-4);
  }

  .settings-container .setting-item {
    padding: var(--space-3) var(--space-4);
  }

  .settings-container .setting-title {
    font-size: 16px;
  }

  .settings-container .setting-description {
    font-size: 14px;
  }

  .settings-container .setting-action .custom-dropdown {
    width: 120px;
  }
}

@media (max-width: 480px) {
  .settings-container {
    padding: var(--space-3) var(--space-3);
  }

  .settings-container .setting-item {
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
  }

  .settings-container .setting-icon {
    margin-bottom: var(--space-2);
  }

  .settings-container .setting-action {
    margin-left: 0;
    margin-top: var(--space-3);
    align-self: stretch;
    width: 100%;
  }

  .settings-container .setting-action .custom-dropdown {
    width: 100%;
  }
}

/* Dark theme adaptation */
[data-theme="dark"] .settings-container .setting-group {
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3));
}

[data-theme="dark"] .settings-container .section-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}
</style>
