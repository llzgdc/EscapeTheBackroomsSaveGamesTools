/**
 * 全局类型定义
 */
export * from "./save";

// 主题类型
export type Theme = "light" | "dark" | "system";

// 语言类型
export type Language = "zh-CN" | "zh-TW" | "en-US";

// 注：ApiError 的权威实现是 `api/core.ts` 中的 class。
// 此处曾重复定义同名 interface（及 ApiResponse / BaseComponentProps），
// 三者全局零引用，按 AGENTS.md「无死代码」移除。
