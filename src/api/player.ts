/**
 * 玩家 API — get_player_data / get_player_unique_ids / unlock_all_hub_doors / handle_edit_save
 */
import { tauriInvoke } from "./core";
import type { PlayerData, PlayerIdMapping } from "../types";

export const playerApi = {
  /** 读取存档中的玩家数据（ids / 理智值 / 背包） */
  async getPlayerData(filePath: string): Promise<PlayerData> {
    return tauriInvoke<PlayerData>("get_player_data", { filePath });
  },

  /** 为 steamIds 复用已有 EOS 键（steamId_+_|EOS），无可用键时 success=false */
  async getPlayerUniqueIds(steamIds: string[]): Promise<PlayerIdMapping> {
    const res = await tauriInvoke<{ success: boolean; map: PlayerIdMapping }>(
      "get_player_unique_ids",
      { steamIds }
    );
    return res.map;
  },

  /** 解锁全部 Hub 门（作弊） */
  async unlockAllHubDoors(filePath: string): Promise<string> {
    return tauriInvoke<string>("unlock_all_hub_doors", { filePath });
  },

  /**
   * 保存编辑后的存档。
   * 注意嵌套包装：{ jsonInput: { saveData: { jsonData, outputDir } } }
   */
  async editSaveFile(
    jsonData: Record<string, unknown>,
    outputDir: string
  ): Promise<string> {
    return tauriInvoke<string>("handle_edit_save", {
      jsonInput: { saveData: { jsonData, outputDir } },
    });
  },
};
