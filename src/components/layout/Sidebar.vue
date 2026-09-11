<template>
  <div
    ref="sidebarRef"
    class="sidebar"
    :class="{ expanded: isExpanded }"
    role="navigation"
    aria-label="Main menu"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @keydown="handleKeydown"
  >
    <div class="sidebar-content">
      <!-- Top section -->
      <div class="sidebar-section top-section">
        <div
          v-for="item in filteredTopMenuItems"
          :key="item.id"
          class="sidebar-item"
          :class="['sidebar-item', { active: item.id === activeItemId }]"
          :tabindex="isExpanded ? 0 : -1"
          role="link"
          :aria-label="safeT(item.textKey)"
          :aria-current="item.id === activeItemId ? 'page' : undefined"
          :data-item-id="item.id"
          @click="handleItemClick(item, $event)"
          @mousedown="handleMouseDown"
          @mouseenter="handleMouseEnterItem"
          @mouseleave="handleMouseLeaveItem"
          @mouseup="handleMouseUp"
        >
          <div class="sidebar-icon-container">
            <font-awesome-icon :icon="item.icon" class="sidebar-icon" aria-hidden="true" />
          </div>
          <div class="sidebar-text-container">
            <span
              class="sidebar-text"
              :data-text="safeT(item.textKey)"
              :class="{ visible: isExpanded }"
              :data-lang="currentLanguage"
            >
              {{ safeT(item.textKey) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Bottom section -->
      <div class="sidebar-section bottom-section">
        <div
          v-for="item in bottomMenuItems"
          :key="item.id"
          class="sidebar-item"
          :class="['sidebar-item', { active: item.id === activeItemId }]"
          :tabindex="isExpanded ? 0 : -1"
          role="link"
          :aria-label="safeT(item.textKey)"
          :aria-current="item.id === activeItemId ? 'page' : undefined"
          :data-item-id="item.id"
          @click="handleItemClick(item, $event)"
          @mousedown="handleMouseDown"
          @mouseenter="handleMouseEnterItem"
          @mouseleave="handleMouseLeaveItem"
          @mouseup="handleMouseUp"
        >
          <div class="sidebar-icon-container">
            <font-awesome-icon :icon="item.icon" class="sidebar-icon" aria-hidden="true" />
          </div>
          <div class="sidebar-text-container">
            <span
              class="sidebar-text"
              :data-text="safeT(item.textKey)"
              :class="{ visible: isExpanded }"
              :data-lang="currentLanguage"
            >
              {{ safeT(item.textKey) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { topMenuItems, bottomMenuItems } from "@/config/sidebarMenu";
import { gsap } from "gsap";
import { useAppStore } from "@/stores/appStore";
import { getAppContext } from "@/appContext.js";

const emit = defineEmits(["sidebar-action", "sidebar-expand"]);
const route = useRoute();
const router = useRouter();

const useSidebarState = () => {
  const isExpanded = ref(false);
  const sidebarRef = ref(null);
  const activeItemId = ref<number | null>(null);

  const handleMouseEnter = () => {
    isExpanded.value = true;
    emit("sidebar-expand", true);
  };

  const handleMouseLeave = () => {
    isExpanded.value = false;
    emit("sidebar-expand", false);
  };

  return { isExpanded, sidebarRef, activeItemId, handleMouseEnter, handleMouseLeave };
};

const useSidebarI18n = () => {
  const { i18n } = getAppContext();

  const t = computed(() => {
    return i18n ? i18n.t : (key) => key;
  });

  const currentLanguage = computed(() => {
    return i18n ? i18n.locale.value || i18n.locale : "zh-CN";
  });

  const safeT = (key: string): string => {
    const translateFn = t.value;
    return typeof translateFn === "function" ? String(translateFn(key)) : key;
  };

  return { t, currentLanguage, safeT };
};

const useSidebarMenuItems = () => {
  const filteredTopMenuItems = computed(() => {
    return [...topMenuItems.value];
  });

  return { filteredTopMenuItems };
};

const useSidebarRouteHandler = (activeItemId: Ref<number | null>) => {
  const setActiveItemFromRoute = () => {
    const allMenuItems = [...topMenuItems.value, ...bottomMenuItems.value];
    let activeItem;

    const routeName = route.name as string | undefined;
    if (routeName === "SelectCreateMode") {
      activeItem = allMenuItems.find((item) => item.route === "CreateArchive");
    } else if (routeName && ["CreateArchive", "QuickCreateArchive", "BatchCreateArchive"].includes(routeName)) {
      activeItem = allMenuItems.find((item) => item.route === "CreateArchive");
    } else {
      activeItem = allMenuItems.find((item) => item.route === routeName);
    }

    activeItemId.value = activeItem ? activeItem.id : 1; // default to first menu item
  };

  return { setActiveItemFromRoute };
};

const useSidebarTheme = (_sidebarRef: Ref<HTMLElement | null>) => {
  const detectTheme = () => {
    // The active theme is applied pre-paint by the inline script in
    // index.html and kept up to date by ThemeManager; only force a reflow
    // so the sidebar repaints with it. Never touch data-theme here —
    // forcing a theme would fight the theme system on every mount.
    requestAnimationFrame(() => {
      if (_sidebarRef.value) {
        _sidebarRef.value.style.visibility = "hidden";
        void _sidebarRef.value.offsetHeight;
        _sidebarRef.value.style.visibility = "visible";
      }
    });
  };

  return { detectTheme };
};

const useSidebarMenuItemManager = (_activeItemId: Ref<number | null>, _setActiveItemFromRoute: () => void) => {
  // No dynamic menu items currently managed
  return {};
};

const useSidebarTextMeasurement = () => {
  const getTextWidth = (text: string) => {
    const tempElement = document.createElement("span");
    tempElement.style.position = "absolute";
    tempElement.style.visibility = "hidden";
    tempElement.style.whiteSpace = "nowrap";
    tempElement.style.fontSize = "16px";
    tempElement.style.fontFamily = '-apple-system, BlinkMacSystemFont, "San Francisco", "Helvetica Neue", sans-serif';
    tempElement.textContent = text;

    document.body.appendChild(tempElement);
    const textWidth = tempElement.offsetWidth;
    document.body.removeChild(tempElement);

    return textWidth;
  };

  const checkTextOverflow = (element: HTMLElement | null, text: string) => {
    if (!element) return false;
    const textWidth = getTextWidth(text);
    return textWidth > 150;
  };

  return { getTextWidth, checkTextOverflow };
};

const useSidebarMouseInteractions = (
  checkTextOverflow: (el: HTMLElement | null, text: string) => boolean,
  getTextWidth: (text: string) => number,
) => {
  let isMouseDown = false;
  let currentPressedItem: HTMLElement | null = null;

  const handleMouseDown = (event: MouseEvent) => {
    isMouseDown = true;
    currentPressedItem = event.currentTarget as HTMLElement;
    gsap.to(currentPressedItem, { scale: 0.95, duration: 0.1, ease: "power2.out" });
  };

  const handleMouseEnterItem = (event: MouseEvent) => {
    if (isMouseDown) {
      if (currentPressedItem && currentPressedItem !== event.currentTarget) {
        gsap.to(currentPressedItem, { scale: 1, duration: 0.1, ease: "power2.out" });
      }
      currentPressedItem = event.currentTarget as HTMLElement;
      gsap.to(currentPressedItem, { scale: 0.95, duration: 0.1, ease: "power2.out" });
    }

    const textElement = (event.currentTarget as HTMLElement).querySelector(".sidebar-text") as HTMLElement | null;
    const itemText = textElement?.getAttribute("data-text") || textElement?.textContent || "";
    if (!textElement || !itemText) return;

    if (checkTextOverflow(textElement, itemText)) {
      textElement.classList.add("scroll-needed", "scroll-active");
      textElement.style.animation = "";
      textElement.style.transform = "";
      textElement.style.transition = "";

      const textWidth = getTextWidth(itemText);
      const scrollDistance = textWidth + 16;
      const duration = Math.max(8, scrollDistance / 25);

      textElement.style.animationDuration = `${duration}s`;
    }
  };

  const handleMouseLeaveItem = (event: MouseEvent) => {
    if (!isMouseDown && currentPressedItem) {
      gsap.to(currentPressedItem, { scale: 1, duration: 0.1, ease: "power2.out" });
      currentPressedItem = null;
    }

    const textElement = (event.currentTarget as HTMLElement).querySelector(".sidebar-text") as HTMLElement | null;
    if (textElement && textElement.classList.contains("scroll-active")) {
      const style = window.getComputedStyle(textElement);
      const matrix = new DOMMatrix(style.transform);
      const currentX = matrix.m41 || 0;

      textElement.style.animation = "none";
      textElement.style.transition = "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
      textElement.style.transform = `translateX(${currentX}px)`;

      void textElement.offsetHeight;
      textElement.style.transform = "translateX(0)";
      textElement.classList.remove("scroll-active");

      setTimeout(() => {
        textElement.style.transition = "";
        textElement.style.transform = "";
      }, 400);
    }
  };

  const handleMouseUp = () => {
    isMouseDown = false;
    if (currentPressedItem) {
      gsap.to(currentPressedItem, { scale: 1, duration: 0.1, ease: "power2.out" });
      currentPressedItem = null;
    }
  };

  return { handleMouseDown, handleMouseEnterItem, handleMouseLeaveItem, handleMouseUp };
};

const useSidebarActions = (activeItemId: Ref<number | null>, _safeT: (key: string) => string) => {
  let currentPressedItem: HTMLElement | null = null;

  const allFlatMenuItems = computed(() => {
    return [...topMenuItems.value, ...bottomMenuItems.value];
  });

  const handleItemClick = (item: { id: number; action?: string; route?: string }, _event?: MouseEvent) => {
    activeItemId.value = item.id;

    if (item.action) {
      window.dispatchEvent(new CustomEvent("sidebar-action", { detail: { action: item.action, item } }));
    }

    if (item.route && router.hasRoute(item.route)) {
      router.push({ name: item.route });
    }

    if (currentPressedItem) {
      gsap.to(currentPressedItem, { scale: 1, duration: 0.1, ease: "power2.out" });
      currentPressedItem = null;
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (!isExpanded.value) return;

    const flatItems = allFlatMenuItems.value;
    if (flatItems.length === 0) return;

    const currentIndex = flatItems.findIndex((item) => item.id === activeItemId.value);
    let targetIndex;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        targetIndex = currentIndex < flatItems.length - 1 ? currentIndex + 1 : 0;
        break;
      case "ArrowUp":
        event.preventDefault();
        targetIndex = currentIndex > 0 ? currentIndex - 1 : flatItems.length - 1;
        break;
      case "Home":
        event.preventDefault();
        targetIndex = 0;
        break;
      case "End":
        event.preventDefault();
        targetIndex = flatItems.length - 1;
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (currentIndex >= 0 && currentIndex < flatItems.length) {
          handleItemClick(flatItems[currentIndex]);
        }
        return;
      default:
        targetIndex = currentIndex;
        break;
    }

    if (targetIndex >= 0 && targetIndex < flatItems.length) {
      const targetItem = flatItems[targetIndex];
      activeItemId.value = targetItem.id;

      // Focus the corresponding DOM element
      const targetEl = document.querySelector(`[data-item-id="${targetItem.id}"]`);
      if (targetEl) (targetEl as HTMLElement).focus();
    }
  };

  return { handleItemClick, handleKeydown };
};

const appStore = useAppStore();
const { isExpanded, sidebarRef, activeItemId, handleMouseEnter, handleMouseLeave } = useSidebarState();
const { currentLanguage, safeT } = useSidebarI18n();
const { filteredTopMenuItems } = useSidebarMenuItems();
const { setActiveItemFromRoute } = useSidebarRouteHandler(activeItemId);
const { detectTheme } = useSidebarTheme(sidebarRef);
useSidebarMenuItemManager(activeItemId, setActiveItemFromRoute);
const { getTextWidth, checkTextOverflow } = useSidebarTextMeasurement();
const { handleMouseDown, handleMouseEnterItem, handleMouseLeaveItem, handleMouseUp } = useSidebarMouseInteractions(
  checkTextOverflow,
  getTextWidth,
);
const { handleItemClick, handleKeydown } = useSidebarActions(activeItemId, safeT);

const onToggleSidebar = (e: Event) => {
  const detail = (e as CustomEvent).detail;
  if (detail.collapsed && isExpanded.value) handleMouseLeave();
  else if (!detail.collapsed && !isExpanded.value) handleMouseEnter();
};

const onPluginMenuAdded = () => nextTick(() => setActiveItemFromRoute());
const onPluginMenuRemoved = () => nextTick(() => setActiveItemFromRoute());

onMounted(() => {
  setActiveItemFromRoute();
  detectTheme();

  watch(
    () => route.name,
    () => setActiveItemFromRoute(),
  );

  watch(currentLanguage, () => nextTick(() => {}));

  watch(
    () => appStore.language,
    () => nextTick(() => {}),
  );

  window.addEventListener("toggle-sidebar", onToggleSidebar);
  window.addEventListener("plugin-menu-added", onPluginMenuAdded);
  window.addEventListener("plugin-menu-removed", onPluginMenuRemoved);
});

onUnmounted(() => {
  window.removeEventListener("toggle-sidebar", onToggleSidebar);
  window.removeEventListener("plugin-menu-added", onPluginMenuAdded);
  window.removeEventListener("plugin-menu-removed", onPluginMenuRemoved);
});
</script>

<style scoped>
/* Sidebar container styles */
.sidebar {
  position: fixed;
  top: 38px;
  /* Starts below title bar, title bar height is 38px */
  left: 0;
  height: calc(100vh - 38px);
  /* Minus title bar height */
  width: 70px;
  /* Collapsed width */
  --sidebar-width: 70px;
  background: var(--bg-sidebar);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  overflow: hidden;
  border-right: 1px solid var(--sidebar-border-color);
  border-radius: 0 var(--radius-sidebar) var(--radius-sidebar) 0;
  font-family: -apple-system, BlinkMacSystemFont, "San Francisco", "Helvetica Neue", sans-serif;
  transition:
    background 0.25s ease,
    border-right 0.25s ease,
    box-shadow 0.25s ease,
    width 0.3s ease,
    --sidebar-width 0.3s ease;
}

/* Sidebar expanded styles */
.sidebar.expanded {
  width: 220px;
  /* Expanded width */
  --sidebar-width: 220px;
}

/* Sidebar icon styles */
.sidebar-icon {
  font-size: 18px;
  color: var(--text);
  transition: color 0.25s ease;
}

/* Sidebar text styles */
.sidebar-text {
  opacity: 0;
  transition:
    opacity 0.3s ease,
    transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    color 0.25s ease;
  font-size: 16px;
  white-space: nowrap;
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "San Francisco", "Helvetica Neue", sans-serif;
  transform: translateX(-10px);
  display: block;
  position: relative;
  overflow: visible;
  width: max-content;
  max-width: none;
}

/* Sidebar item styles */
.sidebar-item {
  display: flex;
  align-items: center;
  padding: var(--space-3) 0;
  cursor: pointer;
  transition:
    background-color 0.25s ease,
    color 0.25s ease,
    filter 0.25s ease;
  white-space: nowrap;
  border-radius: var(--radius-sidebar);
  margin: 0 var(--space-4);
  position: relative;
  justify-content: flex-start;
  color: var(--sidebar-text-color);
  min-height: 48px;
  /* Ensure consistent height between collapsed and expanded states */
}

/* Sidebar item hover state styles */
.sidebar-item:hover {
  background: var(--sidebar-hover-bg);
  filter: drop-shadow(var(--filter-shadow-md));
  transition:
    background-color 0.25s ease,
    filter 0.25s ease;
}

/* Sidebar item active state styles */
.sidebar-item.active {
  background: var(--sidebar-active-bg);
  color: var(--sidebar-active-color);
  box-shadow: inset 0 0 0 2px var(--sidebar-active-border);
  transition:
    background-color 0.25s ease,
    color 0.25s ease,
    box-shadow 0.25s ease;
}

/* Sidebar item active+hover state styles */
.sidebar-item.active:hover {
  background: var(--sidebar-active-hover-bg);
  transition:
    background-color 0.25s ease,
    filter 0.25s ease;
}

/* Sidebar content area styles */
.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--space-4) 0;
  overflow-x: hidden;
  overflow-y: hidden;
  scrollbar-width: none;
  gap: var(--space-4);
  /* Use unified spacing variable */

  .sidebar.expanded & {
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: var(--radius-pill);
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }
  }
}

/* Sidebar section styles */
.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

/* Top section styles */
.top-section {
  flex: 1;
  overflow-x: hidden;
  overflow-y: hidden;
  scrollbar-width: none;
  padding-top: var(--space-2);
}

.sidebar.expanded .top-section {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
  transition: scrollbar-color 0.3s ease;
}

.sidebar.expanded .top-section:hover {
  scrollbar-color: var(--scrollbar-thumb-hover) transparent;
}

.sidebar.expanded .top-section::-webkit-scrollbar {
  width: 4px;
}

.sidebar.expanded .top-section::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar.expanded .top-section::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: var(--radius-pill);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: transform, opacity;
  opacity: 0.6;
  width: 6px !important;
  margin: var(--space-1) !important;
}

.sidebar.expanded .top-section:hover::-webkit-scrollbar-thumb {
  opacity: 1;
}

.sidebar.expanded .top-section:hover::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb-hover);
}

.sidebar.expanded .top-section::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

.sidebar.expanded .top-section::-webkit-scrollbar-button {
  display: none !important;
  height: 0 !important;
  width: 0 !important;
  min-height: 0 !important;
  min-width: 0 !important;
  background: transparent !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  box-shadow: none !important;
  overflow: hidden !important;
  visibility: hidden !important;
}

.sidebar.expanded .top-section::-webkit-scrollbar-corner {
  background: transparent;
}

/* Bottom section styles */
.bottom-section {
  flex-shrink: 0;
  margin-top: auto;
  padding: var(--space-4) 0;
  /* Use unified spacing variable */
}

.bottom-section .sidebar-item:last-child {
  margin-bottom: 0px;
  /* Remove extra bottom margin from last item */
}

/* Sidebar icon container styles */
.sidebar-icon-container {
  position: absolute;
  left: 7px;
  /* Center icon: 70px total width - 24px icon = 46px, 23px centered */
  z-index: 1;
  transition: left 0.3s ease;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Sidebar icon styles */
.sidebar-icon {
  font-size: 18px;
  color: var(--text);
  transition: color 0.25s ease;
}

/* Sidebar text container styles */
.sidebar-text-container {
  margin-left: 55px;
  /* Unified spacing for expanded state */
  transition: margin-left 0.3s ease;
  flex: 1;
  overflow: hidden;
  padding-right: var(--space-5);
  /* Use unified spacing variable */
}

/* Sidebar text styles */
.sidebar-text {
  opacity: 0;
  transition:
    opacity 0.3s ease,
    transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  font-size: 16px;
  white-space: nowrap;
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "San Francisco", "Helvetica Neue", sans-serif;
  transform: translateX(-10px);
  display: block;
  position: relative;
  overflow: visible;
  width: max-content;
  max-width: none;
}

.sidebar-text.visible {
  opacity: 1;
  transform: translateX(0);
}

/* Swift UI style text switch animation */
.sidebar-text.fade-enter {
  opacity: 0;
  transform: translateY(4px);
}

.sidebar-text.fade-enter-active {
  transition:
    opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-text.fade-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.sidebar.expanded .sidebar-text-container {
  margin-left: 55px;
  /* Unified spacing, keep consistent */
}

.sidebar.expanded .sidebar-item:hover .sidebar-text-container {
  overflow: hidden;
  position: relative;
  width: 100%;
}

.sidebar.expanded .sidebar-item:hover .sidebar-text-container .sidebar-text {
  display: inline-block;
  white-space: nowrap;
  width: max-content;
  position: relative;
  transition: transform 0.4s ease-out;
}

/* Text-overflow marquee is hover-only — gate to precise pointers so
   touch devices don't get a stuck infinite scroll on tap. */
@media (hover: hover) and (pointer: fine) {
  .sidebar.expanded .sidebar-item:hover .sidebar-text-container .sidebar-text.scroll-needed {
    animation: scroll-text var(--animation-duration, 8s) linear infinite;
    animation-delay: 0.8s;
  }

  .sidebar.expanded .sidebar-item:hover .sidebar-text-container .scroll-active::after {
    content: attr(data-text);
    position: absolute;
    left: 100%;
    top: 0;
    white-space: nowrap;
    width: max-content;
    margin-left: var(--space-4);
    /* Use unified spacing variable */
  }
}

/* Text scroll animation */
@keyframes scroll-text {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(calc(-100% - var(--space-4)));
    /* Use unified spacing variable */
  }
}

/* Notification animation */
@keyframes fadeInOut {
  0% {
    opacity: 0;
    transform: translate(-50%, -10px);
  }

  20% {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  80% {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -10px);
  }
}

.sidebar.expanded .sidebar-item:not(:hover) .sidebar-text-container .sidebar-text.scroll-active {
  animation: none !important;
}

/* Sidebar item styles */
.sidebar-item {
  display: flex;
  align-items: center;
  padding: var(--space-3) 0;
  cursor: pointer;
  transition:
    background-color 0.25s ease,
    color 0.25s ease,
    filter 0.25s ease;
  white-space: nowrap;
  border-radius: var(--radius-sidebar);
  margin: 0 var(--space-4);
  position: relative;
  justify-content: flex-start;
  color: var(--sidebar-text-color);
  min-height: 48px;
  /* Ensure consistent height between collapsed and expanded states */
}

/* Sidebar item hover state styles */
.sidebar-item:hover {
  background: var(--sidebar-hover-bg);
  filter: drop-shadow(var(--filter-shadow-md));
}

/* Sidebar item active state styles */
.sidebar-item.active {
  background: var(--sidebar-active-bg);
  color: var(--sidebar-active-color);
  box-shadow: inset 0 0 0 2px var(--sidebar-active-border);
}

/* Sidebar item active+hover state styles */
.sidebar-item.active:hover {
  background: var(--sidebar-active-hover-bg);
}
</style>
