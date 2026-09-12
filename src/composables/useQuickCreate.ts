import { reactive, computed, nextTick } from "vue";
import type { ComputedRef, Reactive } from "vue";
import { useI18n } from "vue-i18n";
import {
  createDefaultUniformConfig,
  createDefaultSmartRules,
  resolve,
  hasIndividualSettings,
} from "./useConfigResolver";
import { validate } from "./useValidator";
import { parseName } from "@/utils/nameParser";
import scheduler from "@/services/resourceScheduler";
import { tauriArchiveAdapter } from "@/adapters/tauri/archiveAdapter";
import { archiveService } from "@/domain/archive/service";
import type {
  ArchiveConfig,
  UniformConfig,
  SmartRules,
  QuickCreateBatchResult,
  ValidationResult,
  ParsedNameInfo,
  ResolvedConfig,
} from "@/types";
import { formatDifficulty, loadBasicArchive, isSideStoryline, isMEGUnlocked } from "@/utils/archiveCreationUtils";
import { FEATURES } from "@/config/features";

/**
 * Batch creation configuration
 */
const BATCH_SIZE = 5; // 5 archives per batch
const BATCH_DELAY = 100; // Delay between batches (ms)

/**

/**
 * Large data threshold configuration
 * Requirements: 16.5, 17.1
 */
const LARGE_ARCHIVE_THRESHOLD = 100; // Show suggestion when exceeding this count
const VERY_LARGE_NAME_THRESHOLD = 1000; // Suggest batching when exceeding this count

/**
 * Debounce delay configuration
 * Requirements: 16.2 - 300ms debounce when uniform config changes
 */
const DEBOUNCE_DELAY = 300; // Debounce delay (ms)

interface AddResult {
  added: number;
  warnings: Array<{ type: string; count: number; threshold: number }>;
  errors: Array<{ name: string; error: string }>;
}

interface AddSingleResult {
  success: boolean;
  error?: string;
}

interface BatchProgressResult {
  success: number;
  failed: number;
  errors: Array<{ name: string; error: string }>;
  lastCreatedName: string | null;
}

interface SummaryStats {
  total: number;
  uniformCount: number;
  individualCount: number;
  missingCount: number;
}

interface LargeDataWarning {
  type: string;
  count: number;
  threshold: number;
}

interface QuickCreateState {
  archives: ArchiveConfig[];
  uniformConfig: UniformConfig;
  smartRules: SmartRules;
  selectedArchiveIds: Set<string>;
  isCreating: boolean;
  creationProgress: number;
  showTutorial: boolean;
  showIndividualEditModal: boolean;
  editingArchiveId: string | null;
}

interface DebouncedFunction {
  (...args: unknown[]): void;
  cancel: () => void;
  flush: () => void;
}

interface QuickCreateReturn {
  state: Reactive<QuickCreateState>;
  summaryStats: ComputedRef<SummaryStats>;
  canCreate: ComputedRef<boolean>;
  selectedArchives: ComputedRef<ArchiveConfig[]>;
  largeDataWarnings: ComputedRef<LargeDataWarning[]>;
  hasLargeData: ComputedRef<boolean>;
  hasVeryLargeData: ComputedRef<boolean>;
  addArchives: (names: string[]) => AddResult;
  addArchive: (name: string) => AddSingleResult;
  removeArchive: (archiveId: string) => void;
  clearArchives: () => void;
  updateArchive: (archiveId: string, updates: Partial<ArchiveConfig>) => void;
  copyArchive: (archiveId: string) => void;
  updateUniformConfig: (field: keyof UniformConfig, value: Partial<UniformConfig[keyof UniformConfig]>) => void;
  updateSmartRules: (updates: Partial<SmartRules>) => void;
  selectAll: () => void;
  invertSelection: () => void;
  toggleArchiveSelection: (archiveId: string) => void;
  batchUpdateSelected: (updates: Record<string, unknown>) => void;
  batchCreateArchives: () => Promise<QuickCreateBatchResult>;
  cancelBatchCreate: () => void;
  resetState: () => void;
  recalculateArchives: () => void;
  registerBeforeUnloadWarning: () => void;
  unregisterBeforeUnloadWarning: () => void;
  isCreationInProgress: () => boolean;
  getCreationProgress: () => number;
  LARGE_ARCHIVE_THRESHOLD: number;
  VERY_LARGE_NAME_THRESHOLD: number;
}

/**
 * Create debounce function
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
function debounce(fn: () => void, delay: number): DebouncedFunction {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn = ((..._args: unknown[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn();
      timeoutId = null;
    }, delay);
  }) as DebouncedFunction;

  // Add cancel method
  debouncedFn.cancel = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  // Add flush method
  debouncedFn.flush = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      fn();
    }
  };

  return debouncedFn;
}

/**
 * Quick create archive main state management composable
 *
 * Requirements: 15.1
 */

/**
 * Generate unique ID
 */
function generateId(): string {
  return `archive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create archive config object
 */
function createArchiveConfig(name: string): ArchiveConfig {
  const parsedInfo: ParsedNameInfo = parseName(name);

  return {
    id: generateId(),
    name: name,
    parsedInfo: parsedInfo,

    // Individual config values (null means inherit)
    level: null,
    difficulty: null,
    actualDifficulty: null,
    inventoryTemplate: null,

    // Final resolved values (computed by resolve)
    finalLevel: null,
    finalDifficulty: null,
    finalActualDifficulty: null,
    finalInventory: [],

    // State
    hasIndividualSettings: false,
    validationErrors: [],
  };
}

/**
 * Create initial state
 */
function createInitialState(): QuickCreateState {
  return {
    // Archive list
    archives: [],

    // Uniform config
    uniformConfig: createDefaultUniformConfig(),

    // Smart rules
    smartRules: createDefaultSmartRules(),

    // Selection state
    selectedArchiveIds: new Set(),

    // UI state
    isCreating: false,
    creationProgress: 0,
    showTutorial: false,
    showIndividualEditModal: false,
    editingArchiveId: null,
  };
}

/**
 * Quick create archive state management
 */
export function useQuickCreate(): QuickCreateReturn {
  const { t } = useI18n({ useScope: "global" });
  // Reactive state
  const state: Reactive<QuickCreateState> = reactive(createInitialState());

  /**
   * Rename archives whose names collide with archives already on disk, so
   * the batch never dies mid-run on the backend's overwrite guard.
   * `handleDuplicateNames` only sees in-batch names; this covers the disk.
   * Same hyphen suffix scheme, and gated behind the same smart rule.
   */
  const renameDiskCollisions = async (archives: ArchiveConfig[]): Promise<void> => {
    const metadata = await tauriArchiveAdapter.loadArchiveMetadata();
    if (!metadata.success || !metadata.data) return; // fail open — backend guard still protects

    const taken = new Set<string>();
    for (const item of metadata.data) {
      // Metadata carries full .sav filenames; only the archive-name segment
      // participates in collisions.
      const parsed = archiveService.parseArchiveName(item.name);
      taken.add(parsed ? parsed.archiveName : item.name);
    }
    // Archives in the list but not selected this run still occupy their names.
    const creatingIds = new Set(archives.map((a) => a.id));
    for (const a of state.archives) {
      if (!creatingIds.has(a.id)) taken.add(a.name);
    }

    for (const archive of archives) {
      if (!taken.has(archive.name)) {
        // Free — claim it so a later twin in the same batch gets suffixed.
        taken.add(archive.name);
        continue;
      }
      const baseName = archive.name;
      let suffix = 1;
      let finalName = `${baseName}-${suffix}`;
      while (taken.has(finalName)) {
        suffix++;
        finalName = `${baseName}-${suffix}`;
      }
      archive.name = finalName;
      archive.parsedInfo = parseName(finalName);
      taken.add(finalName);
    }
  };

  /**
   * Recalculate final configuration for all archives
   */
  const recalculateArchives = (): void => {
    for (const archive of state.archives) {
      const resolved: ResolvedConfig = resolve(archive, state.uniformConfig, state.smartRules);
      archive.finalLevel = resolved.level;
      archive.finalDifficulty = resolved.difficulty;
      archive.finalActualDifficulty = FEATURES.MERGE_DIFFICULTY ? resolved.difficulty : resolved.actualDifficulty;
      archive.finalInventory = [];
      archive.hasIndividualSettings = hasIndividualSettings(archive);
    }

    // Re-validate. Grouping messages by archive id keeps this linear; the
    // previous per-archive `.filter()` over the whole error list was O(n × m)
    // and could freeze the UI around the 1000-name batch threshold.
    const validationResult: ValidationResult = validate(state.archives);
    const messagesByArchiveId = new Map<string, string[]>();
    for (const error of validationResult.errors) {
      const messages = messagesByArchiveId.get(error.archiveId);
      if (messages) {
        messages.push(error.message);
      } else {
        messagesByArchiveId.set(error.archiveId, [error.message]);
      }
    }
    for (const archive of state.archives) {
      archive.validationErrors = messagesByArchiveId.get(archive.id) ?? [];
    }
  };

  /**
   * Debounced version of the recalculate function
   * Requirements: 16.2 - 300ms debounce when uniform config changes
   */
  const debouncedRecalculateArchives: DebouncedFunction = debounce(recalculateArchives, DEBOUNCE_DELAY);

  /**
   * Add archives
   */
  const addArchives = (names: string[]): AddResult => {
    const result: AddResult = {
      added: 0,
      warnings: [],
      errors: [],
    };

    // Filter out names containing underscores
    const validNames = names.filter((name) => {
      if (!name || !name.trim()) {
        return false;
      }
      if (name.includes("_")) {
        result.errors.push({
          name: name,
          error: "Archive name cannot contain underscores",
        });
        return false;
      }
      return true;
    });

    const newArchives: ArchiveConfig[] = validNames.map((name) => createArchiveConfig(name.trim()));

    // Check if exceeding large data threshold
    // Requirements: 17.1 - Suggest batching when exceeding 1000 names
    if (names.length > VERY_LARGE_NAME_THRESHOLD) {
      result.warnings.push({
        type: "very_large_input",
        count: names.length,
        threshold: VERY_LARGE_NAME_THRESHOLD,
      });
    }

    // Handle duplicate names
    if (state.smartRules.autoRenameDuplicates) {
      handleDuplicateNames(newArchives);
    }

    state.archives.push(...newArchives);
    result.added = newArchives.length;

    // Check if total exceeds recommended threshold
    // Requirements: 16.5 - Show suggestion when exceeding 100 archives
    if (state.archives.length > LARGE_ARCHIVE_THRESHOLD) {
      result.warnings.push({
        type: "large_archive_count",
        count: state.archives.length,
        threshold: LARGE_ARCHIVE_THRESHOLD,
      });
    }

    recalculateArchives();

    return result;
  };

  /**
   * Handle duplicate names by auto-adding suffix
   * Use hyphen(-) instead of underscore(_) to avoid filename format conflicts
   */
  const handleDuplicateNames = (newArchives: ArchiveConfig[]): void => {
    // Collect all existing names
    const existingNames: Set<string> = new Set(state.archives.map((a) => a.name));

    // Collect name counts of new archives
    const nameCount: Map<string, number> = new Map();

    for (const archive of newArchives) {
      const baseName = archive.name;
      let finalName = baseName;
      let suffix = 1;

      // Check for duplicates with existing or already-processed new names
      // Use hyphen(-) instead of underscore(_) to avoid filename format conflicts
      while (existingNames.has(finalName) || nameCount.has(finalName)) {
        finalName = `${baseName}-${suffix}`;
        suffix++;
      }

      if (finalName !== baseName) {
        archive.name = finalName;
        archive.parsedInfo = parseName(finalName);
      }

      nameCount.set(finalName, (nameCount.get(finalName) || 0) + 1);
    }
  };

  /**
   * Add a single archive
   */
  const addArchive = (name: string): AddSingleResult => {
    if (!name || !name.trim()) {
      return { success: false, error: "Archive name cannot be empty" };
    }

    const trimmedName = name.trim();

    // Check if archive name contains underscore
    if (trimmedName.includes("_")) {
      return { success: false, error: "Archive name cannot contain underscores" };
    }

    state.archives.push(createArchiveConfig(trimmedName));
    recalculateArchives();
    return { success: true };
  };

  /**
   * Remove archive
   */
  const removeArchive = (archiveId: string): void => {
    const index = state.archives.findIndex((a) => a.id === archiveId);
    if (index > -1) {
      state.archives.splice(index, 1);
      state.selectedArchiveIds.delete(archiveId);
      recalculateArchives();
    }
  };

  /**
   * Clear all archives
   */
  const clearArchives = (): void => {
    state.archives = [];
    state.selectedArchiveIds.clear();
  };

  /**
   * Update archive config
   */
  const updateArchive = (archiveId: string, updates: Partial<ArchiveConfig>): void => {
    const archive = state.archives.find((a) => a.id === archiveId);
    if (archive) {
      Object.assign(archive, updates);
      recalculateArchives();
    }
  };

  /**
   * Update uniform config
   * Requirements: 16.2 - 300ms debounce when uniform config changes
   */
  const updateUniformConfig = (field: keyof UniformConfig, value: Record<string, unknown>): void => {
    if (state.uniformConfig[field]) {
      (state.uniformConfig as Record<string, unknown>)[field] = {
        ...(state.uniformConfig[field] as Record<string, unknown>),
        ...value,
      };
      // Use debounced version of recalculate
      debouncedRecalculateArchives();
    }
  };

  /**
   * Update smart rules
   * Requirements: 16.2 - 300ms debounce when uniform config changes
   */
  const updateSmartRules = (updates: Partial<SmartRules>): void => {
    Object.assign(state.smartRules, updates);
    // Use debounced version of recalculate
    debouncedRecalculateArchives();
  };

  /**
   * Select all
   */
  const selectAll = (): void => {
    state.selectedArchiveIds = new Set(state.archives.map((a) => a.id));
  };

  /**
   * Invert selection
   */
  const invertSelection = (): void => {
    const newSelection = new Set<string>();
    for (const archive of state.archives) {
      if (!state.selectedArchiveIds.has(archive.id)) {
        newSelection.add(archive.id);
      }
    }
    state.selectedArchiveIds = newSelection;
  };

  /**
   * Toggle archive selection state
   */
  const toggleArchiveSelection = (archiveId: string): void => {
    if (state.selectedArchiveIds.has(archiveId)) {
      state.selectedArchiveIds.delete(archiveId);
    } else {
      state.selectedArchiveIds.add(archiveId);
    }
    // Trigger reactive update
    state.selectedArchiveIds = new Set(state.selectedArchiveIds);
  };

  /**
   * Batch update selected archives
   */
  const batchUpdateSelected = (updates: Record<string, unknown>): void => {
    // Index the archive list once — a per-id find() inside the loop made this
    // O(selected × archives).
    const archivesById = new Map(state.archives.map((a) => [a.id, a]));
    for (const archiveId of state.selectedArchiveIds) {
      const archive = archivesById.get(archiveId);
      if (archive) {
        // Only update fields that are not "keep original"
        for (const [key, value] of Object.entries(updates)) {
          if (value !== "__keep_original__") {
            (archive as Record<string, unknown>)[key] = value;
          }
        }
      }
    }
    recalculateArchives();
  };

  /**
   * Copy archive
   */
  const copyArchive = (archiveId: string): void => {
    const archive = state.archives.find((a) => a.id === archiveId);
    if (archive) {
      // Use hyphen(-) instead of underscore(_) to avoid filename format conflicts
      const newArchive: ArchiveConfig = {
        ...archive,
        id: generateId(),
        name: `${archive.name}-copy`,
        parsedInfo: parseName(`${archive.name}-copy`),
      };

      // Find original archive position, insert after it
      const index = state.archives.findIndex((a) => a.id === archiveId);
      state.archives.splice(index + 1, 0, newArchive);
      recalculateArchives();
    }
  };

  /**
   * Reset state
   */
  const resetState = (): void => {
    Object.assign(state, createInitialState());
  };

  // Computed property: summary statistics
  const summaryStats = computed((): SummaryStats => {
    const total = state.archives.length;
    let uniformCount = 0;
    let individualCount = 0;
    let missingCount = 0;

    for (const archive of state.archives) {
      if (archive.hasIndividualSettings) {
        individualCount++;
      } else {
        uniformCount++;
      }

      if (archive.validationErrors.length > 0) {
        missingCount++;
      }
    }

    return {
      total,
      uniformCount,
      individualCount,
      missingCount,
    };
  });

  // Computed property: whether creation is possible
  const canCreate = computed((): boolean => {
    if (state.archives.length === 0) return false;

    // Check for validation errors
    const hasErrors = state.archives.some((a) => a.validationErrors.length > 0);
    return !hasErrors;
  });

  // Computed property: selected archives
  const selectedArchives = computed((): ArchiveConfig[] => {
    return state.archives.filter((a) => state.selectedArchiveIds.has(a.id));
  });

  /**
   * Computed property: large data warnings
   * Requirements: 16.5, 17.1
   */
  const largeDataWarnings = computed((): LargeDataWarning[] => {
    const warnings: LargeDataWarning[] = [];

    // Check if archive count exceeds recommended threshold
    if (state.archives.length > LARGE_ARCHIVE_THRESHOLD) {
      warnings.push({
        type: "large_archive_count",
        count: state.archives.length,
        threshold: LARGE_ARCHIVE_THRESHOLD,
      });
    }

    return warnings;
  });

  /**
   * Computed property: whether there is large data
   * Requirements: 16.5
   */
  const hasLargeData = computed((): boolean => {
    return state.archives.length > LARGE_ARCHIVE_THRESHOLD;
  });

  /**
   * Computed property: whether there is very large data (needs batching)
   * Requirements: 17.1
   */
  const hasVeryLargeData = computed((): boolean => {
    return state.archives.length > VERY_LARGE_NAME_THRESHOLD;
  });
  /**
   * Create a single archive
   */
  const createSingleArchive = async (
    archive: ArchiveConfig,
    basicArchive: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const level = archive.finalLevel || "Level0";

      // Build save data
      const saveData: Parameters<typeof tauriArchiveAdapter.createArchive>[0] = {
        archiveName: archive.name,
        level: level,
        gameMode: "multiplayer", // Always set to multiplayer mode
        difficulty: formatDifficulty(archive.finalDifficulty),
        actualDifficulty: formatDifficulty(archive.finalActualDifficulty),
        players: [], // Empty player list, expandable later
        basicArchive: basicArchive,
        mainEnding: isSideStoryline(level),
        megUnlocked: isMEGUnlocked(level),
      };

      const result = await tauriArchiveAdapter.createArchive(saveData);
      if (!result.success) {
        // Translate the backend's duplicate-name rejection into a localized,
        // readable message instead of surfacing the raw English error.
        if (result.errorType === "duplicate_name") {
          throw new Error(t("createArchive.nameTakenConflict", { name: archive.name }));
        }
        throw new Error(result.error || "Failed to create archive");
      }
      return { success: true };
    } catch (error) {
      console.error(`Failed to create archive "${archive.name}":`, error);
      return { success: false, error: (error as Error).message || String(error) };
    }
  };

  // AbortController for batch creation — lets the UI cancel a long batch
  let batchCreateAbortController: AbortController | null = null;

  /** Cancel an in-flight batch creation. No-op if none is running. */
  const cancelBatchCreate = (): void => {
    if (batchCreateAbortController) {
      batchCreateAbortController.abort();
      batchCreateAbortController = null;
    }
  };

  /**
   * Batch create archives
   * Requirements: 14.1, 14.2, 14.3, 17.3
   *
   * Note: If creation is interrupted (e.g., browser closed), already created archives
   * are NOT rolled back. This is by design per Requirement 17.3.
   */
  const batchCreateArchives = async (): Promise<QuickCreateBatchResult> => {
    // Get the list of archives to create (selected or all)
    const archivesToCreate: ArchiveConfig[] =
      state.selectedArchiveIds.size > 0
        ? state.archives.filter((a) => state.selectedArchiveIds.has(a.id))
        : state.archives;

    if (archivesToCreate.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }

    // Report batch-creating operation to resource scheduler
    scheduler.beginOperation("batch-creating", {
      totalItems: archivesToCreate.length,
      completedItems: 0,
    });

    // Load basic archive template
    const basicArchive = await loadBasicArchive();
    if (!basicArchive) {
      // Early return must still end the scheduler operation, otherwise the
      // critical "batch-creating" op leaks for the whole session.
      scheduler.endOperation("batch-creating");
      return {
        success: 0,
        failed: archivesToCreate.length,
        errors: [{ name: "all", error: "Failed to load archive template" }],
      };
    }

    // Set creating state
    state.isCreating = true;
    state.creationProgress = 0;
    const abortController = new AbortController();
    batchCreateAbortController = abortController;

    // Resolve name collisions against archives already on disk (same smart
    // rule as in-batch duplicates) so the run never fails halfway on the
    // backend's duplicate-name guard.
    if (state.smartRules.autoRenameDuplicates) {
      await renameDiskCollisions(archivesToCreate);
      // Names may have changed — refresh validation state and the preview list.
      recalculateArchives();
    }

    const results: BatchProgressResult = {
      success: 0,
      failed: 0,
      errors: [],
      lastCreatedName: null, // Record the name of the last successfully created archive
    };

    // Create in batches
    for (let i = 0; i < archivesToCreate.length; i += BATCH_SIZE) {
      // Allow cancellation between batches
      if (abortController.signal.aborted) {
        results.failed += archivesToCreate.length - i;
        break;
      }
      const batch = archivesToCreate.slice(i, i + BATCH_SIZE);

      // Create current batch in parallel
      const batchResults = await Promise.allSettled(batch.map((archive) => createSingleArchive(archive, basicArchive)));

      // Process batch results
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const archive = batch[j];

        if (result.status === "fulfilled" && result.value.success) {
          results.success++;
          results.lastCreatedName = archive.name; // Record the name of the last successfully created archive
        } else {
          results.failed++;
          const errorMsg =
            result.status === "rejected"
              ? (result.reason as Error)?.message || String(result.reason)
              : result.value?.error || "Unknown error";
          results.errors.push({ name: archive.name, error: errorMsg });
        }
      }

      // Update progress
      const completed = Math.min(i + BATCH_SIZE, archivesToCreate.length);
      state.creationProgress = (completed / archivesToCreate.length) * 100;

      // Report progress to resource scheduler
      scheduler.updateOperation("batch-creating", {
        totalItems: archivesToCreate.length,
        completedItems: completed,
      });

      // Give UI time to update
      await nextTick();

      // Delay between batches
      if (i + BATCH_SIZE < archivesToCreate.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
      }
    }

    // Finish creation
    state.creationProgress = 100;
    state.isCreating = false;
    batchCreateAbortController = null;
    scheduler.endOperation("batch-creating");

    return results;
  };

  // ==================== Interruption Handling ====================

  /**
   * beforeunload event handler reference
   */
  let beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | null = null;

  /**
   * Register beforeunload warning
   * Requirements: 17.2 - Warn user when browser closes
   */
  const registerBeforeUnloadWarning = (): void => {
    if (beforeUnloadHandler) return; // Already registered

    beforeUnloadHandler = (event: BeforeUnloadEvent): void => {
      // Only warn during creation or when there are unsaved archives
      if (state.isCreating || state.archives.length > 0) {
        event.preventDefault();
        // Modern browsers ignore custom messages, but returnValue still needs to be set
        event.returnValue = "";
        return;
      }
    };

    window.addEventListener("beforeunload", beforeUnloadHandler);
  };

  /**
   * Unregister beforeunload warning
   */
  const unregisterBeforeUnloadWarning = (): void => {
    if (beforeUnloadHandler) {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      beforeUnloadHandler = null;
    }
  };

  /**
   * Check if creation is in progress
   */
  const isCreationInProgress = (): boolean => {
    return state.isCreating;
  };

  /**
   * Get creation progress
   */
  const getCreationProgress = (): number => {
    return state.creationProgress;
  };

  return {
    // State
    state,

    // Computed properties
    summaryStats,
    canCreate,
    selectedArchives,
    largeDataWarnings,
    hasLargeData,
    hasVeryLargeData,

    // Archive operations
    addArchives,
    addArchive,
    removeArchive,
    clearArchives,
    updateArchive,
    copyArchive,

    // Config operations
    updateUniformConfig,
    updateSmartRules,

    // Selection operations
    selectAll,
    invertSelection,
    toggleArchiveSelection,
    batchUpdateSelected,

    // Batch creation
    batchCreateArchives,
    cancelBatchCreate,

    // State management
    resetState,
    recalculateArchives,

    // Interruption handling
    registerBeforeUnloadWarning,
    unregisterBeforeUnloadWarning,
    isCreationInProgress,
    getCreationProgress,

    // Threshold constants (for external use)
    LARGE_ARCHIVE_THRESHOLD,
    VERY_LARGE_NAME_THRESHOLD,
  };
}
