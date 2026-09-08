import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useToast } from "./useToast";
import { useUndoRedo } from "./useUndoRedo";
import { tauriArchiveAdapter } from "@/adapters/tauri/archiveAdapter";
import type { Ref } from "vue";
import type { Router } from "vue-router";
import type { ArchiveData } from "@/types";

// Store for edit archive data (avoids passing large JSON via route params)
export const editArchiveDataStore = new Map<string, string>();

/**
 * Insert an item into a name-sorted array at the correct position.
 * Used by undo restore to preserve the name-sorted ordering
 * established in useArchiveData.
 */
function insertSortedByName(arr: ArchiveData[], item: ArchiveData): void {
  const insertAt = arr.findIndex((a) => a.name.localeCompare(item.name) > 0);
  if (insertAt === -1) {
    arr.push(item);
  } else {
    arr.splice(insertAt, 0, item);
  }
}

interface ArchiveActionsCallbacks {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  onRefresh?: () => Promise<void>;
}

interface ToggleVisibilityCallbacks {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  onRefresh?: () => Promise<void>;
}

interface DeleteResults {
  success: number[];
  failed: Array<{ id: number; error: unknown }>;
}

interface BatchDeleteCallbacks {
  onSuccess?: (results: DeleteResults) => void;
  onError?: (results: DeleteResults) => void;
  onRefresh?: () => Promise<void>;
  onProgress?: (current: number, total: number, archiveName: string) => void;
}

interface ArchiveActionsReturn {
  showDeleteConfirm: Ref<boolean>;
  archiveToDelete: Ref<ArchiveData | null>;
  isDeleting: Ref<boolean>;
  handleToggleVisibility: (updatedArchive: ArchiveData, callbacks?: ToggleVisibilityCallbacks) => Promise<void>;
  handleEdit: (archive: ArchiveData) => void;
  deleteArchive: (archive: ArchiveData) => void;
  confirmDelete: (callbacks?: ArchiveActionsCallbacks) => Promise<void>;
  cancelDelete: () => void;
  closeDeleteModal: () => void;
  createNewArchive: () => void;
  openSaveGamesFolder: (callbacks?: Pick<ArchiveActionsCallbacks, "onSuccess">) => Promise<void>;
  batchDeleteArchives: (archiveList: ArchiveData[], callbacks?: BatchDeleteCallbacks) => Promise<DeleteResults>;
  cancelBatchDelete: () => void;
  registerUndoShortcuts: () => void;
  unregisterUndoShortcuts: () => void;
  canUndo: import("vue").ComputedRef<boolean>;
  canRedo: import("vue").ComputedRef<boolean>;
}

interface ArchiveDataMethods {
  archives: Ref<ArchiveData[]>;
  updateArchiveVisibility?: (id: number, visible: boolean, path?: string) => void;
}

/**
 * Find an archive in the list by its file path, falling back to its id.
 * Ids are per-load enumeration indices and SHIFT whenever a refresh adds or
 * removes saves — and a shifted id can COLLIDE with an unrelated archive, so
 * the stable file path must be checked first.
 */
function findArchiveIndex(archives: ArchiveData[], archive: ArchiveData): number {
  if (archive.path) {
    const normalized = archive.path.toLowerCase();
    const byPath = archives.findIndex((a) => a.path && a.path.toLowerCase() === normalized);
    if (byPath !== -1) return byPath;
  }
  return archives.findIndex((a) => a.id === archive.id);
}

export function useArchiveActions(
  archiveData: ArchiveDataMethods,
  _filters: Record<string, unknown>,
): ArchiveActionsReturn {
  const router: Router = useRouter();
  const { t } = useI18n({ useScope: "global" });
  const toast = useToast();
  const { pushAction, undo, redo, canUndo, canRedo } = useUndoRedo();

  const showDeleteConfirm = ref(false);
  const archiveToDelete = ref<ArchiveData | null>(null);
  const isDeleting = ref(false);

  // Archives with a toggle currently in flight, keyed by file path. Guards
  // against double-clicks firing two overlapping toggles that would cancel
  // each other out on the backend.
  const togglingArchives = new Set<string>();

  /**
   * Apply an explicit visibility state on disk AND reconcile the UI against
   * the backend-verified end state. Used by toggle, undo and redo so the UI
   * can never drift from what MAINSAVE actually contains.
   */
  const applyVerifiedVisibility = async (
    archive: Pick<ArchiveData, "id" | "name" | "path">,
    target: boolean,
  ): Promise<boolean> => {
    if (!archive.path) return target;
    // Remember the live state so a failed call rolls the card back to what the
    // disk last reported — NEVER to the unverified desired state.
    const priorIndex = findArchiveIndex(archiveData.archives.value, archive as ArchiveData);
    const priorState = priorIndex !== -1 ? archiveData.archives.value[priorIndex].isVisible : undefined;
    const result = await tauriArchiveAdapter.toggleArchiveVisibility(archive.path, archive.name, target);
    const verified = result.success ? result.data?.isVisible : undefined;
    // Always reconcile the UI with what the backend reports — even on failure,
    // so the card never keeps claiming a state the disk disagrees with.
    archiveData.updateArchiveVisibility?.(archive.id, verified ?? priorState ?? target, archive.path);
    if (verified !== target) {
      throw new Error(result.error || "Visibility change was not applied");
    }
    return verified;
  };

  const handleToggleVisibility = async (
    updatedArchive: ArchiveData,
    callbacks: ToggleVisibilityCallbacks = {},
  ): Promise<void> => {
    const { onSuccess, onError, onRefresh } = callbacks;
    const archivePath = updatedArchive.path;

    try {
      if (!archivePath) {
        throw new Error("Archive has no file path");
      }

      // Single-flight guard: drop further clicks on the same archive while a
      // toggle is still in flight.
      if (togglingArchives.has(archivePath)) return;
      togglingArchives.add(archivePath);

      const desiredVisibility = updatedArchive.isVisible;
      // Capture the ACTUAL prior state from the live array — never derive it
      // from `!updatedArchive.isVisible`.
      const liveIndex = findArchiveIndex(archiveData.archives.value, updatedArchive);
      const originalVisibility =
        liveIndex !== -1 ? archiveData.archives.value[liveIndex].isVisible : !desiredVisibility;

      // Optimistic update
      archiveData.updateArchiveVisibility?.(updatedArchive.id, desiredVisibility, archivePath);

      // Send the DESIRED state (not a relative flip) and verify the backend's
      // reported end state. Retry once — transient MAINSAVE contention (the
      // game rewriting MAINSAVE.sav) can make the first attempt fail.
      let result = await tauriArchiveAdapter.toggleArchiveVisibility(
        archivePath,
        updatedArchive.name,
        desiredVisibility,
      );
      if (!result.success || result.data?.isVisible !== desiredVisibility) {
        console.warn("[toggle] Verification failed, retrying once:", result.error);
        result = await tauriArchiveAdapter.toggleArchiveVisibility(archivePath, updatedArchive.name, desiredVisibility);
      }

      const verified = result.success ? result.data?.isVisible : undefined;
      if (verified !== desiredVisibility) {
        // Roll the UI back to what the backend actually reports (or the prior
        // state when it could not be read at all).
        archiveData.updateArchiveVisibility?.(updatedArchive.id, verified ?? originalVisibility, archivePath);
        throw new Error(result.error || "Toggle verification failed");
      }

      // Register undo/redo with EXPLICIT target states — never relative flips,
      // so a stale snapshot cannot re-apply the wrong direction.
      const archiveSnapshot: ArchiveData = { ...updatedArchive, isVisible: originalVisibility };
      pushAction({
        description: `Toggle visibility of "${updatedArchive.name}"`,
        undo: async () => {
          try {
            await applyVerifiedVisibility(archiveSnapshot, originalVisibility);
          } catch (e) {
            console.warn("[undo] Failed to toggle visibility:", e);
            toast.showError(t("archive.actions.toggleVisibilityFailed"));
          }
        },
        redo: async () => {
          try {
            await applyVerifiedVisibility(archiveSnapshot, desiredVisibility);
          } catch (e) {
            console.warn("[redo] Failed to toggle visibility:", e);
            toast.showError(t("archive.actions.toggleVisibilityFailed"));
          }
        },
      });

      onSuccess?.();
      await onRefresh?.();
    } catch (_error) {
      onError?.(_error);
      toast.showError(t("archive.actions.toggleVisibilityFailed"));
    } finally {
      if (archivePath) togglingArchives.delete(archivePath);
    }
  };

  const handleEdit = (archive: ArchiveData): void => {
    editArchiveDataStore.set("current", JSON.stringify(archive));
    router.push({ name: "EditArchive", params: { archiveData: archive.id.toString() } });
  };

  const deleteArchive = (archive: ArchiveData): void => {
    archiveToDelete.value = archive;
    showDeleteConfirm.value = true;
  };

  const confirmDelete = async (callbacks: ArchiveActionsCallbacks = {}): Promise<void> => {
    const { onSuccess, onError, onRefresh } = callbacks;
    const archive = archiveToDelete.value;
    if (!archive) return;

    isDeleting.value = true;
    try {
      if (!archive.path) {
        // No path = nothing on disk to delete. Faking success here would leave
        // disk and list permanently out of sync.
        throw new Error("Archive has no file path");
      }
      const result = await tauriArchiveAdapter.softDeleteArchive(archive.path);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete archive");
      }

      // Remove from local array. Look up by stable file path too — ids shift
      // whenever a refresh re-enumerates saves.
      const index = findArchiveIndex(archiveData.archives.value, archive);
      if (index !== -1) {
        const removed = archiveData.archives.value.splice(index, 1)[0];

        // Register undo action
        pushAction({
          description: `Delete archive "${archive.name}"`,
          undo: async () => {
            if (archive.path) {
              try {
                await tauriArchiveAdapter.restoreArchive(archive.path);
                insertSortedByName(archiveData.archives.value, removed);
              } catch (e) {
                console.warn("[undo] Failed to restore archive:", e);
                toast.showError(t("archive.actions.deleteFailed"));
              }
            }
          },
          redo: async () => {
            if (archive.path) {
              try {
                await tauriArchiveAdapter.softDeleteArchive(archive.path);
                const idx = findArchiveIndex(archiveData.archives.value, removed);
                if (idx !== -1) {
                  archiveData.archives.value.splice(idx, 1);
                }
              } catch (e) {
                console.warn("[redo] Failed to delete archive:", e);
              }
            }
          },
        });
      }

      toast.showSuccess(t("archive.actions.deleteSuccess", { name: archive.name }));
      closeDeleteModal();
      onSuccess?.();
      await onRefresh?.();
    } catch (_error) {
      onError?.(_error);
      toast.showError(t("archive.actions.deleteFailed"));
    } finally {
      isDeleting.value = false;
    }
  };

  const cancelDelete = (): void => {
    archiveToDelete.value = null;
    showDeleteConfirm.value = false;
  };

  const closeDeleteModal = (): void => {
    showDeleteConfirm.value = false;
    archiveToDelete.value = null;
  };

  const createNewArchive = (): void => {
    router.push({ name: "SelectCreateMode" });
  };

  const openSaveGamesFolder = async (callbacks: Pick<ArchiveActionsCallbacks, "onSuccess"> = {}): Promise<void> => {
    const { onSuccess } = callbacks;
    try {
      const result = await tauriArchiveAdapter.openSaveGamesFolder();
      if (result.success) {
        onSuccess?.();
      } else {
        toast.showError(t("archive.actions.openFolderFailed"));
      }
    } catch {
      toast.showError(t("archive.actions.openFolderFailed"));
    }
  };

  // AbortSignal for in-flight batch delete — lets the UI cancel a long operation
  let batchDeleteAbortController: AbortController | null = null;

  /** Cancel an in-flight batch delete. No-op if none is running. */
  const cancelBatchDelete = (): void => {
    if (batchDeleteAbortController) {
      batchDeleteAbortController.abort();
      batchDeleteAbortController = null;
    }
  };

  const batchDeleteArchives = async (
    archiveList: ArchiveData[],
    callbacks: BatchDeleteCallbacks = {},
  ): Promise<DeleteResults> => {
    const { onSuccess, onError, onRefresh, onProgress } = callbacks;
    const results: DeleteResults = { success: [], failed: [] };
    batchDeleteAbortController = new AbortController();
    const signal = batchDeleteAbortController.signal;

    for (let i = 0; i < archiveList.length; i++) {
      // Allow cancellation between items
      if (signal.aborted) {
        results.failed.push({ id: archiveList[i].id, error: "Cancelled by user" });
        continue;
      }

      const archive = archiveList[i];
      onProgress?.(i + 1, archiveList.length, archive.name);

      try {
        if (!archive.path) {
          // No path = nothing on disk to delete — count it as failed instead of
          // silently "succeeding" with only a UI change.
          throw new Error("Archive has no file path");
        }
        const result = await tauriArchiveAdapter.softDeleteArchive(archive.path);
        if (!result.success) {
          throw new Error(result.error || "Failed to delete archive");
        }
        results.success.push(archive.id);

        // Remove from local array (path fallback — see findArchiveIndex)
        const index = findArchiveIndex(archiveData.archives.value, archive);
        if (index !== -1) {
          archiveData.archives.value.splice(index, 1);
        }
      } catch (error) {
        results.failed.push({ id: archive.id, error });
      }
    }

    batchDeleteAbortController = null;

    if (results.failed.length === 0) {
      toast.showSuccess(t("archive.actions.batchDeleteSuccess", { count: results.success.length }));
      onSuccess?.(results);
      await onRefresh?.();
    } else {
      onError?.(results);
      toast.showError(
        t("archive.actions.batchDeleteComplete", {
          success: results.success.length,
          failed: results.failed.length,
        }),
      );
    }

    return results;
  };

  // Shared stable handler: removeEventListener only removes the exact same
  // function object, so a second identical-looking closure in unregister
  // would silently fail and leak the listener (re-firing undo/redo while
  // Home is keep-alive cached on other routes).
  const handleUndoKeyDown = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
  };

  const registerUndoShortcuts = (): void => {
    window.addEventListener("keydown", handleUndoKeyDown);
  };

  const unregisterUndoShortcuts = (): void => {
    window.removeEventListener("keydown", handleUndoKeyDown);
  };

  return {
    showDeleteConfirm,
    archiveToDelete,
    isDeleting,
    handleToggleVisibility,
    handleEdit,
    deleteArchive,
    confirmDelete,
    cancelDelete,
    closeDeleteModal,
    createNewArchive,
    openSaveGamesFolder,
    batchDeleteArchives,
    cancelBatchDelete,
    registerUndoShortcuts,
    unregisterUndoShortcuts,
    canUndo,
    canRedo,
  };
}
