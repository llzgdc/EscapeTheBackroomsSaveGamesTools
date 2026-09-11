import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { tauriArchiveAdapter } from "@/adapters/tauri/archiveAdapter";
import { useToast } from "./useToast";
import type { RestoreTrashOutcome, TrashedArchive } from "@/domain/archive/models";

interface EmptyTrashResults {
  success: number;
  failed: number;
}

/**
 * Stateful logic for the recycle-bin page: listing soft-deleted archives,
 * restoring them (with same-name conflict detection delegated to the caller
 * via the returned outcome), permanent deletion, and emptying the bin.
 *
 * All backend calls are addressed by `originalPath` — the `.sav` location
 * the archive would return to — because the backend recomputes the trash
 * location from it.
 */
export function useTrashArchive() {
  const { t } = useI18n({ useScope: "global" });
  const toast = useToast();

  const trashedArchives = ref<TrashedArchive[]>([]);
  const loading = ref(false);

  // originalPath of the archive with a restore/delete currently in flight.
  // Guards double-clicks without freezing the whole grid.
  const mutatingPath = ref<string | null>(null);
  const isEmptying = ref(false);
  // Progress of an "empty bin" run, shown while isEmptying.
  const emptyProgress = ref({ current: 0, total: 0 });

  /** Remove an archive from the local list by stable original path. */
  const removeFromList = (originalPath: string): void => {
    const normalized = originalPath.toLowerCase();
    const index = trashedArchives.value.findIndex((a) => a.originalPath.toLowerCase() === normalized);
    if (index !== -1) {
      trashedArchives.value.splice(index, 1);
    }
  };

  const loadTrash = async (): Promise<void> => {
    loading.value = true;
    try {
      const result = await tauriArchiveAdapter.loadTrashedArchives();
      if (result.success) {
        trashedArchives.value = result.data ?? [];
      } else {
        toast.showError(t("trash.loadFailed"));
      }
    } finally {
      loading.value = false;
    }
  };

  /**
   * Restore one archive. Never throws; the outcome tells the caller whether
   * to offer an overwrite confirmation (a live archive with the same name
   * exists) or surface a generic error (already toasted here).
   */
  const restoreArchive = async (item: TrashedArchive, overwrite = false): Promise<RestoreTrashOutcome> => {
    if (mutatingPath.value) return { status: "error", message: "busy" };
    mutatingPath.value = item.originalPath;
    try {
      const result = await tauriArchiveAdapter.restoreArchive(item.originalPath, overwrite);
      if (result.success) {
        removeFromList(item.originalPath);
        toast.showSuccess(t("trash.restore.success", { name: item.name }));
        return { status: "success" };
      }
      if (result.errorType === "duplicate_name") {
        return { status: "conflict", archiveName: item.name };
      }
      toast.showError(t("trash.restore.failed", { name: item.name }));
      return { status: "error", message: result.error ?? "unknown" };
    } finally {
      mutatingPath.value = null;
    }
  };

  /** Permanently delete one archive. Returns whether it succeeded (toasts on failure). */
  const permanentDeleteArchive = async (item: TrashedArchive): Promise<boolean> => {
    if (mutatingPath.value) return false;
    mutatingPath.value = item.originalPath;
    try {
      const result = await tauriArchiveAdapter.permanentDeleteArchive(item.originalPath);
      if (result.success) {
        removeFromList(item.originalPath);
        toast.showSuccess(t("trash.delete.success", { name: item.name }));
        return true;
      }
      toast.showError(t("trash.delete.failed", { name: item.name }));
      return false;
    } finally {
      mutatingPath.value = null;
    }
  };

  /**
   * Permanently delete every archive currently in the bin. The list is
   * snapshotted first so entries restored/deleted mid-run cannot desync the
   * loop; failed entries stay in the list for a retry.
   */
  const emptyTrash = async (): Promise<EmptyTrashResults> => {
    if (isEmptying.value) return { success: 0, failed: 0 };
    isEmptying.value = true;

    const snapshot = [...trashedArchives.value];
    emptyProgress.value = { current: 0, total: snapshot.length };
    const results: EmptyTrashResults = { success: 0, failed: 0 };

    for (const item of snapshot) {
      emptyProgress.value.current += 1;
      try {
        const result = await tauriArchiveAdapter.permanentDeleteArchive(item.originalPath);
        if (result.success) {
          removeFromList(item.originalPath);
          results.success += 1;
        } else {
          results.failed += 1;
        }
      } catch {
        results.failed += 1;
      }
    }

    isEmptying.value = false;

    if (results.failed === 0) {
      toast.showSuccess(t("trash.emptyTrashConfirm.success", { count: results.success }));
    } else {
      toast.showError(
        t("trash.emptyTrashConfirm.partialFailed", { success: results.success, failed: results.failed }),
      );
    }

    return results;
  };

  return {
    trashedArchives,
    loading,
    mutatingPath,
    isEmptying,
    emptyProgress,
    loadTrash,
    restoreArchive,
    permanentDeleteArchive,
    emptyTrash,
  };
}
