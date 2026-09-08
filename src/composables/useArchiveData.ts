import { ref, computed, type Ref, type ComputedRef } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useI18n } from "vue-i18n";
import { useToast } from "./useToast";
import type { ArchiveData } from "@/types";
import { preloadImage } from "@/utils/imagePreloader";
import { getLevelImage } from "@/utils/levelUtils";
import scheduler from "@/services/resourceScheduler";
import { FEATURES } from "@/config/features";

interface RawSaveItem {
  id?: number;
  name?: string;
  display_name?: string | null;
  current_level?: string;
  mode?: string;
  difficulty?: string;
  actual_difficulty?: string;
  is_visible?: boolean;
  path?: string;
  date?: string;
}

interface SaveFileMeta {
  id: number;
  name: string;
  display_name?: string | null;
  difficulty: string;
  mode: string;
  date: string;
  hidden: boolean;
  path: string;
  is_visible: boolean;
  file_size: number;
}

interface SaveFileDetail {
  path: string;
  current_level: string;
  actual_difficulty: string;
}

interface FileHandleResponse {
  success: boolean;
  data?: {
    SingleplayerSaves?: string[];
  };
}

/** Mirrors the Rust `MainsaveStatus` probe. When `readable` is false the
 *  list still loads, but visibility info is unavailable (everything shows
 *  as hidden) and registry writes fail — the UI surfaces a banner. */
interface MainsaveStatus {
  missing: boolean;
  readable: boolean;
  error: string | null;
}

interface ArchiveStats {
  total: number;
  visible: number;
  hidden: number;
}

export interface IncrementalLoadState {
  phase: "idle" | "metadata" | "details" | "complete";
  totalDetails: number;
  loadedDetails: number;
}

const BATCH_SIZE = 50;

/**
 * Archive data management composable
 * Supports two-phase incremental loading for fast initial display:
 *   Phase 1 (metadata) — filename + filesystem only, no .sav parsing
 *   Phase 2 (details)  — batch-parses .sav files to fill currentLevel & actualDifficulty
 *
 * Data loading uses infinite scroll: first PAGE_SIZE items are loaded on init,
 * more items are appended on demand via loadMoreArchives().  Items are always
 * sorted by archive name to ensure consistent ordering across pages.
 */
export function useArchiveData(): {
  archives: Ref<ArchiveData[]>;
  visibleSaves: Ref<Set<string>>;
  loading: Ref<boolean>;
  dataLoadComplete: Ref<boolean>;
  archiveStats: ComputedRef<ArchiveStats>;
  incrementalLoadState: Ref<IncrementalLoadState>;
  mainsaveStatus: Ref<MainsaveStatus | null>;
  loadVisibleSaves: () => Promise<void>;
  loadRealArchives: () => Promise<ArchiveData[]>;
  initializeArchives: (silent?: boolean) => Promise<void>;
  refreshArchives: () => Promise<void>;
  refreshArchivesSilent: () => Promise<void>;
  removeArchive: (archiveId: number) => void;
  updateArchiveVisibility: (archiveId: number, isVisible: boolean, path?: string) => void;
} {
  const { t } = useI18n({ useScope: "global" });
  const toast = useToast();
  const archives = ref<ArchiveData[]>([]);
  const visibleSaves = ref(new Set<string>());
  const mainsaveStatus = ref<MainsaveStatus | null>(null);

  const loading = ref(false);
  const dataLoadComplete = ref(false);
  const incrementalLoadState = ref<IncrementalLoadState>({
    phase: "idle",
    totalDetails: 0,
    loadedDetails: 0,
  });

  // Cancellation token for detail loading.
  // Set to true by cancelDetailLoading() — loadDetailsIntoArray checks this
  // before each batch and exits early, preventing wasted IPC and stale data
  // writes when refresh/init races with an in-flight detail load.
  let detailLoadCancelled = false;

  // Map Chinese difficulty names from game save files to normalized keys
  const difficultyMap: Record<string, string> = {
    简单难度: "easy",
    普通难度: "normal",
    困难难度: "hard",
    噩梦难度: "nightmare",
  };

  // Map Chinese mode names from game save files to normalized keys
  // All modes now map to "multiplayer" for unified archive handling
  const modeMap: Record<string, string> = {
    单人模式: "multiplayer",
    多人模式: "multiplayer",
  };

  const mapArchive = (item: RawSaveItem): ArchiveData => {
    // Always resolve to "multiplayer" for unified archive handling
    // Requirements 2.2: All modes map to "multiplayer"
    const gameMode = modeMap[item.mode!] || "multiplayer";

    return {
      id: item.id ?? 0,
      name: item.name ?? t("archiveCard.untitled", "Untitled Archive"),
      displayName: item.display_name ?? null,
      currentLevel: item.current_level ?? "Level0",
      gameMode,
      archiveDifficulty: difficultyMap[item.difficulty!] || item.difficulty?.toLowerCase() || "normal",
      actualDifficulty: FEATURES.MERGE_DIFFICULTY
        ? difficultyMap[item.difficulty!] || item.difficulty?.toLowerCase() || "normal"
        : difficultyMap[item.actual_difficulty!] || item.actual_difficulty?.toLowerCase() || "normal",
      isVisible: item.is_visible === true,
      path: item.path ?? "",
      date: item.date ?? new Date().toISOString(),
    };
  };

  /** Map SaveFileMeta (from Rust, no .sav parsing) to ArchiveData.
   *  Uses "Level0" as safe default for currentLevel so the background
   *  image URL is valid from the start. Phase 2 will overwrite it. */
  const mapMetaToArchive = (meta: SaveFileMeta): ArchiveData => {
    // Always resolve to "multiplayer" for unified archive handling
    // Requirements 2.2: All modes map to "multiplayer"
    const gameMode = modeMap[meta.mode] || "multiplayer";
    const diff = difficultyMap[meta.difficulty] || meta.difficulty?.toLowerCase() || "normal";
    return {
      id: meta.id,
      name: meta.name,
      displayName: meta.display_name ?? null,
      currentLevel: "Level0",
      gameMode,
      archiveDifficulty: diff,
      actualDifficulty: diff,
      isVisible: meta.is_visible,
      path: meta.path,
      date: meta.date,
    };
  };

  const loadVisibleSaves = async (): Promise<void> => {
    try {
      const response = await invoke<FileHandleResponse>("handle_file", {
        action: "read",
        filePath: "MAINSAVE.sav",
      });

      if (response && response.success && response.data) {
        const singleplayerSaves = response.data.SingleplayerSaves || [];
        visibleSaves.value = new Set(singleplayerSaves);
      } else {
        visibleSaves.value = new Set();
      }
    } catch (error) {
      console.error("Failed to load visible saves:", error);
      visibleSaves.value = new Set();
    }
  };

  const loadRealArchives = async (): Promise<ArchiveData[]> => {
    try {
      const response = await invoke<RawSaveItem[]>("load_all_saves");

      if (response && Array.isArray(response)) {
        return response.map(mapArchive);
      }
      return [];
    } catch (error) {
      console.error("Failed to load archives:", error);
      const errorMessage =
        (error as { message?: string; msg?: string })?.message ||
        (error as { msg?: string })?.msg ||
        JSON.stringify(error) ||
        t("common.unknown");
      if (errorMessage.includes("Save directory not found")) {
        toast.showError(
          t("archiveCard.saveDirNotFound", "Please open the game first to initialize the save directory"),
        );
      } else {
        toast.showError(t("archiveCard.loadFailed", "Failed to load archives") + ": " + errorMessage);
      }
      return [];
    }
  };

  /** Phase 1: Load ALL metadata from filenames only (no .sav parsing),
   *  then sort by name for consistent ordering.  Fast even for 1000+ files.
   *  Errors propagate: a transient backend failure must NEVER surface as an
   *  empty list — callers keep their current data when this rejects. */
  const loadMetadata = async (): Promise<ArchiveData[]> => {
    const metaList = await invoke<SaveFileMeta[]>("load_save_metadata");
    if (Array.isArray(metaList)) {
      return metaList.map(mapMetaToArchive).sort((a, b) => a.name.localeCompare(b.name));
    }
    // Non-array response indicates a backend error — propagate so callers
    // can show an error state instead of an empty list.
    throw new Error("Backend returned non-array response for save metadata");
  };

  /**
   * Load .sav detail data (currentLevel, actualDifficulty) into the given
   * archives array by mutating items in-place.  Loads in batches with
   * cancellation support via detailLoadCancelled.
   * Shared between initializeArchives and refreshArchives to pre-load
   * real data before the atomic UI swap (no default-value flash).
   */
  const loadDetailsIntoArray = async (targetArchives: ArchiveData[]): Promise<void> => {
    const pendingPaths = targetArchives.filter((a) => a.currentLevel === "Level0").map((a) => a.path);
    if (pendingPaths.length === 0) return;

    for (let i = 0; i < pendingPaths.length; i += BATCH_SIZE) {
      if (detailLoadCancelled) return;
      const batch = pendingPaths.slice(i, i + BATCH_SIZE);
      try {
        const details = await invoke<SaveFileDetail[]>("load_save_details_batch", { paths: batch });
        if (detailLoadCancelled) return;

        for (const detail of details) {
          if (detail.current_level) {
            preloadImage(getLevelImage(detail.current_level));
          }
        }

        for (const detail of details) {
          const idx = targetArchives.findIndex((a) => a.path === detail.path);
          if (idx !== -1) {
            const target = targetArchives[idx];
            target.currentLevel = detail.current_level;
            if (detail.actual_difficulty) {
              target.actualDifficulty =
                difficultyMap[detail.actual_difficulty] ||
                detail.actual_difficulty?.toLowerCase() ||
                target.actualDifficulty;
              if (FEATURES.MERGE_DIFFICULTY) {
                target.archiveDifficulty = target.actualDifficulty;
              }
            }
          }
        }

        // Track progress only when mutating the live archives ref
        if (targetArchives === archives.value) {
          incrementalLoadState.value.loadedDetails += batch.length;
          scheduler.updateOperation("loading-archives", {
            totalItems: pendingPaths.length,
            completedItems: incrementalLoadState.value.loadedDetails,
          });
        }
      } catch (error) {
        console.error(`Failed to load detail batch (${i}–${i + batch.length}):`, error);
      }
    }
  };

  const cancelDetailLoading = (): void => {
    detailLoadCancelled = true;
    incrementalLoadState.value = {
      phase: "idle",
      totalDetails: 0,
      loadedDetails: 0,
    };
  };

  /** Probe MAINSAVE registry health for the degraded-state banner.
   *  Never throws — an unknown state (probe itself failed) shows no banner
   *  rather than a possibly-wrong warning. */
  const checkMainsaveStatus = async (): Promise<void> => {
    try {
      mainsaveStatus.value = await invoke<MainsaveStatus>("get_mainsave_status");
    } catch (error) {
      console.error("Failed to probe MAINSAVE status:", error);
      mainsaveStatus.value = null;
    }
  };

  /** Load ALL metadata (instant, filename-only), load visible saves,
   *  then kick off Phase 2 detail loading in the background. */
  const loadMergedArchives = async (): Promise<ArchiveData[]> => {
    const [, metaArchives] = await Promise.all([loadVisibleSaves(), loadMetadata(), checkMainsaveStatus()]);
    return metaArchives;
  };

  // Monotonic token identifying the newest archive load. An older refresh that
  // snapshotted PRE-operation disk state must never finish last and overwrite
  // newer data (that resurrected deleted archives and reverted toggles).
  let refreshGeneration = 0;

  const initializeArchives = async (silent = false): Promise<void> => {
    cancelDetailLoading();
    const loadGeneration = ++refreshGeneration;

    if (!silent) {
      loading.value = true;
      archives.value = [];
      dataLoadComplete.value = false;
    }

    // Report loading operation to resource scheduler
    scheduler.beginOperation("loading-archives", {
      totalItems: 0,
      completedItems: 0,
    });

    try {
      incrementalLoadState.value = { phase: "metadata", totalDetails: 0, loadedDetails: 0 };

      // Phase 1: ALL metadata (filename-only, instant).  No pagination needed —
      // this is faster than IPC round-trips for individual pages.
      const merged = await loadMergedArchives();

      // Pre-load all .sav details into the local copy BEFORE swapping,
      // so the UI never sees intermediate Level0 placeholder images/text.
      const pendingCount = merged.filter((a) => a.currentLevel === "Level0").length;
      if (pendingCount > 0) {
        detailLoadCancelled = false;
        incrementalLoadState.value = { phase: "details", totalDetails: pendingCount, loadedDetails: 0 };
        await loadDetailsIntoArray(merged);
      }

      if (detailLoadCancelled || loadGeneration !== refreshGeneration) {
        // A newer load superseded this one — never swap stale data in.
        scheduler.endOperation("loading-archives");
        return;
      }

      // Atomic swap: old data → new complete data in one re-render.
      // Cards now render directly with real data — no default-value flash.
      archives.value = merged;
      dataLoadComplete.value = true;
      incrementalLoadState.value = { phase: "complete", totalDetails: 0, loadedDetails: 0 };
      scheduler.endOperation("loading-archives");
    } catch (error) {
      console.error("Failed to initialize archives:", error);
      if (!silent) {
        archives.value = [];
        // Surface the failure — an empty list must never masquerade as
        // "no archives exist".
        const errorMessage = (error as { message?: string })?.message || String(error);
        toast.showError(t("archiveCard.loadFailed", "Failed to load archives") + ": " + errorMessage);
      }
      dataLoadComplete.value = true;
      incrementalLoadState.value = { phase: "complete", totalDetails: 0, loadedDetails: 0 };
      scheduler.endOperation("loading-archives");
    } finally {
      if (!silent) {
        setTimeout(() => {
          loading.value = false;
        }, 300);
      }
    }
  };

  const refreshArchives = async (): Promise<void> => {
    loading.value = true;
    cancelDetailLoading();
    const loadGeneration = ++refreshGeneration;
    scheduler.beginOperation("loading-archives", { totalItems: 0, completedItems: 0 });

    try {
      const merged = await loadMergedArchives();

      // Pre-load all .sav details into the local copy BEFORE swapping,
      // so the UI never sees intermediate Level0 placeholder images/text.
      const pendingCount = merged.filter((a) => a.currentLevel === "Level0").length;
      if (pendingCount > 0) {
        detailLoadCancelled = false;
        await loadDetailsIntoArray(merged);
      }

      if (loadGeneration !== refreshGeneration) {
        // A newer load superseded this one — never swap stale data in.
        scheduler.endOperation("loading-archives");
        return;
      }

      // Atomic swap: old data → new complete data in one re-render
      archives.value = merged;
      scheduler.endOperation("loading-archives");
    } catch (error) {
      console.error("Failed to refresh archives:", error);
      scheduler.endOperation("loading-archives");
    } finally {
      setTimeout(() => {
        loading.value = false;
      }, 300);
    }
  };

  const refreshArchivesSilent = async (): Promise<void> => {
    const loadGeneration = ++refreshGeneration;
    scheduler.beginOperation("loading-archives", { totalItems: 0, completedItems: 0 });
    try {
      const merged = await loadMergedArchives();

      // Pre-load all .sav details before swapping — same as refreshArchives
      // to avoid Level0 placeholder flicker.
      const pendingCount = merged.filter((a) => a.currentLevel === "Level0").length;
      if (pendingCount > 0) {
        detailLoadCancelled = false;
        await loadDetailsIntoArray(merged);
      }

      if (loadGeneration !== refreshGeneration) {
        // A newer load superseded this one — never swap stale data in.
        scheduler.endOperation("loading-archives");
        return;
      }

      archives.value = merged;
      scheduler.endOperation("loading-archives");
    } catch (error) {
      console.error("Failed to refresh archives silently:", error);
      scheduler.endOperation("loading-archives");
    }
  };

  const removeArchive = (archiveId: number): void => {
    const index = archives.value.findIndex((a) => a.id === archiveId);
    if (index > -1) {
      archives.value.splice(index, 1);
    }
  };

  const updateArchiveVisibility = (archiveId: number, isVisible: boolean, path?: string): void => {
    // The stable file path is checked FIRST: ids are enumeration indices that
    // shift after a refresh and can collide with an unrelated archive — an
    // id-first match could flip visibility on the wrong card.
    let archiveIndex = -1;
    if (path) {
      const normalized = path.toLowerCase();
      archiveIndex = archives.value.findIndex((a) => a.path && a.path.toLowerCase() === normalized);
    }
    if (archiveIndex === -1) {
      archiveIndex = archives.value.findIndex((a) => a.id === archiveId);
    }
    if (archiveIndex > -1) {
      archives.value[archiveIndex].isVisible = isVisible;
    }
  };

  const archiveStats = computed((): ArchiveStats => ({
    total: archives.value.length,
    visible: archives.value.filter((a) => a.isVisible).length,
    hidden: archives.value.filter((a) => !a.isVisible).length,
  }));

  return {
    archives,
    visibleSaves,
    loading,
    dataLoadComplete,
    archiveStats,
    incrementalLoadState,
    mainsaveStatus,
    loadVisibleSaves,
    loadRealArchives,
    initializeArchives,
    refreshArchives,
    refreshArchivesSilent,
    removeArchive,
    updateArchiveVisibility,
  };
}
