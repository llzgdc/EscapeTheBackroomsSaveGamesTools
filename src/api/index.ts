/**
 * API 层（barrel）
 * 处理所有与 Tauri 后端的通信
 *
 * 重要规则：
 * 1. 所有 Tauri 调用必须经过此目录（组件/hook 不得直接使用 invoke）
 * 2. 错误处理统一在此层完成，抛出 ApiError
 * 3. Wire 类型字段名与 Rust 序列化保持一致（见 types/save.ts）
 *
 * 底层封装（tauriInvoke / ApiError）在 ./core，
 * 各领域模块从 core 引入 tauriInvoke，避免与 barrel 形成循环依赖。
 */

export {
  ApiError,
  normalizeInvokeError,
  tauriInvoke,
} from "./core";

// ============================================
// 各领域能力请使用对应模块：
// - saveApi    → ./save
// - playerApi  → ./player
// - modsApi    → ./mods
// - systemApi  → ./system
// - windowControls → ./system（@tauri-apps/api/window 封装，供标题栏使用）
// - IS_TAURI   → ./system（运行环境探测）
// ============================================
export { saveApi } from "./save";
export { playerApi } from "./player";
export { modsApi, GAME_ROOT_KEY } from "./mods";
export { systemApi, windowControls, IS_TAURI } from "./system";
