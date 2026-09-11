import { ref } from "vue";
import type { MenuConfig } from "@/types/ui";

// 侧边栏菜单配置（支持i18n国际化）
// 使用国际化键值，实际文本在i18n语言包中定义

/**
 * 顶部菜单项配置
 * 用于侧边栏上半部分的菜单
 */
export const topMenuItems = ref<MenuConfig[]>([
  {
    id: 1,
    textKey: "sidebar.archiveList", // i18n键值
    icon: ["fas", "list"],
    action: "openArchiveList",
    descriptionKey: "archive.listDescription",
    route: "Home",
  },
  {
    id: 2,
    textKey: "sidebar.createArchive",
    icon: ["fas", "plus-circle"],
    action: "createNewArchive",
    descriptionKey: "archive.createDescription",
    route: "CreateArchive",
  },
  {
    id: 7,
    textKey: "sidebar.mods",
    icon: ["fas", "puzzle-piece"],
    action: "openMods",
    descriptionKey: "mods.description",
    route: "Mods",
  },
  {
    id: 8,
    textKey: "sidebar.trash",
    icon: ["fas", "trash-can"],
    action: "openTrash",
    descriptionKey: "archive.trashDescription",
    route: "Trash",
  },
]);

/**
 * 底部菜单项配置
 * 用于侧边栏下半部分的菜单
 */
export const bottomMenuItems = ref<MenuConfig[]>([
  {
    id: 5,
    textKey: "sidebar.about",
    icon: ["fas", "info-circle"],
    action: "showAbout",
    descriptionKey: "about.description",
    route: "About",
  },
  {
    id: 6,
    textKey: "sidebar.settings",
    icon: ["fas", "cog"],
    action: "openSettings",
    descriptionKey: "settings.description",
    route: "Settings",
  },
]);

/**
 * 获取所有菜单项
 * @returns {Object} 包含顶部和底部菜单项的对象
 */
export const getAllMenuItems = (): { top: typeof topMenuItems; bottom: typeof bottomMenuItems } => {
  return {
    top: topMenuItems,
    bottom: bottomMenuItems,
  };
};
