/**
 * 模组 API — UE4SS / NSU 安装管理
 */
import { tauriInvoke } from "./core";
import type {
  GamePathInfo,
  InstallResult,
  ModsStatus,
  Ue4ssChannel,
  UninstallReport,
} from "../types";

/** storageService 键：已保存的游戏根目录（Mods 页与 NSU 状态检查共用） */
export const GAME_ROOT_KEY = "modsGameRoot";

export const modsApi = {
  /** 校验所选文件夹（接受根目录 / 上级 / 内部目录） */
  async validateGamePath(path: string): Promise<GamePathInfo> {
    return tauriInvoke<GamePathInfo>("validate_game_path", { path });
  },

  /** 探测 Steam 库中的游戏安装路径；未找到返回 null */
  async detectGamePath(): Promise<string | null> {
    return tauriInvoke<string | null>("detect_game_path");
  },

  async getModsStatus(gameRoot: string): Promise<ModsStatus> {
    return tauriInvoke<ModsStatus>("get_mods_status", { gameRoot });
  },

  async installUe4ss(gameRoot: string, channel: Ue4ssChannel): Promise<InstallResult> {
    return tauriInvoke<InstallResult>("install_ue4ss", { gameRoot, channel });
  },

  async installNsu(gameRoot: string): Promise<InstallResult> {
    return tauriInvoke<InstallResult>("install_nsu", { gameRoot });
  },

  async setNsuEnabled(gameRoot: string, enabled: boolean): Promise<void> {
    return tauriInvoke<void>("set_nsu_enabled", { gameRoot, enabled });
  },

  async uninstallNsu(gameRoot: string): Promise<void> {
    return tauriInvoke<void>("uninstall_nsu", { gameRoot });
  },

  async uninstallUe4ss(gameRoot: string): Promise<UninstallReport> {
    return tauriInvoke<UninstallReport>("uninstall_ue4ss", { gameRoot });
  },

  /** 打开游戏 Win64/Mods 文件夹 */
  async openModsFolder(): Promise<void> {
    return tauriInvoke<void>("open_mods_folder");
  },
};
