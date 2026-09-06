/**
 * 存档 API — save/loader/deleter/converter 相关命令
 */
import { tauriInvoke } from "./core";
import type {
  ArchiveFolderFile,
  CreateArchiveOptions,
  SaveFileDetail,
  SaveFileMeta,
  SaveItem,
} from "../types";

/** handle_file toggle_visibility 的返回（JSON 字符串，需解析） */
interface ToggleVisibilityResponse {
  success: boolean;
  isVisible: boolean;
}

export const saveApi = {
  /** 加载全部存档（完整解析，较慢） */
  async loadAllSaves(): Promise<SaveItem[]> {
    return tauriInvoke<SaveItem[]>("load_all_saves");
  },

  /** 加载存档元数据（快速，不含关卡详情） */
  async loadSaveMetadata(): Promise<SaveFileMeta[]> {
    return tauriInvoke<SaveFileMeta[]>("load_save_metadata");
  },

  /** 批量加载存档详情（当前关卡 / 实际难度） */
  async loadSaveDetailsBatch(paths: string[]): Promise<SaveFileDetail[]> {
    return tauriInvoke<SaveFileDetail[]>("load_save_details_batch", { paths });
  },

  /** 永久删除 */
  async deleteFile(filePath: string): Promise<void> {
    return tauriInvoke<void>("delete_file", { filePath });
  },

  /** 移入回收站（软删除） */
  async softDeleteFile(filePath: string): Promise<void> {
    return tauriInvoke<void>("soft_delete_file", { filePath });
  },

  /** 从回收站恢复 */
  async restoreFile(filePath: string): Promise<void> {
    return tauriInvoke<void>("restore_file", { filePath });
  },

  /** 从回收站永久删除 */
  async permanentDeleteFile(filePath: string): Promise<void> {
    return tauriInvoke<void>("permanent_delete_file", { filePath });
  },

  /**
   * 切换存档可见性（重命名 MAINSAVE.sav）。
   * visible 传 null 表示相对翻转；后端返回验证后的最终状态。
   */
  async toggleVisibility(
    filePath: string,
    archiveName: string,
    visible: boolean | null
  ): Promise<{ isVisible: boolean }> {
    const raw = await tauriInvoke<string>("handle_file", {
      filePath,
      action: "toggle_visibility",
      archiveName,
      visible,
    });
    let parsed: ToggleVisibilityResponse;
    try {
      parsed = JSON.parse(raw) as ToggleVisibilityResponse;
    } catch {
      throw new Error("Malformed response from backend");
    }
    if (!parsed || typeof parsed.isVisible !== "boolean" || parsed.success === false) {
      throw new Error("Backend reported toggle failure");
    }
    return { isVisible: parsed.isVisible };
  },

  /** 创建新存档 */
  async createArchive(saveData: CreateArchiveOptions): Promise<void> {
    return tauriInvoke<void>("handle_new_save", { saveData });
  },

  /** .sav → JSON */
  async convertSavToJson(filePath: string): Promise<{ success: boolean; json: string }> {
    return tauriInvoke<{ success: boolean; json: string }>("convert_sav_to_json", { filePath });
  },

  /** JSON → .sav */
  async convertJsonToSav(jsonContent: string, outputPath: string): Promise<void> {
    return tauriInvoke<void>("convert_json_to_sav", { jsonContent, outputPath });
  },

  /** 打开存档文件夹 */
  async openSaveGamesFolder(): Promise<void> {
    return tauriInvoke<void>("open_save_games_folder");
  },

  /** 读取存档文件夹（整理分组）配置 */
  async loadArchiveFolders(): Promise<ArchiveFolderFile> {
    return tauriInvoke<ArchiveFolderFile>("load_archive_folders");
  },

  /** 整体保存存档文件夹（整理分组）配置 */
  async saveArchiveFolders(data: ArchiveFolderFile): Promise<void> {
    return tauriInvoke<void>("save_archive_folders", { data });
  },
};
