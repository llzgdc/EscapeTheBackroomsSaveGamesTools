/**
 * Tauri Archive Adapter
 * Adapts Tauri IPC calls to domain service interface
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  Archive,
  ArchiveMetadata,
  ArchiveDetail,
  ArchiveNameAvailability,
  CreateArchiveOptions,
  TrashedArchive,
} from "@/domain/archive/models";
import type { ArchiveServiceResult } from "@/domain/archive/service";
import { detectDuplicateNameError } from "@/domain/archive/nameConflict";

/**
 * Extract a readable message from a Tauri invoke rejection.
 * Rust `AppError` serializes as a plain `{type, message}` object, so
 * `String(error)` would only yield "[object Object]".
 */
function normalizeInvokeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const e = error as { message?: unknown; msg?: unknown };
    if (typeof e.message === "string") return e.message;
    if (typeof e.msg === "string") return e.msg;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

/**
 * Archive adapter for Tauri backend
 */

/**
 * Wire formats exactly as serialized by the Rust structs in
 * `save_utils.rs`. They derive plain `Serialize` (no `rename_all`),
 * so field names arrive in snake_case and must be mapped into the
 * camelCase domain models below.
 */
interface RustSaveFileInfo {
  id: number;
  name: string;
  display_name?: string | null;
  difficulty: string;
  difficulty_class?: string;
  actual_difficulty: string;
  mode: string;
  date: string;
  current_level: string;
  hidden: boolean;
  path: string;
  is_visible?: boolean | null;
}

interface RustSaveFileMeta {
  id: number;
  name: string;
  display_name?: string | null;
  difficulty: string;
  mode: string;
  date: string;
  hidden: boolean;
  path: string;
  is_visible?: boolean | null;
  file_size: number;
}

interface RustSaveFileMetaPage {
  items: RustSaveFileMeta[];
  total: number;
  offset: number;
  has_more: boolean;
}

interface RustSaveFileDetail {
  path: string;
  current_level: string;
  actual_difficulty?: string | null;
}

function toArchive(item: RustSaveFileInfo): Archive {
  return {
    id: item.id,
    name: item.name,
    displayName: item.display_name ?? null,
    difficulty: item.difficulty,
    actualDifficulty: item.actual_difficulty,
    mode: item.mode,
    date: item.date,
    currentLevel: item.current_level,
    hidden: item.hidden,
    path: item.path,
    isVisible: item.is_visible === true,
  };
}

function toArchiveMetadata(meta: RustSaveFileMeta): ArchiveMetadata {
  return {
    id: meta.id,
    name: meta.name,
    displayName: meta.display_name ?? null,
    difficulty: meta.difficulty,
    mode: meta.mode,
    date: meta.date,
    hidden: meta.hidden,
    path: meta.path,
    isVisible: meta.is_visible === true,
    fileSize: meta.file_size,
  };
}

function toArchiveDetail(detail: RustSaveFileDetail): ArchiveDetail {
  return {
    path: detail.path,
    currentLevel: detail.current_level,
    actualDifficulty: detail.actual_difficulty ?? "",
  };
}

/**
 * Wire format of `list_trash_archives` (Rust `TrashFileMeta`, plain
 * `Serialize` → snake_case on the wire).
 */
interface RustTrashFileMeta {
  id: number;
  name: string;
  difficulty: string;
  mode: string;
  date: string;
  path: string;
  original_path: string;
  file_size: number;
}

function toTrashedArchive(meta: RustTrashFileMeta): TrashedArchive {
  return {
    id: meta.id,
    name: meta.name,
    difficulty: meta.difficulty,
    mode: meta.mode,
    date: meta.date,
    path: meta.path,
    originalPath: meta.original_path,
    fileSize: meta.file_size,
  };
}

export class TauriArchiveAdapter {
  /**
   * Load all archives with full details
   */
  async loadAllArchives(): Promise<ArchiveServiceResult<Archive[]>> {
    try {
      const archives = await invoke<RustSaveFileInfo[]>("load_all_saves");
      return { success: true, data: archives.map(toArchive) };
    } catch (error) {
      return {
        success: false,
        error: normalizeInvokeError(error),
      };
    }
  }

  /**
   * Load archive metadata only (no .sav parsing)
   */
  async loadArchiveMetadata(): Promise<ArchiveServiceResult<ArchiveMetadata[]>> {
    try {
      const metadata = await invoke<RustSaveFileMeta[]>("load_save_metadata");
      return { success: true, data: metadata.map(toArchiveMetadata) };
    } catch (error) {
      return {
        success: false,
        error: normalizeInvokeError(error),
      };
    }
  }

  /**
   * Load archive metadata page for pagination
   */
  async loadArchiveMetadataPage(
    offset: number,
    limit: number,
  ): Promise<ArchiveServiceResult<{ items: ArchiveMetadata[]; total: number; hasMore: boolean }>> {
    try {
      const page = await invoke<RustSaveFileMetaPage>("load_save_metadata_page", { offset, limit });
      return {
        success: true,
        data: { items: page.items.map(toArchiveMetadata), total: page.total, hasMore: page.has_more },
      };
    } catch (error) {
      return {
        success: false,
        error: normalizeInvokeError(error),
      };
    }
  }

  /**
   * Load archive details in batch
   */
  async loadArchiveDetailsBatch(paths: string[]): Promise<ArchiveServiceResult<ArchiveDetail[]>> {
    try {
      const details = await invoke<RustSaveFileDetail[]>("load_save_details_batch", { paths });
      return { success: true, data: details.map(toArchiveDetail) };
    } catch (error) {
      return {
        success: false,
        error: normalizeInvokeError(error),
      };
    }
  }

  /**
   * Delete archive permanently
   */
  async deleteArchive(filePath: string): Promise<ArchiveServiceResult<void>> {
    try {
      await invoke("delete_file", { filePath });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: normalizeInvokeError(error),
      };
    }
  }

  /**
   * Soft delete archive (move to trash)
   */
  async softDeleteArchive(filePath: string): Promise<ArchiveServiceResult<void>> {
    try {
      await invoke("soft_delete_file", { filePath });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: normalizeInvokeError(error),
      };
    }
  }

  /**
   * Restore soft-deleted archive. Refuses (typed `duplicate_name` rejection)
   * when a live archive with the same name exists, unless `overwrite` is set.
   */
  async restoreArchive(filePath: string, overwrite = false): Promise<ArchiveServiceResult<void>> {
    try {
      await invoke("restore_file", { filePath, overwrite });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: normalizeInvokeError(error),
        errorType: detectDuplicateNameError(error) ? "duplicate_name" : undefined,
      };
    }
  }

  /**
   * List all soft-deleted archives in the recycle bin
   */
  async loadTrashedArchives(): Promise<ArchiveServiceResult<TrashedArchive[]>> {
    try {
      const metas = await invoke<RustTrashFileMeta[]>("list_trash_archives");
      return { success: true, data: metas.map(toTrashedArchive) };
    } catch (error) {
      return {
        success: false,
        error: normalizeInvokeError(error),
      };
    }
  }

  /**
   * Permanently delete trashed archive
   */
  async permanentDeleteArchive(filePath: string): Promise<ArchiveServiceResult<void>> {
    try {
      await invoke("permanent_delete_file", { filePath });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: normalizeInvokeError(error),
      };
    }
  }

  /**
   * Toggle archive visibility.
   * Pass `visible` to pin the desired state (idempotent, race-free);
   * omit it to flip relative to the current state.
   * Returns the VERIFIED end state reported by the backend so callers can
   * reconcile their UI against what is actually on disk.
   */
  async toggleArchiveVisibility(
    filePath: string,
    archiveName: string,
    visible?: boolean,
  ): Promise<ArchiveServiceResult<{ isVisible: boolean }>> {
    try {
      const raw = await invoke<string>("handle_file", {
        filePath,
        action: "toggle_visibility",
        archiveName,
        visible: visible ?? null,
      });

      // The backend answers with a JSON string: {success, isVisible}.
      // "Invoke resolved" alone proves nothing — inspect the payload.
      let parsed: { success?: boolean; isVisible?: boolean } = {};
      try {
        parsed = JSON.parse(raw) as { success?: boolean; isVisible?: boolean };
      } catch {
        return { success: false, error: "Malformed response from backend" };
      }
      if (parsed.success === false) {
        return { success: false, error: "Backend reported toggle failure" };
      }
      return { success: true, data: { isVisible: parsed.isVisible === true } };
    } catch (error) {
      return { success: false, error: normalizeInvokeError(error) };
    }
  }

  /**
   * Create new archive.
   * The Rust `SaveData` struct declares snake_case fields and serde does not
   * accept camelCase aliases, so the camelCase domain model must be
   * translated field-by-field before invoking.
   */
  async createArchive(options: CreateArchiveOptions): Promise<ArchiveServiceResult<void>> {
    try {
      const saveData = {
        archive_name: options.archiveName,
        level: options.level,
        game_mode: options.gameMode,
        difficulty: options.difficulty,
        actual_difficulty: options.actualDifficulty,
        players: options.players.map((p) => ({
          steam_id: p.steamId,
          inventory: p.inventory,
          sanity: p.sanity,
        })),
        basic_archive: options.basicArchive,
        main_ending: options.mainEnding,
        meg_unlocked: options.megUnlocked,
      };
      await invoke("handle_new_save", { saveData });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: normalizeInvokeError(error),
        errorType: detectDuplicateNameError(error) ? "duplicate_name" : undefined,
      };
    }
  }

  /**
   * Pre-flight name availability check backed by `check_archive_name`.
   * Mirrors the create/edit filename construction, so a positive answer
   * guarantees the backend's overwrite guard will not reject the request.
   * `difficulty` must be the exact string that will be passed to
   * createArchive / handle_edit_save.
   * `excludePath` lets the edit flow treat its own .sav as available.
   */
  async checkArchiveName(
    archiveName: string,
    difficulty: string,
    excludePath?: string,
  ): Promise<ArchiveServiceResult<ArchiveNameAvailability>> {
    try {
      const result = await invoke<ArchiveNameAvailability>("check_archive_name", {
        name: archiveName,
        difficulty,
        excludePath: excludePath ?? null,
      });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: normalizeInvokeError(error) };
    }
  }

  /**
   * Convert .sav to JSON
   */
  async convertSavToJson(filePath: string): Promise<ArchiveServiceResult<{ json: string }>> {
    try {
      const result = await invoke<{ success: boolean; json: string }>("convert_sav_to_json", {
        filePath,
      });
      return { success: true, data: { json: result.json } };
    } catch (error) {
      return {
        success: false,
        error: normalizeInvokeError(error),
      };
    }
  }

  /**
   * Convert JSON to .sav
   */
  async convertJsonToSav(jsonContent: string, outputPath: string): Promise<ArchiveServiceResult<void>> {
    try {
      await invoke("convert_json_to_sav", { jsonContent, outputPath });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: normalizeInvokeError(error),
      };
    }
  }

  /**
   * Open save games folder
   */
  async openSaveGamesFolder(): Promise<ArchiveServiceResult<void>> {
    try {
      await invoke("open_save_games_folder");
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: normalizeInvokeError(error),
      };
    }
  }
}

// Singleton instance
export const tauriArchiveAdapter = new TauriArchiveAdapter();
