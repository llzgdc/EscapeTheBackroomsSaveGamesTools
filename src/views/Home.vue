<template>
  <div class="home-container" :class="{ 'multi-select-mode': isMultiSelectMode }">
    <!-- Multi-select mode toolbar -->
    <transition name="toolbar-slide">
      <div v-show="isMultiSelectMode" class="multi-select-toolbar">
        <div class="toolbar-left">
          <button class="toolbar-btn" @click="exitMultiSelectMode">
            <font-awesome-icon icon="fa-solid fa-arrow-left" />
            {{ $t("archiveSearch.multiSelect.exit") }}
          </button>
          <button class="toolbar-btn" @click="toggleSelectAll">
            <font-awesome-icon :icon="isAllSelected ? ['fas', 'times'] : ['fas', 'check-double']" />
            {{
              isAllSelected ? $t("archiveSearch.multiSelect.deselectAll") : $t("archiveSearch.multiSelect.selectAll")
            }}
          </button>
        </div>
        <div class="toolbar-right">
          <span class="selection-count">
            {{
              $t("archiveSearch.multiSelect.selected", {
                count: selectedArchives.size,
                total: archives.length,
              })
            }}
          </span>
          <button
            class="toolbar-btn danger"
            :disabled="selectedArchives.size === 0"
            @click="handleShowBatchDeleteConfirm"
          >
            <font-awesome-icon icon="fa-solid fa-trash-alt" />
            {{ $t("archiveSearch.multiSelect.batchDelete") }}
          </button>
        </div>
      </div>
    </transition>

    <div
      ref="scrollContainerRef"
      class="archive-list-container"
      :class="{ 'no-scroll': showSearch, 'multi-select-mode': isMultiSelectMode, 'is-refreshing': loading }"
    >
      <!-- MAINSAVE registry unreadable: the list still loads, but visibility
           info is gone and registry writes will fail. Explain instead of
           leaving the user with a silently degraded list. -->
      <MainsaveWarningBanner
        v-if="mainsaveStatus && !mainsaveStatus.missing && !mainsaveStatus.readable"
        :error="mainsaveStatus.error"
      />

      <!-- Ultra-light loading state: a single centered spinner.
           The old 12-card skeleton with shimmer animations
           was expensive enough to stall the first paint, making the
           whole UI feel frozen during the ~50ms IPC round-trip. -->
      <div v-if="!showCards" class="loading-skeleton">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
          <span class="spinner-text">{{ $t("common.loading") }}</span>
        </div>
      </div>

      <!-- Cards + empty states: rendered with full data once loading completes -->
      <template v-if="showCards">
        <div
          class="virtual-scroll-viewport"
          :style="{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }"
        >
          <div
            v-for="virtualRow in rowVirtualizer.getVirtualItems()"
            :key="String(virtualRow.key)"
            class="archive-row"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }"
          >
            <div class="archive-grid">
              <ArchiveCard
                v-for="(archive, colIndex) in getRowItems(virtualRow.index)"
                :key="archive.id"
                :data-archive-id="archive.id"
                :archive="archive"
                :index="virtualRow.index * columnsPerRow + colIndex"
                :is-multi-select-mode="isMultiSelectMode"
                :is-selected="selectedArchives.has(archive.id)"
                :search-query="searchQuery"
                @toggle-visibility="handleToggleVisibility"
                @edit="handleEdit"
                @delete="deleteArchive"
                @toggle-select="toggleArchiveSelection"
              />
            </div>
          </div>
        </div>

        <!-- Empty state: filters active, no matching archives -->
        <div v-if="displayArchives.length === 0 && archives.length > 0 && hasActiveFilters" class="empty-state">
          <EmptyState
            :icon="['fas', 'search']"
            :title="$t('archiveSearch.noResults')"
            :description="$t('archiveSearch.noMatchingArchives')"
            :hint="$t('archiveSearch.adjustSearchOrClearFilters')"
            :action-icon="['fas', 'xmark']"
            :action-text="$t('archiveSearch.clearFilters')"
            @action="clearAllFilters"
          />
        </div>

        <!-- Empty state: no archives exist yet -->
        <div v-if="displayArchives.length === 0 && dataLoadComplete && archives.length === 0" class="empty-state">
          <EmptyState
            variant="welcome"
            :icon="['fas', 'plus']"
            :title="$t('archiveSearch.noArchives')"
            :description="$t('archiveSearch.createNewArchive')"
            :action-icon="['fas', 'plus']"
            :action-text="$t('archiveSearch.createArchive')"
            @action="createNewArchive"
          />
        </div>
      </template>
    </div>

    <!-- Search panel -->
    <Teleport to="body">
      <transition
        name="search-panel"
        @before-enter="(el: Element) => beforeSearchEnter(el as HTMLElement)"
        @enter="(el: Element, done: () => void) => searchEnter(el as HTMLElement, done)"
        @leave="(el: Element, done: () => void) => searchLeave(el as HTMLElement, done)"
      >
        <div v-show="showSearch && !loading" class="search-overlay" @click.self="toggleSearch">
          <ArchiveSearchFilter
            ref="archiveSearchFilter"
            :search-query="searchQuery"
            :selected-archive-difficulty="selectedArchiveDifficulty"
            :selected-actual-difficulty="selectedActualDifficulty"
            :selected-visibility="selectedVisibility"
            :search-suggestions="searchSuggestions"
            @update:search-query="searchQuery = $event"
            @update:selected-archive-difficulty="selectedArchiveDifficulty = $event"
            @update:selected-actual-difficulty="selectedActualDifficulty = $event"
            @update:selected-visibility="selectedVisibility = $event"
            @close="toggleSearch"
          />
        </div>
      </transition>
    </Teleport>

    <!-- Delete confirmation -->
    <Teleport to="body">
      <ConfirmModal
        v-model:show="showDeleteConfirm"
        class="single-delete-confirm"
        :title="$t('confirmModal.deleteArchiveTitle')"
        :message="
          $t('confirmModal.deleteArchiveMessage', {
            name: archiveToDelete?.name || '',
          })
        "
        :description="$t('confirmModal.deleteArchiveDescription')"
        type="danger"
        :confirm-text="$t('confirmModal.confirm')"
        :cancel-text="$t('confirmModal.cancel')"
        :loading="isDeleting"
        :archive-details="archiveToDelete"
        @confirm="confirmDelete"
        @cancel="cancelDelete"
      />
    </Teleport>

    <!-- Batch delete confirmation -->
    <Teleport to="body">
      <ConfirmModal
        v-model:show="showBatchDeleteConfirm"
        class="batch-delete-confirm"
        :title="$t('confirmModal.batchDeleteTitle')"
        :message="
          $t('confirmModal.batchDeleteMessage', {
            count: selectedArchives.size,
          })
        "
        :description="$t('confirmModal.batchDeleteDescription')"
        type="danger"
        :confirm-text="$t('confirmModal.confirm')"
        :cancel-text="$t('confirmModal.cancel')"
        :loading="isBatchDeleting"
        @confirm="confirmBatchDelete"
        @cancel="cancelBatchDelete"
      />
    </Teleport>

    <!-- Batch delete progress overlay -->
    <BaseModal
      :visible="isBatchDeleting && !showBatchDeleteConfirm"
      :dismissable="false"
      max-width="380px"
      overlay-class="batch-delete-progress-overlay"
      card-class="batch-delete-progress"
    >
      <div class="progress-header">
        <font-awesome-icon icon="fa-solid fa-trash-alt" class="progress-icon" />
        <h3 class="progress-title">{{ $t("confirmModal.batchDeleteProgressTitle") }}</h3>
      </div>
      <div class="progress-body">
        <div class="progress-bar-track">
          <div class="progress-bar-fill" :style="{ width: batchDeleteProgressPercent + '%' }"></div>
        </div>
        <div class="progress-info">
          <span class="progress-count"> {{ batchDeleteProgress.current }} / {{ batchDeleteProgress.total }} </span>
          <span class="progress-percent">{{ batchDeleteProgressPercent }}%</span>
        </div>
        <div class="progress-current-file">
          <font-awesome-icon icon="fa-solid fa-file" class="file-icon" />
          <span class="file-name"
            >{{ $t("archiveSearch.multiSelect.deleting") }}: {{ batchDeleteProgress.archiveName }}</span
          >
        </div>
      </div>
    </BaseModal>

    <!-- Performance settings -->
    <BaseModal
      :visible="showPerformanceSettings"
      :title="$t('performanceSettings.title')"
      show-close
      @close="showPerformanceSettings = false"
    >
      <div class="modal-body">
        <PerformanceSettings
          v-model:performance-mode="performanceMode"
          v-model:animation-quality="animationQuality"
          v-model:hardware-acceleration="hardwareAcceleration"
          v-model:virtualization-enabled="virtualizationEnabled"
        />
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import { protectFloatingButtonPosition } from "@/utils/floatingButtonProtection";
import ArchiveCard from "@/components/archive/ArchiveCard.vue";
import ArchiveSearchFilter from "@/components/archive/ArchiveSearchFilter.vue";
import MainsaveWarningBanner from "@/components/archive/MainsaveWarningBanner.vue";
import ConfirmModal from "@/components/modal/ConfirmModal.vue";
import PerformanceSettings from "@/components/system/PerformanceSettings.vue";
import BaseModal from "@/components/ui/BaseModal.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { useArchiveData } from "@/composables/useArchiveData";
import type { ArchiveData } from "@/types";
import { useArchiveList } from "@/composables/useArchiveSearchFilter";
import { useArchiveActions } from "@/composables/useArchiveActions";
import { useVirtualScroll } from "@/composables/useVirtualScroll";
import { useMultiSelect } from "@/composables/useMultiSelect";
import { usePerformanceMonitor } from "@/composables/usePerformanceMonitor";
import { useAnimations } from "@/composables/useAnimations";
import { useFloatingButton } from "@/composables/useFloatingButton";
import { useToast } from "@/composables/useToast";
import { markInitialLoadComplete } from "@/composables/useArchiveCard";
import scheduler from "@/services/resourceScheduler";

// Explicit name so the router-view keep-alive include list can match it.
defineOptions({ name: "Home" });

// Composables
const archiveData = useArchiveData();
const {
  archives,
  loading,
  dataLoadComplete,
  incrementalLoadState,
  mainsaveStatus,
  initializeArchives,
  refreshArchives: refreshArchivesBase,
  refreshArchivesSilent,
} = archiveData;

const {
  displayArchives,
  searchQuery,
  selectedArchiveDifficulty,
  selectedActualDifficulty,
  selectedVisibility,
  searchSuggestions,
  hasActiveFilters,
  resetFilters,
} = useArchiveList(archives);

const archiveActions = useArchiveActions(archiveData, {});
const {
  showDeleteConfirm,
  archiveToDelete,
  isDeleting,
  handleToggleVisibility: handleToggleVisibilityBase,
  handleEdit,
  deleteArchive,
  confirmDelete: confirmDeleteBase,
  cancelDelete,
  createNewArchive,
  openSaveGamesFolder: openSaveGamesFolderBase,
  batchDeleteArchives,
  registerUndoShortcuts,
  unregisterUndoShortcuts,
} = archiveActions;

// Local state �?declared before composable calls that use them
const scrollContainerRef = ref<HTMLElement | null>(null);
const archiveSearchFilter = ref<InstanceType<typeof ArchiveSearchFilter> | null>(null);
const showSearch = ref(false);
// True when the search panel was opened via keyboard (Ctrl+F / F3) �?
// keyboard-initiated opens skip the entrance animation entirely.
const skipSearchAnimation = ref(false);
const isPageActive = ref(false);
const shouldResetScroll = ref(false);
const showCards = ref(false);

// Tracks pending compositing-refresh timeouts so they can be
// cleared on unmount �?prevents stale operations after destroy.
const pendingRefreshTimeouts: ReturnType<typeof setTimeout>[] = [];

// ─── Scroll-aware performance: disable hover animations while scrolling ──
// Applying CSS transition changes mid-scroll (hover �?transform/border-color)
// forces the browser to re-evaluate paint layers every frame.  Adding an
// 'is-scrolling' class on scroll start (and removing it after scroll stops)
// lets us disable expensive hover-triggered transitions via CSS, keeping the
// paint workload light while the user is actively scrolling.
let scrollTimer: ReturnType<typeof setTimeout> | null = null;
const SCROLL_STOP_DELAY = 150; // ms after scroll stops before re-enabling

const onScrollStart = (): void => {
  const el = scrollContainerRef.value;
  if (!el) return;
  el.classList.add("is-scrolling");
  if (scrollTimer) clearTimeout(scrollTimer);
  // Re-enable after scrolling stops for SCROLL_STOP_DELAY ms
  scrollTimer = setTimeout(() => {
    el?.classList.remove("is-scrolling");
    scrollTimer = null;
  }, SCROLL_STOP_DELAY);
};

// ─── Virtual scrolling with @tanstack/vue-virtual ──
const {
  rowVirtualizer,
  columnsPerRow,
  getRowItems,
  destroyObserver: destroyVirtualScrollObserver,
} = useVirtualScroll(scrollContainerRef, displayArchives);

// ─── Multi-select mode ──
const {
  isMultiSelectMode,
  selectedArchives,
  showBatchDeleteConfirm,
  isBatchDeleting,
  batchDeleteProgress,
  isAllSelected,
  enterMultiSelectMode,
  exitMultiSelectMode,
  toggleArchiveSelection,
  toggleSelectAll,
  confirmBatchDelete,
  cancelBatchDelete,
  handleShowBatchDeleteConfirm,
} = useMultiSelect(displayArchives, archives, {
  batchDeleteArchives,
});

const batchDeleteProgressPercent = computed(() => {
  if (batchDeleteProgress.value.total === 0) return 0;
  return Math.round((batchDeleteProgress.value.current / batchDeleteProgress.value.total) * 100);
});

const performanceMonitor = usePerformanceMonitor();
const {
  showPerformanceSettings,
  performanceMode,
  animationQuality,
  hardwareAcceleration,
  virtualizationEnabled,
  initPerformanceMonitor,
  cleanup: cleanupPerformance,
} = performanceMonitor;

const animations = useAnimations(performanceMode, animationQuality, skipSearchAnimation);
const { beforeSearchEnter, searchEnter, searchLeave } = animations;

const floatingButton = useFloatingButton();
const { initButtonProtection, cleanup: cleanupFloatingButton } = floatingButton;

const toast = useToast();

const { t } = useI18n({ useScope: "global" });
const route = useRoute();

// Local state (scrollContainerRef, showSearch, isPageActive, shouldResetScroll declared above)

// Methods
const toggleSearch = () => {
  showSearch.value = !showSearch.value;
  if (showSearch.value) {
    // Promote to searching priority immediately �?keeps backdrop-filter
    // visible and CPU budget high for the full duration the search is open.
    scheduler.beginOperation("searching");
    nextTick(() => {
      protectFloatingButtonPosition();
      archiveSearchFilter.value?.focus();
    });
  } else {
    scheduler.endOperation("searching");
  }
};

const openArchiveSearchPanel = () => {
  if (!showSearch.value) {
    showSearch.value = true;
  }
  nextTick(() => {
    protectFloatingButtonPosition();
    archiveSearchFilter.value?.focus();
  });
};

const handleOpenArchiveSearchEvent = (event: CustomEvent) => {
  if (!isPageActive.value) return;

  // Keyboard-triggered opens (Ctrl+F / F3) skip the entrance animation.
  skipSearchAnimation.value = event?.detail?.source === "shortcut";
  const mode = event?.detail?.mode || "open";
  if (mode === "toggle") {
    toggleSearch();
    return;
  }

  if (mode === "close") {
    showSearch.value = false;
    return;
  }

  openArchiveSearchPanel();
};

const onArchiveSearchEvent = (e: Event) => handleOpenArchiveSearchEvent(e as CustomEvent);

const clearAllFilters = () => {
  resetFilters();
  shouldResetScroll.value = true;
  protectFloatingButtonPosition();
};

const handleToggleVisibility = (archive: ArchiveData) => {
  handleToggleVisibilityBase(archive, {
    // Re-sync from the backend (MAINSAVE is the source of truth) so the toggle
    // always lands �?regardless of archive id shifts after a refresh.
    onRefresh: () => refreshArchivesSilent(),
    onSuccess: () => protectFloatingButtonPosition(),
  });
};

const confirmDelete = () => {
  confirmDeleteBase({
    onSuccess: () => {
      protectFloatingButtonPosition();
    },
  });
};

// ─── Refresh guard ──────────────────────────────
// Only prevents two refreshes from overlapping. There is deliberately no cooldown
// interval between auto-refresh (on activation) and a manual refresh �?the user can
// refresh again as soon as the previous run finishes.
let _refreshInFlight = false;

const refreshArchives = async (): Promise<void> => {
  if (_refreshInFlight) return;

  // Lock
  _refreshInFlight = true;
  try {
    // Predict archive loading before the operation starts,
    // so resources are pre-allocated for the incoming I/O.
    scheduler.predict("loading-archives", {
      source: "refresh-button",
      leadTime: 150,
      confidence: 0.98,
    });
    await refreshArchivesBase();
    toast.showSuccess(t("archiveSearch.refreshed"));
  } finally {
    _refreshInFlight = false;
  }
};

const openSaveGamesFolder = () => {
  openSaveGamesFolderBase({
    onSuccess: () => {
      protectFloatingButtonPosition();
      setTimeout(protectFloatingButtonPosition, 300);
    },
  });
};

// Bridge FAB click events from the persistent App-level FAB down to Home's handlers.
const isFabActionOnPage = () => isPageActive.value && route.name === "Home";
const handleFabAction = (e: Event) => {
  if (!isFabActionOnPage()) return;
  const action = (e as CustomEvent<{ action: string }>).detail?.action;
  switch (action) {
    case "search":
      toggleSearch();
      break;
    case "refresh":
      refreshArchives();
      break;
    case "folder":
      openSaveGamesFolder();
      break;
    case "multi-select":
      enterMultiSelectMode();
      break;
  }
};

// ─── Helpers ─────────────────────────────────────
/**
 * Force WebView2 GPU compositing layer refresh.
 *
 * WebView2 can fail to invalidate compositing layers when async content
 * (images from LazyImage) lands after the initial paint or when
 * `v-if` replaces the skeleton with virtual-scroll cards all at once.
 * This produces "blank-until-style-change" artifacts where GPU textures
 * for compositing layers remain stale.
 *
 * The approach:
 *   1. Read layout properties on the container to force a layout pass.
 *   2. Iterate virtual rows and force layout on each �?the row's
 *      `translateY` compositing layer is where stale textures appear.
 *   3. Apply a near-invisible opacity tweak (99.99%) that forces WebView2
 *      to re-composite the entire layer tree on the next frame.  Cleared
 *      immediately after so no persistent style is added.
 */
const forceCompositingRefresh = (): void => {
  const el = scrollContainerRef.value;
  if (!el) return;

  // Pass 1: Force synchronous layout on the container
  void el.offsetHeight;
  el.getClientRects();

  // Pass 2: Force layout on every virtual row element.
  // In WebView2, parent compositing layers (from row translateY)
  // don't invalidate when child content (images, card data) changes
  // unless the child's layout is explicitly re-calculated.
  const rows = el.querySelectorAll(".archive-row");
  for (let i = 0; i < rows.length; i++) {
    void (rows[i] as HTMLElement).offsetHeight;
  }
};

// After returning from the edit page, scroll the edited archive's card to the
// vertical center of the list so the user doesn't have to hunt for it.
const centerEditedArchive = (): void => {
  let name = "";
  try {
    name = sessionStorage.getItem("lastEditedArchiveName") || "";
  } catch {
    /* ignore */
  }
  if (!name) return;
  try {
    sessionStorage.removeItem("lastEditedArchiveName");
  } catch {
    /* ignore */
  }

  const idx = displayArchives.value.findIndex((a) => a.name === name);
  if (idx === -1) return;
  const cols = columnsPerRow.value || 1;
  const row = Math.floor(idx / cols);
  nextTick(() => {
    rowVirtualizer.value.scrollToIndex(row, { align: "center" });
  });
};

// ─── Card entrance animation ──────────────────────
// Replaced by the CSS .cards-enter animation on the virtual-scroll-viewport.
// The old per-card RAF reveal loop added ~700ms of delay (12 cards × 1 frame
// each + 500ms wait) with no benefit �?cards were hidden (opacity: 0) during
// most of that time.  Now all cards appear with a single container fade-in
// that completes in 200ms and doesn't block the initial render.
//
// Only animates cards in the initial viewport; cards created by virtual
// scroll on user scroll skip the entrance animation entirely.

// On keep-alive activation �?yield to the browser first so the
// sidebar's 300ms margin-left transition gets a clean first paint
// frame before we touch any Vue state.  Steps:
//   1. isPageActive + scrollTop (synchronous, trivial).
//   2. setTimeout(0) defers the rest to the NEXT macrotask �?by
//      then the sidebar has its first compositor frame scheduled.
//   3. showCards=false �?spinner replaces the card grid.
//   4. 18 RAF frames (~300ms) let the sidebar animation finish.
//   5. Boost priority, refresh data, flip showCards=true.
let activateTimer: ReturnType<typeof setTimeout> | null = null;
// Inside <KeepAlive> the FIRST onActivated fires immediately after onMounted,
// so the initial load is already driven by onMounted below. Without this flag
// the refresh path re-ran a full silent reload ~300ms into the first paint,
// hiding the just-rendered cards (spinner → cards → spinner → cards) and
// costing an extra IPC round-trip per entry.
let isFirstActivation = true;
declare global {
  interface Window {
    __toggleSidebar?: () => void;
    __toggleTitleBar?: () => void;
    themeManager?: { setTheme: (theme: string) => void };
  }
}

onActivated(() => {
  isPageActive.value = true;

  if (scrollContainerRef.value) {
    (scrollContainerRef.value as HTMLElement).scrollTop = 0;
  }

  // First activation: onMounted already kicked off the initial load, so skip
  // the deferred reload entirely.
  if (isFirstActivation) {
    isFirstActivation = false;
    return;
  }

  // Clear any leftover timer from a previous activation that didn't finish
  if (activateTimer) clearTimeout(activateTimer);
  activateTimer = setTimeout(() => {
    activateTimer = null;
    showCards.value = false;
    loading.value = true;

    let frames = 0;
    const waitAndLoad = () => {
      if (!isPageActive.value) return;
      if (++frames < 18) {
        requestAnimationFrame(waitAndLoad);
        return;
      }
      invoke("set_process_priority", { priority: "high" }).catch(() => {});
      refreshArchivesSilent().then(() => {
        // Revert the process priority unconditionally: bailing out on the
        // isPageActive guard first would leave the app stuck at HIGH process
        // priority for the rest of the session whenever the user navigated
        // away while the silent refresh was still in flight.
        invoke("set_process_priority", { priority: "normal" }).catch(() => {});
        if (!isPageActive.value) return;
        showCards.value = true;
        loading.value = false;
        nextTick(() => {
          rowVirtualizer.value.measure();
          centerEditedArchive();
          requestAnimationFrame(() => {
            rowVirtualizer.value.measure();
            requestAnimationFrame(forceCompositingRefresh);
          });
        });
      });
    };
    requestAnimationFrame(waitAndLoad);
  }, 0);
});

// On keep-alive deactivation
onDeactivated(() => {
  isPageActive.value = false;
  // Cancel the activate timer so it doesn't fire after we've navigated away
  if (activateTimer) {
    clearTimeout(activateTimer);
    activateTimer = null;
  }
});

onMounted(() => {
  window.addEventListener("open-archive-search", onArchiveSearchEvent);
  window.addEventListener("fab-action", handleFabAction);

  // Virtual scroll ResizeObserver auto-initializes via a watch on
  // scrollContainerRef �?column count is correct before any async IPC.
  requestIdleCallback(() => initPerformanceMonitor(), { timeout: 1500 });
  requestIdleCallback(() => initButtonProtection(), { timeout: 2000 });

  // Bind passive scroll listener to disable hover animations during scrolling.
  // Passive: true means the browser can scroll without waiting for this handler,
  // which is critical for scroll jank.  Only binds after data loads so the
  // container exists.
  scrollContainerRef.value?.addEventListener("scroll", onScrollStart, { passive: true });

  // ─── Fast path: skeleton immediate, data async ──────────────
  // Show skeleton right away, fire off Phase 1 IPC without await.
  // When the response arrives (~30-120ms), flip showCards which
  // triggers the CSS grid fade-in.  The old blocking await chain
  // kept the skeleton visible until IPC + measurement completed.
  //
  // Boost process to HIGH priority during the initial load so the
  // OS scheduler allocates more CPU time to rasterisation, layout,
  // and image decoding.  Revert to NORMAL once cards are shown.
  invoke("set_process_priority", { priority: "high" }).catch(() => {});
  loading.value = true;
  initializeArchives(true).then(() => {
    showCards.value = true;
    loading.value = false;
    invoke("set_process_priority", { priority: "normal" }).catch(() => {});

    // Virtualizer measurement �?runs after cards are in the DOM.
    nextTick(() => {
      rowVirtualizer.value.measure();
      requestAnimationFrame(() => {
        rowVirtualizer.value.measure();
        requestAnimationFrame(() => {
          forceCompositingRefresh();
          rowVirtualizer.value.measure();

          const scheduleRefresh = (delay: number) => {
            const timer = setTimeout(() => {
              forceCompositingRefresh();
              rowVirtualizer.value.measure();
            }, delay);
            pendingRefreshTimeouts.push(timer);
          };

          scheduleRefresh(150);
          scheduleRefresh(600);
          scheduleRefresh(2000);
          scheduleRefresh(5000);
        });
      });
    });
  });

  isPageActive.value = true;
  markInitialLoadComplete();
  registerUndoShortcuts();
});

onUnmounted(() => {
  unregisterUndoShortcuts();
  window.removeEventListener("open-archive-search", onArchiveSearchEvent);
  window.removeEventListener("fab-action", handleFabAction);

  destroyVirtualScrollObserver();
  cleanupPerformance();
  cleanupFloatingButton();
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.width = "";
  document.body.style.height = "";
  document.documentElement.style.overflow = "";

  // Clean up scroll timer & listener
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollContainerRef.value?.removeEventListener("scroll", onScrollStart);

  // Clear pending compositing-refresh timeouts
  for (const timer of pendingRefreshTimeouts) {
    clearTimeout(timer);
  }
  pendingRefreshTimeouts.length = 0;
});

// When displayArchives changes (filters applied), reset scroll position
watch(
  displayArchives,
  () => {
    const needResetScroll = shouldResetScroll.value;
    if (needResetScroll && scrollContainerRef.value) {
      (scrollContainerRef.value as HTMLElement).scrollTop = 0;
      shouldResetScroll.value = false;
    }

    // If displayArchives grew (new items appeared), re-measure virtualizer
    rowVirtualizer.value.measure();
  },
  { deep: false },
);

// Re-measure virtualiser when Phase 2 detail loading completes so that
// cards updated with actual level/difficulty data are positioned correctly.
// Uses the enhanced compositing refresh to ensure WebView2 GPU layers
// are rebuilt with the latest card data (currentLevel, backgroundImage).
watch(
  () => incrementalLoadState.value.phase,
  (phase) => {
    if (phase === "complete") {
      requestAnimationFrame(() => {
        rowVirtualizer.value.measure();
        requestAnimationFrame(forceCompositingRefresh);
      });
    }
  },
);

// ─── Search operation reporting ────────────────────────────
// When the user types in the search box, report "searching" to the
// scheduler so CPU budget is raised from 0.45 (interacting) to 0.7
// (searching).  This prevents the filter loop from blocking input.
// The operation auto-ends when the query is cleared or search closes.
watch(searchQuery, (query) => {
  if (query) {
    scheduler.beginOperation("searching");
  } else {
    // Only end searching if search panel is also closed
    if (!showSearch.value) {
      scheduler.endOperation("searching");
    }
  }
});
</script>

<style scoped>
.home-container {
  position: relative;
  height: 100%;
  width: 100%;
  background: var(--bg-primary);
}

.archive-list-container {
  height: calc(100% - 40px);
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg-primary);
  padding: 0 20px;
  box-sizing: border-box;
  /* Optimize scroll performance */
  -webkit-overflow-scrolling: touch;
  /* GPU compositing hint for the scrollable container itself.
     Keeps the container's backing store on the GPU across scroll
     frames, avoiding a re-paint on every scroll event. */
  will-change: scroll-position;
  /* contain: paint �?tells the browser the container's painted
     content never affects anything outside its bounds.  Limits
     paint overflow calculation to the container itself. */
  contain: paint;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin: 16px;
  border-radius: var(--radius-xl);
}

.archive-list-container.no-scroll {
  overflow: hidden;
}

/* Adjust archive list container in multi-select mode */
.archive-list-container.multi-select-mode {
  height: calc(100% - 100px);
  padding-top: 60px;
}

/* ─── Card grid entrance animation ────────────────
 * All cards fade in together via the container, replacing
 * the old per-card RAF reveal loop that delayed the last
 * card by ~700ms.  The 200ms CSS animation plays once on
 * mount and completes before the user can interact. */
@keyframes cards-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.virtual-scroll-viewport {
  animation: cards-fade-in 0.25s ease-out both;
}

.archive-row {
  padding: 0;
  /* Explicit will-change hint �?the row is translated on every scroll
     via inline translateY().  Without this hint WebView2 promotes the
     compositing layer lazily the first time the transform changes,
     causing a visible jank on the initial scroll frame. */
  will-change: transform;
  /* content-visibility: auto �?tells the browser it can skip layout,
     paint, and compositing for rows that are far off-screen.  Even
     though virtual scroll keeps DOM count low, the browser still
     spends time on style recalculation and paint preparation for
     rows near the visible boundary.  With content-visibility, the
     browser only does that work when a row is about to enter the
     viewport, reducing per-frame GPU compositing overhead during
     fast scrolling. */
  content-visibility: auto;
  contain-intrinsic-size: 180px;
}

.archive-grid {
  display: grid;
  gap: 20px;
  width: 100%;
  box-sizing: border-box;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  /* ─── Refresh transition ───────────────────────
   * When the user taps the refresh button, the cards perform a
   * "breathe" motion �?fade + contract briefly, then spring back
   * when the new data arrives.  This gives clear visual feedback
   * that the data was reloaded rather than silently replacing. */
  transition:
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Refresh animation: cards "exhale" while data reloads */
.archive-list-container.is-refreshing .archive-grid {
  opacity: 0.45;
  transform: scale(0.97);
}

.archive-grid :deep(.archive-card) {
  width: 100%;
  min-width: 0;
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  transform-origin: center center;
}

.archive-grid :deep(.archive-card.deleting) {
  pointer-events: none;
  transition: opacity 0.2s linear !important;
  transform: none !important;
}

/* ─── Scroll-aware hover disable ────────────────────
   While the user is actively scrolling, disable expensive
   hover-triggered CSS transitions that force paint/layout:
     - archive-card hover transform (translateY) causes repaint
     - difficulty-tag hover width animation triggers layout
     - card-info hover bg color triggers paint
   Once scrolling stops (~150ms), the is-scrolling class is
   removed and hover effects return to normal. */
.archive-list-container.is-scrolling :deep(.archive-grid .archive-card:hover) {
  transform: none !important;
  box-shadow: none !important;
}

.archive-list-container.is-scrolling :deep(.archive-card:hover .card-background .lazy-image-container) {
  filter: none !important;
  transform: none !important;
}

.archive-list-container.is-scrolling :deep(.archive-card:hover .card-info) {
  background-color: transparent !important;
}

.archive-list-container.is-scrolling :deep(.archive-card:hover .difficulty-tag) {
  width: var(--w-short, auto) !important;
  background: rgba(0, 0, 0, 0.35) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  border-color: rgba(255, 255, 255, 0.25) !important;
}

.archive-list-container.is-scrolling :deep(.difficulty-tag .tag-short) {
  opacity: 1 !important;
}

.archive-list-container.is-scrolling :deep(.difficulty-tag .tag-full) {
  opacity: 0 !important;
}

/* ─── Loading skeleton ──────────────────────────── */
.loading-skeleton {
  padding: 0;
}

.loading-skeleton {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 200px);
  width: 100%;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--text-tertiary);
}

.spinner-ring {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary);
  border-radius: var(--radius-circle);
  animation: spinner-rotate 0.8s linear infinite;
}

.spinner-text {
  font-size: 14px;
  font-weight: 500;
}

@keyframes spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}

/* ─── Reduce motion ──────────────────────────────
 * Disable the refresh "breathe" animation for users who
 * prefer reduced motion, while still allowing the spinner
 * ring to animate (that one is essential feedback). */
@media (prefers-reduced-motion: reduce) {
  .archive-grid {
    transition: none;
  }

  .archive-list-container.is-refreshing .archive-grid {
    opacity: 1;
    transform: none;
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 200px);
  padding: 48px 24px;
  width: 100%;
}

.search-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--search-overlay-bg, rgba(0, 0, 0, 0.5));
  backdrop-filter: var(--search-overlay-backdrop, blur(8px));
  -webkit-backdrop-filter: var(--search-overlay-backdrop, blur(8px));
}

.modal-body {
  padding: 20px;
}

.loading {
  opacity: 0.6;
  pointer-events: none;
}

@media (max-width: 768px) {
  .archive-list-container {
    padding: 12px;
  }

  .archive-grid {
    gap: 16px;
  }
}

@media (max-width: 480px) {
  .archive-list-container {
    padding: 8px;
  }

  .archive-grid {
    gap: 12px;
    grid-template-columns: 1fr;
  }
}

@media (prefers-color-scheme: dark) {
  .empty-content {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.05);
  }
}

.archive-list-container::-webkit-scrollbar {
  width: 8px;
}

.archive-list-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill);
}

.archive-list-container::-webkit-scrollbar-thumb {
  background: var(--primary-color);
  border-radius: var(--radius-pill);
}

.multi-select-toolbar {
  position: fixed;
  top: 38px;
  left: var(--sidebar-width, 70px);
  right: 0;
  z-index: 9999;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-5);
  background: var(--bg-primary);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
  gap: var(--space-4);
  transition:
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 1;
  transform: translateY(0);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.multi-select-toolbar .toolbar-left,
.multi-select-toolbar .toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.multi-select-toolbar .toolbar-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--btn-secondary-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-button);
  color: var(--text-color);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.multi-select-toolbar .toolbar-btn:hover:not(:disabled) {
  background: var(--btn-secondary-bg-hover);
  border-color: var(--primary);
  color: var(--primary);
}

.multi-select-toolbar .toolbar-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.multi-select-toolbar .toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.multi-select-toolbar .toolbar-btn.danger {
  background: linear-gradient(135deg, #ff3b30, #ff453a);
  border-color: #ff3b30;
  color: #fff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(255, 59, 48, 0.35);
}

.multi-select-toolbar .toolbar-btn.danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #ff453a, #ff6b5e);
  border-color: #ff453a;
  color: #fff;
  box-shadow: 0 4px 14px rgba(255, 59, 48, 0.45);
}

.multi-select-toolbar .toolbar-btn.danger:active:not(:disabled) {
  transform: scale(0.97);
}

.multi-select-toolbar .toolbar-btn.danger:disabled {
  background: rgba(255, 59, 48, 0.35);
  border-color: rgba(255, 59, 48, 0.4);
  color: rgba(255, 255, 255, 0.75);
}

.multi-select-toolbar .selection-count {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
  padding: var(--space-2) var(--space-4);
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  border-radius: var(--radius-pill);
}

.multi-select-toolbar .selection-count .count-number {
  font-weight: 600;
  color: var(--primary);
  font-size: 15px;
}

[data-theme="dark"] .multi-select-toolbar .selection-count {
  background: rgba(10, 132, 255, 0.15);
}

.toolbar-slide-enter-active,
.toolbar-slide-leave-active {
  transition:
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toolbar-slide-enter-from,
.toolbar-slide-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

.toolbar-slide-enter-to,
.toolbar-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* Single delete confirmation modal overlay �?covers FAB */
.single-delete-confirm {
  z-index: 10001 !important;
}

/* Batch delete confirmation modal overlay �?covers multi-select toolbar and FAB with blur */
.batch-delete-confirm {
  z-index: 10001 !important;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Batch delete progress overlay �?covers full viewport including multi-select toolbar */
/* Batch delete progress: BaseModal overlay/card tweaks (teleported, so :global) */
:global(.batch-delete-progress-overlay) {
  z-index: 10001 !important;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

:global(.batch-delete-progress) {
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.batch-delete-progress .progress-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border-color);
}

.batch-delete-progress .progress-icon {
  font-size: 20px;
  color: #ff3b30;
}

.batch-delete-progress .progress-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.batch-delete-progress .progress-body {
  padding: 24px;
}

.batch-delete-progress .progress-bar-track {
  width: 100%;
  height: 8px;
  background: var(--bg-secondary);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.batch-delete-progress .progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff3b30, #ff6b6b);
  border-radius: var(--radius-pill);
  transition: width 0.3s ease;
}

.batch-delete-progress .progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.batch-delete-progress .progress-count {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.batch-delete-progress .progress-percent {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.batch-delete-progress .progress-current-file {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
}

.batch-delete-progress .progress-current-file .file-icon {
  font-size: 14px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.batch-delete-progress .progress-current-file .file-name {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Progress overlay modal animation reuses existing .modal-* classes */
</style>
