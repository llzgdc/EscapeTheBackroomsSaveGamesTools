<template>
  <!-- Advanced settings group -->
  <div class="setting-group">
    <transition name="text-swift" mode="out-in">
      <div :key="appStore.language" class="section-header">
        {{ t("settings.advancedSettings") }}
      </div>
    </transition>

    <!-- Disable GPU acceleration toggle -->
    <div class="setting-item">
      <div class="setting-icon">
        <font-awesome-icon :icon="['fas', 'microchip']" />
      </div>
      <div class="setting-details">
        <transition name="text-swift" mode="out-in">
          <div :key="appStore.language" class="setting-title">
            {{ t("settings.disableGpuAcceleration") }}
          </div>
        </transition>
        <transition name="text-swift" mode="out-in">
          <div :key="appStore.language" class="setting-description">
            {{ t("settings.disableGpuAccelerationDescription") }}
          </div>
        </transition>
      </div>
      <div class="setting-action">
        <label class="switch">
          <input v-model="gpuAccelerationDisabled" type="checkbox" @change="handleGpuAccelerationToggle" />
          <span class="slider"></span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import storage from "@/services/storageService";
import { notify } from "@/services/notificationService";
import { useAppStore } from "@/stores/appStore";

const { t } = useI18n({ useScope: "global" });
const appStore = useAppStore();

const gpuAccelerationDisabled = ref(
  storage.getItem("gpuAccelerationDisabled", false) === true || storage.getItem("gpuAccelerationDisabled") === "true",
);

async function handleGpuAccelerationToggle() {
  try {
    // Call Tauri command to set GPU acceleration state
    await invoke("set_gpu_acceleration", {
      disabled: gpuAccelerationDisabled.value,
    });

    // Save state to storage (use boolean for type consistency)
    storage.setItem("gpuAccelerationDisabled", gpuAccelerationDisabled.value);

    // Show prompt informing user to restart the application manually
    const message = gpuAccelerationDisabled.value
      ? t("settings.gpuAccelerationDisabled")
      : t("settings.gpuAccelerationEnabled");

    notify.info(message, { duration: 5000 });
  } catch (error) {
    console.error(t("settings.gpuAccelerationChangeFailed"), error);
    // Restore toggle state
    gpuAccelerationDisabled.value = !gpuAccelerationDisabled.value;
    storage.setItem("gpuAccelerationDisabled", gpuAccelerationDisabled.value);

    // Show error prompt
    notify.error(t("settings.gpuAccelerationChangeFailed") + ": " + error);
  }
}

// Initialize GPU acceleration state
async function initializeGpuAccelerationStatus() {
  try {
    // Get state from localStorage
    const localStorageState = storage.getItem("gpuAccelerationDisabled") === "true";

    // Try to get state from Tauri backend
    try {
      const backendState = await invoke("get_gpu_acceleration_status");
      // If backend state differs from localStorage, use backend state
      if (backendState !== localStorageState) {
        gpuAccelerationDisabled.value = backendState;
        storage.setItem("gpuAccelerationDisabled", backendState);
      }
    } catch (error) {
      console.warn(t("settings.gpuStatusFetchFailed"), error);
      // Use localStorage state
      gpuAccelerationDisabled.value = localStorageState;
    }
  } catch (error) {
    console.error(t("settings.gpuStatusInitFailed"), error);
    // Enable GPU acceleration by default
    gpuAccelerationDisabled.value = false;
  }
}

onMounted(() => {
  initializeGpuAccelerationStatus();
});
</script>
