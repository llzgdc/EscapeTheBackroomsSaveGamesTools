<template>
  <div
    id="titlebar"
    data-tauri-drag-region
    class="titlebar"
    style="padding-left: 12px"
    :class="{ 'sidebar-collapsed': sidebarCollapsed }"
  >
    <div class="titlebar-content" data-tauri-drag-region>
      <div class="title-section" data-tauri-drag-region>
        <transition name="text-swift" mode="out-in">
          <h1 :key="`app-name-${currentLanguage}-${appName}`" data-tauri-drag-region>
            {{ appName }}
          </h1>
        </transition>
      </div>
    </div>

    <div class="titlebar-controls">
      <div id="titlebar-minimize" class="titlebar-button" @click.stop="handleMinimize">
        <font-awesome-icon :icon="['fas', 'minus']" aria-hidden="true" />
      </div>
      <div id="titlebar-maximize" class="titlebar-button" @click.stop="handleMaximize">
        <font-awesome-icon :icon="['fas', 'window-maximize']" aria-hidden="true" />
      </div>
      <div id="titlebar-close" class="titlebar-button close" @click.stop="handleClose">
        <font-awesome-icon :icon="['fas', 'times']" aria-hidden="true" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { getAppContext } from "@/appContext.js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "@/stores/appStore";

const appName = ref("");
const currentLanguage = ref("zh-CN");

// 更新应用名称的函数
const updateAppName = () => {
  try {
    const { i18n } = getAppContext();
    if (i18n && i18n.t) {
      appName.value = i18n.t("app.name");
      const locale = i18n.locale;
      currentLanguage.value = typeof locale === "string" ? locale : (locale.value as string) || "zh-CN";
    }
  } catch (error) {
    console.warn("Failed to update app name:", error);
    appName.value = "ETB Save Manager";
    currentLanguage.value = "zh-CN";
  }
};

const appStore = useAppStore();
const appWindow = getCurrentWindow();
const sidebarCollapsed = ref(false);

const handleMinimize = () => {
  appWindow.minimize().catch((err) => {
    console.error("最小化失败:", err);
  });
};

const handleMaximize = () => {
  appWindow.toggleMaximize().catch((err) => {
    console.error("最大化失败:", err);
  });
};

const handleClose = () => {
  appWindow.close().catch((err) => {
    console.error("关闭失败:", err);
  });
};

const onSidebarStateChange = (e: Event) => {
  sidebarCollapsed.value = (e as CustomEvent).detail.collapsed;
};

const onTitlebarMouseDown = (e: MouseEvent) => {
  const isButtonClick = (e.target as HTMLElement)?.closest(".titlebar-button");
  if (isButtonClick) return;

  if (e.buttons === 1) {
    if (e.detail === 2) {
      appWindow.toggleMaximize().catch((err) => {
        console.error("双击最大化失败:", err);
      });
    } else {
      appWindow.startDragging().catch((err) => {
        console.error("拖拽失败:", err);
      });
    }
  }
};

onMounted(() => {
  updateAppName();

  window.addEventListener("sidebar-state-change", onSidebarStateChange);

  watch(
    () => appStore.language,
    () => {
      updateAppName();
    },
  );

  const titlebar = document.getElementById("titlebar");
  if (titlebar) {
    titlebar.addEventListener("mousedown", onTitlebarMouseDown);
  }
});

onUnmounted(() => {
  window.removeEventListener("sidebar-state-change", onSidebarStateChange);
  const titlebar = document.getElementById("titlebar");
  if (titlebar) {
    titlebar.removeEventListener("mousedown", onTitlebarMouseDown);
  }
});
</script>

<style scoped>
:deep(.fa),
:deep(.fas),
:deep(.far),
:deep(.fa-solid),
:deep(.fa-regular) {
  /* FontAwesome组件会自动处理字体设置 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 38px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 0 var(--space-3);
  background: var(--titlebar-bg);
  backdrop-filter: blur(10px);
  z-index: 999999999999999999;
  -webkit-app-region: drag;
  user-select: none;
  border-bottom: 1px solid var(--titlebar-border);
  transition:
    background 0.25s ease,
    border-bottom 0.25s ease,
    backdrop-filter 0.25s ease;
}

.title-section h1 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
  padding: 0;
  line-height: 1;
}

.titlebar-controls {
  display: flex;
  align-items: center;
  gap: 0;
  margin-left: auto;
  margin-right: 0;
}

.titlebar-button {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    all 0.2s ease,
    background-color 0.25s ease,
    color 0.25s ease;
  cursor: pointer;
  background: transparent;
  border: none;
  -webkit-app-region: no-drag !important;
  pointer-events: auto !important;
  user-select: none;
  position: relative;
  z-index: 1001;
}

.titlebar-button svg {
  font-size: 12px;
  color: var(--text);
  pointer-events: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: color 0.25s ease;
}

.titlebar-button#titlebar-minimize svg {
  font-size: 11px;
}

.titlebar-button#titlebar-close svg {
  font-size: 14px;
}

.titlebar-button:hover {
  background-color: var(--titlebar-button-hover);
  backdrop-filter: blur(5px);
}

.titlebar-button:active {
  background-color: var(--titlebar-button-hover);
}

.titlebar-button.close:hover {
  background-color: #ff5f57;
  color: white;
}

.titlebar-button.close:active {
  background-color: #e5484d;
}

.sidebar-toggle {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  transition:
    all 0.2s ease,
    background-color 0.25s ease,
    color 0.25s ease,
    transform 0.25s ease;
  -webkit-app-region: no-drag;
  font-size: 14px;
}

.sidebar-toggle:hover {
  background: var(--sidebar-hover-bg);
  transform: scale(1.1);
}

.sidebar-toggle.collapsed {
  transform: rotate(90deg);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .title-section h1 {
    font-size: 12px;
  }

  .titlebar-button {
    width: 28px;
    height: 28px;
  }
}
</style>

<!-- 全局 text-swift 过渡动画 — 供 TitleBar、CustomDropdown 等跨组件使用 -->
<style>
.text-swift-enter-active {
  transition: opacity 0.2s ease-out;
}

.text-swift-leave-active {
  transition: opacity 0.15s ease-out;
}

.text-swift-enter-from,
.text-swift-leave-to {
  opacity: 0;
}
</style>
