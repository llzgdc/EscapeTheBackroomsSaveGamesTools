/**
 * API 底层封装 — invoke / 错误归一化
 *
 * 独立成模块是为了切断循环依赖：
 * 各领域模块（save/player/mods/system）依赖 tauriInvoke，
 * 而 tauriInvoke 原先定义在 index barrel 中并被 barrel 再导出，
 * 形成模块循环；代码分割后跨 chunk 循环会破坏执行顺序。
 *
 * 权威实现仍在此处，barrel（api/index.ts）仅再导出。
 */

import { invoke } from "@tauri-apps/api/core";

// ============================================
// 错误处理
// ============================================
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * 归一化 Rust AppError（序列化为 { type, message } 形状）。
 * 直接 String(error) 会得到 "[object Object]"，必须取 message 字段。
 */
export function normalizeInvokeError(error: unknown): string {
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    if (typeof err.message === "string" && err.message) return err.message;
    if (typeof err.msg === "string" && err.msg) return err.msg;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function handleApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError("UNKNOWN", normalizeInvokeError(error));
}

// ============================================
// Tauri API 封装
// ============================================
export async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw handleApiError(error);
  }
}
