<template>
  <!-- Appearance and language settings group -->
  <div ref="rootEl" class="setting-group">
    <transition name="text-swift" mode="out-in">
      <div :key="appStore.language" class="section-header">
        {{ t("settings.appearanceAndLanguage") }}
      </div>
    </transition>

    <!-- Theme settings -->
    <div class="setting-item theme-setting-item">
      <div class="setting-icon">
        <font-awesome-icon :icon="['fas', 'palette']" />
      </div>
      <div class="setting-details full-width">
        <transition name="text-swift" mode="out-in">
          <div :key="appStore.language" class="setting-title">
            {{ t("settings.theme") }}
          </div>
        </transition>
        <transition name="text-swift" mode="out-in">
          <div :key="appStore.language" class="setting-description">
            {{ t("settings.themeDescription") }}
          </div>
        </transition>
        <!-- Theme selector -->
        <div class="theme-selector-wrapper">
          <ThemeSelector v-model="currentTheme" @change="handleThemeChange" />
        </div>
      </div>
    </div>

    <!-- Language settings -->
    <div class="setting-item">
      <div class="setting-icon">
        <font-awesome-icon :icon="['fas', 'globe']" />
      </div>
      <div class="setting-details">
        <transition name="text-swift" mode="out-in">
          <div :key="appStore.language" class="setting-title">
            {{ t("settings.language") }}
          </div>
        </transition>
        <transition name="text-swift" mode="out-in">
          <div :key="appStore.language" class="setting-description">
            {{ t("settings.languageDescription") }}
          </div>
        </transition>
      </div>
      <div class="setting-action">
        <CustomDropdown
          :model-value="appStore.language"
          :options="languageOptions"
          :is-open="languageDropdownOpen"
          :placeholder="t('common.select')"
          @change="onLanguageChange"
          @dropdown-open="languageDropdownOpen = !languageDropdownOpen"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import CustomDropdown from "@/components/ui/CustomDropdown.vue";
import ThemeSelector from "@/components/theme/ThemeSelector.vue";
import storage from "@/services/storageService";
import { notify } from "@/services/notificationService";
import { useAppStore } from "@/stores/appStore";
import { themeManager } from "@/styles/theme-config";

const emit = defineEmits(["language-change"]);

const { t } = useI18n({ useScope: "global" });
const appStore = useAppStore();

const currentTheme = ref(storage.getItem("theme", "light"));
const languageDropdownOpen = ref(false);

const languageOptions = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "en-US", label: "English" },
];

async function handleThemeChange(option) {
  const newTheme = option.value;
  // v-model already moved currentTheme to the new value by the time this
  // runs, so take the rollback target from the applied theme instead.
  const previousTheme = themeManager.currentThemeId.value || currentTheme.value;

  try {
    // ThemeManager handles: lazy CSS loading, data-theme attribute, storage, transitions
    const applied = await themeManager.setTheme(newTheme);
    if (!applied) {
      throw new Error(`Unknown theme: ${newTheme}`);
    }
    // Only update state after successful application
    currentTheme.value = newTheme;
  } catch (error) {
    console.error("Failed to apply theme:", error);
    // Rollback to previous theme
    currentTheme.value = previousTheme;
    await themeManager.setTheme(previousTheme);
    notify.error("Theme change failed: " + (error.message || error));
  }
}

function onLanguageChange(option) {
  languageDropdownOpen.value = false;
  emit("language-change", option);
}

// Close the dropdown when clicking outside of it
function handleClickOutside(event) {
  const container = rootEl.value;
  if (!container) return;

  const dropdownContainers = container.querySelectorAll(".setting-action");
  let clickedInsideDropdown = false;

  dropdownContainers.forEach((dropdown) => {
    if (dropdown.contains(event.target)) {
      clickedInsideDropdown = true;
    }
  });

  if (!clickedInsideDropdown) {
    languageDropdownOpen.value = false;
  }
}

const rootEl = ref(null);

onMounted(async () => {
  // Ensure the persisted theme is applied and the selector highlight
  // reflects the actually active theme
  if (!themeManager.isInitialized.value) {
    await themeManager.init();
  }
  const appliedTheme = themeManager.currentThemeId.value;
  if (appliedTheme) {
    currentTheme.value = appliedTheme;
  }

  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>
