/**
 * 主应用组件
 * 路由配置在此处
 *
 * 页面级组件一律 React.lazy 懒加载：首屏只加载外壳（AppShell），
 * 各页面 chunk 在首次进入路由时才请求，缩短启动白屏时间。
 */
import { lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./layouts";
import { PagePlaceholder, Toaster } from "./components";
import { useAppStore } from "./stores";
import { windowControls } from "./api/system";

const SavesPage = lazy(() => import("./features/saves/SavesPage"));
const CreateModePage = lazy(() => import("./features/create/CreateModePage"));
const CreateWizardPage = lazy(() => import("./features/create/CreateWizardPage"));
const QuickCreatePage = lazy(() => import("./features/create/QuickCreatePage"));
const EditArchivePage = lazy(() => import("./features/edit/EditArchivePage"));
const ModsPage = lazy(() => import("./features/mods/ModsPage"));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage"));

function App() {
  const theme = useAppStore((s) => s.theme);

  // 首帧提交后：移除 index.html 启动 splash，并显示被 visible:false 隐藏的窗口
  useEffect(() => {
    document.getElementById("splash")?.remove();
    windowControls.show().catch(() => undefined);
  }, []);

  // 应用主题（light / dark / system）
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark =
        theme === "dark" || (theme === "system" && mq.matches);
      root.classList.toggle("dark", dark);
    };
    apply();
    if (theme !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  // 占位页面：尚未迁移的功能入口
  const page = (labelKey: string) => <PagePlaceholder labelKey={labelKey} />;

  return (
    <>
      <Routes>
        {/* 布局路由：所有页面渲染在 AppShell 的内容区（Outlet）内 */}
        <Route element={<AppShell />}>
          <Route path="/" element={page("home")} />

          {/* 存档 */}
          <Route path="/saves/all" element={<SavesPage />} />
          <Route path="/saves/favorites" element={page("saves-favorites")} />
          <Route path="/saves/trash" element={page("saves-trash")} />
          <Route path="/saves/create" element={<CreateModePage />} />
          {/* 创建流程子路由（不进侧边栏） */}
          <Route path="/saves/create/custom" element={<CreateWizardPage />} />
          <Route path="/saves/create/quick" element={<QuickCreatePage />} />

          {/* 游戏 */}
          <Route path="/games/overview" element={page("games-overview")} />
          <Route path="/games/edit" element={<EditArchivePage />} />

          {/* 模组 */}
          <Route path="/mods/installed" element={<ModsPage />} />
          <Route path="/mods/browse" element={page("mods-browse")} />
          <Route path="/mods/updates" element={page("mods-updates")} />

          {/* 修改 */}
          <Route path="/tools/game-data" element={page("tools-game-data")} />
          <Route path="/tools/realtime" element={page("tools-realtime")} />
          <Route path="/tools/more" element={page("tools-more")} />

          <Route path="/login" element={page("login")} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
