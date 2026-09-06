/**
 * 系统 API — 窗口 / GPU / 进程 / 路径
 *
 * 本文件同时封装 `@tauri-apps/api/window` 的窗口控制能力，
 * 以保证「api/ 是唯一权威 API 层」：组件不得直接依赖 Tauri 窗口入口。
 */
import { getCurrentWindow } from "@tauri-apps/api/window";

import { tauriInvoke } from "./core";

export const systemApi = {
  /** 获取 %LOCALAPPDATA% 路径 */
  async getLocalAppdata(): Promise<string> {
    return tauriInvoke<string>("get_local_appdata");
  },

  /** 重启应用 */
  async restartApp(): Promise<void> {
    return tauriInvoke<void>("restart_app");
  },

  /** 设置窗口标题（语言切换时同步） */
  async setWindowTitle(title: string): Promise<void> {
    return tauriInvoke<void>("set_window_title", { title });
  },

  /** 获取 GPU 加速是否被禁用 */
  async getGpuAccelerationStatus(): Promise<boolean> {
    return tauriInvoke<boolean>("get_gpu_acceleration_status");
  },

  /** 设置 GPU 加速禁用（需手动重启生效） */
  async setGpuAcceleration(disabled: boolean): Promise<void> {
    return tauriInvoke<void>("set_gpu_acceleration", { disabled });
  },

  /** 设置进程优先级（如 "high"） */
  async setProcessPriority(priority: string): Promise<void> {
    return tauriInvoke<void>("set_process_priority", { priority });
  },
};

// ============================================
// 窗口控制（@tauri-apps/api/window 封装）
// ============================================

/** 是否运行在 Tauri 容器内（浏览器开发环境下为 false） */
export const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type AppWindow = ReturnType<typeof getCurrentWindow>;

let appWindow: AppWindow | null | undefined;

/** 懒初始化：非 Tauri 环境（浏览器 dev）返回 null */
function getAppWindow(): AppWindow | null {
  if (appWindow === undefined) {
    appWindow = IS_TAURI ? getCurrentWindow() : null;
  }
  return appWindow;
}

export const windowControls = {
  /** 是否运行在 Tauri 窗口内（否则 UI 应隐藏窗口控制按钮） */
  isAvailable(): boolean {
    return getAppWindow() !== null;
  },
  /** 显示窗口（配合 tauri.conf.json 的 visible:false，在首帧就绪后调用以消除白屏） */
  async show(): Promise<void> {
    await getAppWindow()?.show();
  },
  async minimize(): Promise<void> {
    await getAppWindow()?.minimize();
  },
  async toggleMaximize(): Promise<void> {
    await getAppWindow()?.toggleMaximize();
  },
  async close(): Promise<void> {
    await getAppWindow()?.close();
  },
  async isMaximized(): Promise<boolean> {
    return (await getAppWindow()?.isMaximized()) ?? false;
  },
  /** 订阅窗口尺寸变化，返回取消订阅函数 */
  async onResized(callback: () => void): Promise<() => void> {
    return (await getAppWindow()?.onResized(callback)) ?? (() => undefined);
  },
};
