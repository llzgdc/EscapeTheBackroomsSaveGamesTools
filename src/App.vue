<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import storage from "./services/storageService";
import { useAppStore } from "./stores/appStore";
import scheduler from "./services/resourceScheduler";
import { themeManager } from "./styles/theme-config";
import PerformanceMonitor from "./components/system/PerformanceMonitor.vue";
import GlobalSearchPanel from "./components/feature/GlobalSearchPanel.vue";
import Sidebar from "./components/layout/Sidebar.vue";
import TitleBar from "./components/layout/TitleBar.vue";
import ErrorBoundary from "./components/ui/ErrorBoundary.vue";
import FloatingActionButton from "./components/feature/FloatingActionButton.vue";

const router = useRouter();
const route = useRoute();
const sidebarExpanded = ref(false);
const showGlobalSearch = ref(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalSearchRef = ref<any>(null);
const appStore = useAppStore();
const fabCurrentIndex = ref(0);

// Bridge FAB click events from App-level persistent FAB down to Home,
// which is the page that owns the handlers (kept alive, different component branch).
const emitFabAction = (action: string) => {
  window.dispatchEvent(new CustomEvent("fab-action", { detail: { action } }));
};

// Compute effective margins based on sidebar/titlebar visibility
const contentStyle = computed(() => ({
  marginTop: appStore.titleBarVisible ? "38px" : "0",
  marginLeft: appStore.sidebarVisible ? "var(--sidebar-width, 70px)" : "0",
}));
const shouldShowPerformanceMonitor = computed(
  () => appStore.performanceMonitorEnabled && appStore.developerModeEnabled,
);

// Keep-alive include list, derived from router meta as the single source of
// truth. NOTE: keep-alive matches the component's registered name, so every
// cached view must declare an explicit `defineOptions({ name })` (or a
// filename-derived name that matches its route name).
const cachedComponents = router.options.routes
  .filter((r) => r.meta?.keepAlive)
  .map((r) => String(r.name));

// ─── Resource Scheduler ──────────────────────────────────
// Map route names to scheduler operation types for auto-detection
const ROUTE_OPERATION_MAP: Record<string, string> = {
  Home: "previewing",
  CreateArchive: "editing",
  EditArchive: "editing",
  QuickCreateArchive: "editing",
  SelectCreateMode: "previewing",
  Settings: "rendering",
  Mods: "rendering",
  Trash: "previewing",
  About: "rendering",
};

// Track last route operation for cleanup on navigation
let lastRouteOp: string | null = null;

// Report the current route as an operation when it changes
watch(
  () => route.name,
  (name, _oldName) => {
    const routeName = name as string;
    // End previous route operation
    if (lastRouteOp && ROUTE_OPERATION_MAP[lastRouteOp]) {
      scheduler.endOperation(ROUTE_OPERATION_MAP[lastRouteOp] as typeof scheduler.dominantOperation);
    }
    // Begin new route operation
    const opType = ROUTE_OPERATION_MAP[routeName];
    if (opType) {
      scheduler.beginOperation(opType as typeof scheduler.dominantOperation);
      lastRouteOp = routeName;
    } else {
      lastRouteOp = null;
    }
    // ── Predictive scheduling ──────────────
    // When navigating TO Home, predict that archive loading is imminent.
    // The route transition takes ~300ms (sidebar animation + fade);
    // by predicting early we pre-allocate CPU/GPU resources before
    // initializeArchives() actually fires its IPC calls.
    if (_oldName && name === "Home" && _oldName !== "Home") {
      scheduler.predict("loading-archives", {
        source: "route-change",
        leadTime: 400, // sidebar animation + fade before data loads
        confidence: 0.95,
      });
    }
  },
  { immediate: true },
);

const handleSidebarExpand = (expanded: boolean) => {
  sidebarExpanded.value = expanded;
};

const closeGlobalSearch = () => {
  showGlobalSearch.value = false;
  scheduler.endOperation("searching");
};

const openHomeSearch = (mode = "open") => {
  window.dispatchEvent(
    new CustomEvent("open-archive-search", {
      detail: { source: "shortcut", mode },
    }),
  );
};

const openGlobalSearch = ({ navigate = false, backward = false } = {}) => {
  showGlobalSearch.value = true;
  scheduler.beginOperation("searching");
  nextTick(() => {
    const panel = globalSearchRef.value;
    if (!panel) return;

    if (navigate) {
      if (backward) {
        panel.findPrevious();
      } else {
        panel.findNext();
      }
      return;
    }

    if (panel.focusInput) {
      panel.focusInput();
    }
  });
};

const handleFindShortcut = () => {
  if (route.name === "Home") {
    closeGlobalSearch();
    // Predict that search panel will open — pre-warm resources
    scheduler.predict("searching", { source: "keyboard-shortcut", leadTime: 100, confidence: 0.9 });
    openHomeSearch("toggle");
    return;
  }

  if (showGlobalSearch.value) {
    closeGlobalSearch();
    return;
  }

  // Predict search opening
  scheduler.predict("searching", { source: "keyboard-shortcut", leadTime: 50, confidence: 0.95 });
  openGlobalSearch({ navigate: false });
};

const handleFindNavigateShortcut = (backward = false) => {
  if (route.name === "Home") {
    closeGlobalSearch();
    openHomeSearch("open");
    return;
  }
  openGlobalSearch({ navigate: true, backward });
};

const handleGlobalKeydown = (event: KeyboardEvent) => {
  const key = String(event.key || "").toLowerCase();
  const isFindShortcut = (event.ctrlKey || event.metaKey) && key === "f";

  if (isFindShortcut) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
    handleFindShortcut();
    return;
  }

  // Ctrl+Shift+F — Open advanced global search
  const isAdvancedFindShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && key === "f";
  if (isAdvancedFindShortcut) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
    openGlobalSearch({ navigate: false });
    return;
  }

  if (event.key === "F3") {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
    if (route.name === "Home") {
      closeGlobalSearch();
      openHomeSearch("toggle");
      return;
    }
    if (showGlobalSearch.value) {
      closeGlobalSearch();
      return;
    }
    openGlobalSearch({ navigate: false });
  }
};

const handleFindEventFromLock = () => {
  handleFindShortcut();
};

const handleFindNextEventFromLock = (event: Event) => {
  handleFindNavigateShortcut(!!(event as CustomEvent)?.detail?.backward);
};

let removeAfterEach: (() => void) | null = null;

let mainContentCache: Element | null = null;

const getMainContent = () => {
  if (!mainContentCache) {
    mainContentCache = document.querySelector(".main-content");
  }
  return mainContentCache;
};

// Event handler refs — defined here so addEventListener and removeEventListener
// use the SAME function reference (anonymous arrows in onUnmounted won't match).
const onOpenArchiveSearch = () => {
  scheduler.beginOperation("searching");
};
const onCloseArchiveSearch = () => {
  scheduler.endOperation("searching");
};
const onSchedulerFps = (e: Event) => {
  scheduler.feedFps((e as CustomEvent).detail);
};
const onSchedulerMemory = (e: Event) => {
  scheduler.feedMemory((e as CustomEvent).detail);
};

onMounted(() => {
  document.addEventListener("keydown", handleGlobalKeydown, true);
  window.addEventListener("app-global-find", handleFindEventFromLock);
  window.addEventListener("app-global-find-next", handleFindNextEventFromLock);

  // Listen for search open/close to report to scheduler
  window.addEventListener("open-archive-search", onOpenArchiveSearch);
  window.addEventListener("close-archive-search", onCloseArchiveSearch);

  // Listen for performance data to feed back into scheduler
  window.addEventListener("scheduler-fps", onSchedulerFps);
  window.addEventListener("scheduler-memory", onSchedulerMemory);

  // Start the resource scheduler
  scheduler.start();

  removeAfterEach = router.afterEach((to, from) => {
    if (to.name !== from.name) {
      const mainContent = getMainContent();
      if (mainContent) {
        mainContent.scrollTop = 0;
      }
    }
  });

  requestIdleCallback(
    () => {
      initThemeSystem();
    },
    { timeout: 1000 },
  );

  // Expose dev toggle functions to console when in developer mode
  if (appStore.developerModeEnabled) {
    window.__toggleSidebar = () => appStore.toggleSidebar();
    window.__toggleTitleBar = () => appStore.toggleTitleBar();
  }
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleGlobalKeydown, true);
  window.removeEventListener("app-global-find", handleFindEventFromLock);
  window.removeEventListener("app-global-find-next", handleFindNextEventFromLock);
  window.removeEventListener("open-archive-search", onOpenArchiveSearch);
  window.removeEventListener("close-archive-search", onCloseArchiveSearch);
  window.removeEventListener("scheduler-fps", onSchedulerFps);
  window.removeEventListener("scheduler-memory", onSchedulerMemory);
  scheduler.stop();
  if (removeAfterEach) removeAfterEach();
  mainContentCache = null;
});

watch(
  () => route.fullPath,
  () => {
    closeGlobalSearch();
  },
);

async function initThemeSystem() {
  if (!storage.isInitialized()) {
    await storage.initStorage();
  }

  // ThemeManager reads the persisted theme (Tauri config, falling back to
  // storage), lazy-loads the extra theme CSS when needed, and enables
  // switch transitions.
  await themeManager.init();
}
</script>

<template>
  <div class="app-container" :class="{ 'no-titlebar': !appStore.titleBarVisible }">
    <TitleBar v-if="appStore.titleBarVisible" />
    <PerformanceMonitor v-if="shouldShowPerformanceMonitor" class="performance-monitor" />
    <GlobalSearchPanel ref="globalSearchRef" :visible="showGlobalSearch" @close="closeGlobalSearch" />
    <div class="content-wrapper">
      <Sidebar v-if="appStore.sidebarVisible" @sidebar-expand="handleSidebarExpand" />
      <main
        class="main-content"
        :class="{
          'sidebar-collapsed': !sidebarExpanded,
          'sidebar-expanded': sidebarExpanded,
        }"
        :style="contentStyle"
      >
        <router-view v-slot="{ Component, route: viewRoute }">
          <transition name="page-fade">
            <!-- ErrorBoundary sits OUTSIDE keep-alive: keep-alive matches its
                 direct child's name, so wrapping the other way would make the
                 include list compare against "ErrorBoundary" and never cache. -->
            <ErrorBoundary :key="'eb-' + viewRoute.fullPath">
              <keep-alive :include="cachedComponents">
                <component :is="Component" :key="viewRoute.fullPath" />
              </keep-alive>
            </ErrorBoundary>
          </transition>
        </router-view>
      </main>

      <!-- Persistent FAB lives outside keep-alive so its DOM survives route
           changes and the show/hide transition can actually play. -->
      <FloatingActionButton
        :current-index="fabCurrentIndex"
        @update:current-index="fabCurrentIndex = $event"
        @search-click="emitFabAction('search')"
        @refresh-click="emitFabAction('refresh')"
        @folder-click="emitFabAction('folder')"
        @multi-select-click="emitFabAction('multi-select')"
      />
    </div>
  </div>
</template>

<style scoped>
/* Modal window animation - optimized performance */
.modal-enter-active,
.modal-leave-active {
  transition:
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: opacity, transform;
  transform: translateZ(0);
  /* Force hardware acceleration */
  backface-visibility: hidden;
  /* Prevent layer flickering */
}

.modal-enter-from {
  opacity: 0;
  transform: scale(0.9) translateZ(0);
}

.modal-leave-to {
  opacity: 0;
  transform: scale(0.9) translateZ(0);
}

.performance-monitor {
  position: fixed;
  top: 56px;
  right: 20px;
  width: 300px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(0, 255, 0, 0.4);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(6px);
  pointer-events: auto;
  transition:
    opacity 0.3s ease,
    backdrop-filter 0.3s ease;
}

.performance-monitor:hover {
  opacity: 0.3;
  backdrop-filter: none;
}

.performance-monitor * {
  pointer-events: none !important;
}
</style>
<style>
/* Page transition — smooth crossfade. Old and new pages fade simultaneously and
   overlap (absolute), so there is never a blank gap like the previous out-in fade
   produced (leave fades out → background → enter fades in). Both opacity fades
   happen over the same content area → no flashing when jumping to the edit page. */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease !important;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0 !important;
}

/* Global base style reset */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* 根字号基准：rem 依据此缩放 */
html {
  font-size: 16px;
}

/* Global border radius */
body {
  font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  background: var(--app-bg, var(--bg));
  color: var(--text);
  transition:
    background 0.3s ease,
    color 0.3s ease;
  overflow: hidden;
  cursor: default;
  /* Remove transform to prevent affecting fixed-position elements */
  /* transform: translateZ(0); */
  /* will-change: transform; */
}

#app {
  height: 100vh;
  overflow: hidden;
}

/* Global button border radius */
button,
.btn,
[role="button"] {
  border-radius: var(--radius-button);
}

/* Global input border radius */
input,
textarea,
select {
  border-radius: var(--radius-input);
}

/* Global card border radius */
.card,
.archive-card,
.level-card,
.modal-card,
.dropdown-content {
  border-radius: var(--radius-card);
}

/* Global tag border radius */
.tag,
.badge,
.label {
  border-radius: var(--radius-tag);
}

/* Global modal border radius */
.modal,
.dialog,
.popup {
  border-radius: var(--radius-modal);
}

/* Global dropdown border radius */
.dropdown,
.menu,
.context-menu {
  border-radius: var(--radius-dropdown);
}

/* Global tooltip border radius */
.tooltip,
.popover {
  border-radius: var(--radius-tooltip);
}

/* Global image container border radius */
.image-container,
.avatar,
.icon-container {
  border-radius: var(--radius-image);
}

/* ── 额外全局圆角映射 ──
 *   覆盖常见 UI 元素，确保大圆角 + 胶囊风格统一
 */
.btn-primary,
.btn-secondary,
.btn-outline,
.btn-success,
.btn-danger,
.btn-warning,
.btn-info,
.button-primary,
.button-secondary {
  border-radius: var(--radius-button) !important;
}

select,
.input,
.input-field,
.form-input,
.form-control,
.search-input {
  border-radius: var(--radius-input);
}

.list-item,
.menu-item,
.dropdown-item,
.select-option {
  border-radius: var(--radius-md);
}

.section,
.panel,
.settings-section,
.config-panel {
  border-radius: var(--radius-card);
}

/* 胶囊标签 / 徽章 */
.label-badge,
.status-badge,
.count-badge,
.version-tag,
.level-tag,
.type-badge {
  border-radius: var(--radius-tag);
}

/* 小元素也至少使用 xs 圆角 */
.small-indicator,
.progress-step,
.dot-indicator,
.color-swatch,
.icon-wrapper {
  border-radius: var(--radius-xs);
}

/* 模态框 / 弹窗 */
.modal-window,
.dialog-box,
.alert-box,
.prompt-box {
  border-radius: var(--radius-modal);
}

/* 侧边栏 */
.sidebar-panel,
.nav-panel {
  border-radius: var(--radius-sidebar);
}

/* ── 胶囊 / Pill 形状实用类 ──
 *   使用时: <div class="pill"> 或 <span class="capsule">
 */
.pill,
.capsule {
  border-radius: var(--radius-pill) !important;
}

/* Hide all scrollbars while keeping scroll functionality */
::-webkit-scrollbar {
  width: 0px;
  height: 0px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: transparent;
}

/* Firefox */
* {
  scrollbar-width: none;
  -ms-overflow-style: none;
  /* IE and Edge */
}

.app-container {
  display: flex;
  height: 100vh;
  flex-direction: column;
}

.content-wrapper {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  height: 100vh;
  /* No smooth scrolling here: route changes must land at the top instantly,
     without a visible scroll-to-top animation. */
  scroll-behavior: auto;
  /* Anchors the crossfading (absolutely positioned) pages during transitions. */
  position: relative;
}

/* When titlebar is hidden, adjust sidebar position */
.no-titlebar .sidebar {
  top: 0 !important;
  height: 100vh !important;
}
</style>
