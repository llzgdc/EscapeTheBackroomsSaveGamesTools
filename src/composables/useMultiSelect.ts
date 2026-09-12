import { ref, computed, onDeactivated, onUnmounted, type Ref } from "vue";
import type { ArchiveData } from "@/types";

interface DeleteResults {
  success: number[];
  failed: Array<{ id: number; error: unknown }>;
}

interface BatchDeleteCallbacks {
  onSuccess?: (results: DeleteResults) => void;
  onError?: (results: DeleteResults) => void;
  onProgress?: (current: number, total: number, archiveName: string) => void;
}

export interface MultiSelectActions {
  batchDeleteArchives: (archiveList: ArchiveData[], callbacks?: BatchDeleteCallbacks) => Promise<DeleteResults>;
}

export interface BatchDeleteProgress {
  current: number;
  total: number;
  archiveName: string;
}

/**
 * Multi-select mode composable for the archive list page.
 * Manages selection state, toolbar actions, and batch delete flow.
 */
export function useMultiSelect(
  displayArchives: Ref<ArchiveData[]>,
  archives: Ref<ArchiveData[]>,
  actions: MultiSelectActions,
) {
  const isMultiSelectMode = ref(false);
  const selectedArchives = ref(new Set<number>());
  const showBatchDeleteConfirm = ref(false);
  const isBatchDeleting = ref(false);
  const batchDeleteProgress = ref<BatchDeleteProgress>({ current: 0, total: 0, archiveName: "" });

  const isAllSelected = computed(() => {
    return displayArchives.value.length > 0 && selectedArchives.value.size === displayArchives.value.length;
  });

  let scrollTopBeforeMultiSelect = 0;
  let scrollLeftBeforeMultiSelect = 0;

  const enterMultiSelectMode = (): void => {
    isMultiSelectMode.value = true;
    selectedArchives.value = new Set();
    // Save current scroll position before locking — position:fixed jumps to top
    scrollTopBeforeMultiSelect = window.scrollY || document.documentElement.scrollTop || 0;
    scrollLeftBeforeMultiSelect = window.scrollX || document.documentElement.scrollLeft || 0;
    // Disable page scrolling
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    document.documentElement.style.overflow = "hidden";
  };

  const exitMultiSelectMode = (): void => {
    isMultiSelectMode.value = false;
    selectedArchives.value = new Set();
    // Restore page scrolling
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";
    document.body.style.height = "";
    document.documentElement.style.overflow = "";
    // Restore the scroll position that was lost when position:fixed was applied
    window.scrollTo(scrollLeftBeforeMultiSelect, scrollTopBeforeMultiSelect);
  };

  // The scroll lock lives on <body>, i.e. OUTSIDE this component's DOM. Leaving
  // multi-select mode only via confirm/cancel meant that navigating away while
  // the mode was active (the host page is keep-alive, so it deactivates rather
  // than unmounts) left position:fixed / overflow:hidden applied globally and
  // every other page unscrollable. Always release the lock on deactivate/unmount.
  const releaseScrollLock = (): void => {
    if (isMultiSelectMode.value) {
      exitMultiSelectMode();
    }
  };
  onDeactivated(releaseScrollLock);
  onUnmounted(releaseScrollLock);

  const toggleArchiveSelection = (archiveId: number): void => {
    const newSet = new Set(selectedArchives.value);
    if (newSet.has(archiveId)) {
      newSet.delete(archiveId);
    } else {
      newSet.add(archiveId);
    }
    selectedArchives.value = newSet;
  };

  const toggleSelectAll = (): void => {
    if (isAllSelected.value) {
      selectedArchives.value = new Set();
    } else {
      selectedArchives.value = new Set(displayArchives.value.map((a) => a.id));
    }
  };

  const handleShowBatchDeleteConfirm = (): void => {
    showBatchDeleteConfirm.value = true;
  };

  const cancelBatchDelete = (): void => {
    showBatchDeleteConfirm.value = false;
  };

  const confirmBatchDelete = async (): Promise<void> => {
    isBatchDeleting.value = true;
    batchDeleteProgress.value = { current: 0, total: selectedArchives.value.size, archiveName: "" };
    const idsToDelete = Array.from(selectedArchives.value);
    const archivesToDelete = archives.value.filter((a) => idsToDelete.includes(a.id));

    await actions.batchDeleteArchives(archivesToDelete, {
      onProgress: (current, total, archiveName) => {
        batchDeleteProgress.value = { current, total, archiveName };
      },
      onSuccess: () => {
        isBatchDeleting.value = false;
        showBatchDeleteConfirm.value = false;
        exitMultiSelectMode();
      },
      onError: () => {
        isBatchDeleting.value = false;
        showBatchDeleteConfirm.value = false;
        exitMultiSelectMode();
      },
    });
  };

  return {
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
  };
}
