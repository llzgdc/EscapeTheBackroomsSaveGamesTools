<p align="center">
  <img src="./docs/header-light-fz.png" alt="ETB Save Manager — 《逃離後室》存檔編輯與管理工具" width="100%">
</p>

<p align="center">
  <a href="https://eververdants.github.io/ETBSaveManager/">官網</a>
  <span> · </span>
  <a href="./README-CN.md">简体中文</a>
  <span> · </span>
  <a href="#">繁體中文</a>
  <span> · </span>
  <a href="./README.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/Eververdants/ETBSaveManager/releases"><img src="https://img.shields.io/github/v/release/Eververdants/ETBSaveManager?label=最新版本" alt="最新版本"></a>
  <a href="https://github.com/Eververdants/ETBSaveManager/actions"><img src="https://img.shields.io/github/actions/workflow/status/Eververdants/ETBSaveManager/release.yml?label=CI%2FCD" alt="CI/CD 管道"></a>
  <a href="https://github.com/Eververdants/ETBSaveManager/releases"><img src="https://img.shields.io/github/downloads/Eververdants/ETBSaveManager/total?label=總下載量" alt="總下載量"></a>
  <a href="https://github.com/Eververdants/ETBSaveManager/stargazers"><img src="https://img.shields.io/github/stars/Eververdants/ETBSaveManager?label=星標" alt="GitHub 星標"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Eververdants/ETBSaveManager?label=授權" alt="MIT 授權"></a>
  <img src="https://img.shields.io/badge/platform-Windows-blue?label=平台" alt="僅限 Windows">
</p>

---

## 為什麼選擇 ETB Save Manager？

《逃離後室》（Escape The Backrooms）的存檔檔案散落在遊戲目錄中，僅憑檔案名稱難以區分，稍不注意就會被覆蓋或遺失。**ETB Save Manager** 為您提供了一個簡潔而強大的桌面工具，徹底解決存檔管理難題：

- **集中管理**所有《逃離後室》的存檔檔案，一目瞭然
- **編輯玩家資料** — 背包物品、理智值等 UE4 存檔欄位
- **建立新存檔** — 從零建立或基於範本快速產生，全面控制遊戲狀態
- **整理歸類** — 收自訂命名、智慧篩選和批次操作
- **資源回收筒保護** — 軟刪除機制，誤刪的存檔可隨時復原

無論是想保護遊戲進度的休閒玩家，還是需要測試不同遊戲狀態的核心玩家，ETB Save Manager 都能讓您完全掌控自己的存檔資料。

---

## ✨ 功能特性

### 📂 存檔管理

- **完整增刪改查** — 建立、檢視、編輯、重新命名、複製、刪除、隱藏/顯示存檔
- **軟刪除與資源回收筒** — 誤刪存檔可從資源回收筒復原，支援徹底刪除
- **批次操作** — 多選模式，同時複製、刪除或匯出多個存檔
- **多維排序** — 依名稱、建立時間、修改時間或遊戲關卡排序
- **智慧篩選** — 按遊戲關卡、難度模式、遊戲模式或關鍵字篩選
- **模糊搜尋** — 輸入即搜，即時定位目標存檔
- **復原/重做** — 所有存檔操作均支援復原與重做，操作失誤不再是問題
- **虛擬捲動** — 基於 @tanstack/vue-virtual 實現的大列表流暢渲染，即使數百個存檔也不卡頓

### ✏️ 存檔編輯與玩家資料工具

- **背包編輯器** — 視覺化編輯玩家背包物品，支援新增、刪除和修改
- **玩家資料編輯** — 編輯理智值等 UE4 存檔中的玩家屬性
- **快速建立** — 簡化流程，數秒內產生新存檔檔案
- **標準建立精靈** — 逐步精靈，提供完整的自訂選項

### 🎨 使用者介面與體驗

- **簡潔現代的設計** — 直覺佈局搭配 GSAP 驅動的流暢交互動畫
- **10 套內建主題** — 淺色、深色 + 8 套色彩主題（海洋、森林、日落、薰衣草、玫瑰、薄荷、蜜桃、天空）
- **響應式佈局** — 可摺疊側邊欄，自適應元件，適配任意視窗尺寸
- **硬體加速渲染** — GPU 最佳化渲染管線，始終保持流暢效能
- **全域搜尋** — 任意頁面按 `Ctrl+F` 即可跨頁搜尋
- **通知中心** — 持久化通知系統，追蹤所有應用事件與操作
- **統一設定面板** — 集中管理所有應用設定

### 🌐 多語言支援

| 語言 | 語言檔案 |
|------|----------|
| 繁體中文 | `zh-TW` |
| 简体中文 | `zh-CN` |
| English (英文) | `en-US` |

> 國際化系統採用模組化設計，歡迎社群貢獻更多語言。新增語言檔案即可擴充支援。

---

## 🖼️ 介面預覽

<p align="center">
  <img src="./docs/存檔列表-zh.jpg" alt="ETB Save Manager — 存檔主列表檢視，展示包含關卡名稱、難度標籤和玩家資訊的存檔卡片" width="49%">
  <img src="./docs/建立存檔頁面第一步-zh.jpg" alt="ETB Save Manager — 標準建立存檔精靈第一步：選擇遊戲關卡、難度和玩家名稱" width="49%">
</p>
<p align="center">
  <img src="./docs/快速建立存檔頁面-zh.jpg" alt="ETB Save Manager — 快速建立存檔頁面，數秒內產生新的逃離後室存檔檔案" width="49%">
  <img src="./docs/編輯頁面-zh.jpg" alt="ETB Save Manager — 存檔編輯頁面，包含玩家資料欄位、背包物品和理智值設定" width="49%">
</p>

---

## 🚀 安裝方式

### 方式一：下載安裝包（推薦）

1. 前往 [最新發佈頁面](https://github.com/Eververdants/ETBSaveManager/releases/latest)
2. 下載 Windows 安裝包（`.exe` 格式）
3. 執行安裝程式 — 無需額外設定

> **提示：** 本應用需要 [WebView2 執行階段](https://developer.microsoft.com/microsoft-edge/webview2)，Windows 10/11 通常已預裝。如未安裝，安裝程式可自動獲取。

### 方式二：從原始碼建置

```bash
# 克隆倉庫
git clone https://github.com/Eververdants/ETBSaveManager.git
cd ETBSaveManager

# 安裝依賴
npm install

# 開發模式執行（熱重載）
npm run tauri dev

# 建置生產版本（產生安裝包）
npm run tauri build
```

**環境需求：**

- **Node.js 18+** — 執行環境
- **Rust 工具鏈** — 編譯 Tauri 後端所需（`rustc`、`cargo`）
- **平台相關依賴** — 參見 [Tauri v2 環境設定指南](https://v2.tauri.app/start/prerequisites/)

---

## ❓ 常見問題

**問：這是 Fancy Games 的官方工具嗎？**

答：不是。ETB Save Manager 是一個**獨立的、社群開源專案**，與 Fancy Games 或《逃離後室》的開發者沒有任何關聯或背書關係。

**問：編輯存檔會導致遊戲損壞嗎？**

答：編輯器會在可能範圍內驗證資料，但修改存檔檔案始終存在一定風險。**編輯前請務必備份原始存檔**。應用內的資源回收筒功能提供了一層安全保障 — 誤刪的原始存檔可以復原。

**問：是否支援最新的《逃離後室》版本？**

答：是。當遊戲更新改變了存檔資料格式時，工具會同步更新。請查看[發佈頁面](https://github.com/Eververdants/ETBSaveManager/releases)取得最新更新。

**問：如何回報 Bug 或請求新功能？**

答：請在 [GitHub Issue 追蹤器](https://github.com/Eververdants/ETBSaveManager/issues) 提交 Issue。歡迎 Bug 回報和功能請求。

---

## 🔧 技術棧

### 前端

| 技術 | 版本 | 用途 |
|------|------|------|
| [Vue 3](https://vuejs.org/) + Composition API | 3.x | 響應式 UI 框架 |
| [TypeScript](https://www.typescriptlang.org/) | 6.x | 型別安全開發 |
| [Vite](https://vite.dev/) | 8.x | 建置工具和開發伺服器 |
| CSS 自訂屬性 | — | 動態主題系統 |
| [vue-i18n](https://vue-i18n.intlify.dev/) | — | 國際化 |
| [Vue Router](https://router.vuejs.org/) | 4 | 單頁應用路由 |
| [GSAP](https://gsap.com/) | — | 高效能動畫 |
| [@tanstack/vue-virtual](https://tanstack.com/virtual) | — | 大數據列表虛擬捲動 |
| [FontAwesome](https://fontawesome.com/) | 7 | 向量圖示庫 |
| [Chart.js](https://www.chartjs.org/) | — | 資料視覺化 |
| [@vue-flow/core](https://vueflow.dev/) | — | 節點式流程編輯器 |
| [vitest](https://vitest.dev/) + [fast-check](https://fast-check.dev/) | — | 單元測試與屬性測試 |

### 後端（Rust / Tauri）

| 技術 | 版本 | 用途 |
|------|------|------|
| [Tauri](https://v2.tauri.app/) | 2.0 | 桌面應用框架（Rust + WebView） |
| [uesave](https://crates.io/crates/uesave) | 0.7.1 | UE4 存檔檔案解析與序列化 |
| [serde](https://serde.rs/) + serde_json | — | 資料序列化/反序列化 |
| [tokio](https://tokio.rs/) + [reqwest](https://docs.rs/reqwest/) | — | 非同步 HTTP 用戶端（更新檢查） |
| [walkdir](https://github.com/BurntSushi/walkdir) + [memmap2](https://docs.rs/memmap2/) | — | 高效檔案遍歷與記憶體映射 I/O |
| [rayon](https://github.com/rayon-rs/rayon) | — | 並行資料處理 |
| [chrono](https://github.com/chronotope/chrono) | — | 日期時間處理 |
| [uuid](https://github.com/uuid-rs/uuid) | — | 唯一識別碼產生 |
| [regex](https://github.com/rust-lang/regex) | — | 正規表示式模式配對 |
| [thiserror](https://docs.rs/thiserror/) | — | 錯誤型別推導 |

---

## 🎨 主題畫廊

ETB Save Manager 內建 **10 套主題**：

### 基礎主題
- **Light（淺色）** — 清新的淺色日間主題
- **Dark（深色）** — 舒適的深色夜間主題

### 色彩主題
| 主題 | 描述 | 色調 |
|------|------|------|
| **Ocean（海洋）** | 深藍色海洋風格 | 藍色系、青色系 |
| **Forest（森林）** | 自然綠色森林風格 | 綠色系、大地色系 |
| **Sunset（日落）** | 溫暖橙色日落色調 | 橙色系、紅色系 |
| **Lavender（薰衣草）** | 柔和紫色薰衣草 | 紫色系、紫羅蘭色系 |
| **Rose（玫瑰）** | 優雅粉色玫瑰 | 粉色系 |
| **Mint（薄荷）** | 清新薄荷綠 | 薄荷色、鼠尾草色 |
| **Peach（蜜桃）** | 柔和蜜桃色調 | 蜜桃色、珊瑚色 |
| **Sky（天空）** | 明亮天空藍 | 天藍色、白色系 |

---

## 專案結構

```
ETBSaveManager/
├── src/                              # Vue 3 前端（TypeScript）
│   ├── components/
│   │   ├── archive/                  # 存檔相關 UI 元件
│   │   │   ├── ArchiveCard.vue
│   │   │   ├── ArchiveSearchFilter.vue
│   │   │   └── QuickCreateArchiveCard.vue
│   │   ├── feature/                  # 功能元件
│   │   │   ├── FloatingActionButton.vue
│   │   │   ├── GlobalSearchPanel.vue
│   │   │   ├── InventoryItemSelector.vue
│   │   │   └── PreviewExecuteArea.vue
│   │   ├── layout/                   # 佈局元件
│   │   │   ├── Sidebar.vue
│   │   │   └── TitleBar.vue
│   │   ├── modal/                    # 模態對話框
│   │   │   ├── ArchiveEditModal.vue
│   │   │   ├── ConfirmModal.vue
│   │   │   └── PromptPopup.vue
│   │   ├── system/                   # 系統工具
│   │   │   ├── PerformanceMonitor.vue
│   │   │   ├── PerformanceSettings.vue
│   │   │   └── PlayerManager.vue
│   │   ├── theme/                    # 主題系統
│   │   │   └── ThemeSelector.vue
│   │   └── ui/                       # 可複用 UI 元件
│   │       ├── CustomDropdown.vue
│   │       ├── CustomSlider.vue
│   │       ├── ErrorBoundary.vue
│   │       ├── LazyImage.vue
│   │       └── NotificationPopup.vue
│   ├── composables/                  # Vue 組合式函式
│   │   ├── useArchiveActions.ts      # 存檔 CRUD 操作
│   │   ├── useArchiveData.ts         # 存檔資料管理
│   │   ├── useArchiveCard.ts         # 卡片互動
│   │   ├── useArchiveCardFlow.ts     # 流模式邏輯
│   │   ├── useArchiveSearchFilter.ts # 篩選與搜尋
│   │   ├── useUndoRedo.ts            # 復原/重做
│   │   ├── useGlobalSearchPanel.ts   # 全域搜尋
│   │   └── ...（更多組合式函式）
│   ├── config/                       # 應用設定
│   │   ├── sidebarMenu.ts
│   │   ├── updateConfig.ts
│   │   └── version.ts
│   ├── i18n/                         # 國際化
│   │   ├── index.ts
│   │   ├── loader.ts
│   │   └── locales/
│   │       ├── en-US/                # 英文語言檔案
│   │       ├── zh-CN/                # 簡體中文
│   │       └── zh-TW/                # 繁體中文
│   ├── router/                       # Vue Router 設定
│   ├── services/                     # 業務邏輯服務
│   │   ├── storageService.ts         # SQLite 持久化儲存
│   │   ├── logService.ts             # 日誌服務
│   │   ├── notificationService.ts    # 通知中心
│   │   ├── popupService.ts           # 彈窗管理
│   │   ├── themeStorage.ts           # 主題持久化
│   │   ├── pluginStorage.ts          # 外掛資料儲存
│   │   └── updateService.ts          # 自動更新檢查
│   ├── styles/
│   │   ├── animations.css
│   │   └── themes/                   # 主題 CSS 檔案
│   │       ├── _colors.css / _components.css / _semantic.css
│   │       ├── light.css / dark.css
│   │       ├── ocean.css / forest.css / sunset.css
│   │       ├── lavender.css / rose.css / mint.css
│   │       ├── peach.css / sky.css
│   │       └── index.css
│   ├── utils/                        # 工具函式
│   ├── views/                        # 頁面檢視
│   │   ├── Home.vue                  # 存檔列表（主檢視）
│   │   ├── CreateArchive/            # 建立存檔精靈
│   │   ├── EditArchive.vue           # 存檔編輯器
│   │   ├── QuickCreateArchive.vue    # 快速建立存檔
│   │   ├── SelectCreateMode.vue      # 建立模式選擇
│   │   ├── Settings.vue              # 應用設定
│   │   └── About.vue                 # 關於頁面
│   ├── types.ts                      # 全域型別定義
│   ├── appContext.ts                 # 依賴注入上下文
│   ├── App.vue                       # 根元件
│   └── main.ts                       # 應用入口
├── src-tauri/                        # Rust 後端（Tauri）
│   └── src/
│       ├── lib.rs                    # 庫入口 / Tauri 設定
│       ├── main.rs                   # 主入口
│       ├── save_commands.rs          # 存檔 CRUD Tauri 命令
│       ├── save_editor.rs            # 存檔檔案編輯邏輯
│       ├── save_shared.rs            # 共享存檔型別
│       ├── save_utils.rs             # 存檔檔案工具函式
│       ├── new_save.rs               # 存檔建立邏輯
│       ├── player_data.rs            # 玩家資料處理
│       ├── cli_handlers.rs           # CLI 命令處理
│       ├── system_commands.rs        # 系統級 Tauri 命令
│       ├── theme_commands.rs         # 主題管理
│       ├── gpu_settings.rs           # GPU/渲染設定
│       ├── get_file_path.rs          # 檔案路徑解析
│       ├── common.rs                 # 通用輔助函式
│       └── error.rs                  # 錯誤型別定義
├── public/                           # 靜態資源
│   ├── icons/                        # 遊戲物品圖示
│   └── images/                       # 關卡圖片
├── docs/                             # 截圖與文件
├── scripts/                          # 建置腳本
│   └── sync-version.js               # 版本同步
├── dist/                             # 建置輸出
├── index.html                        # HTML 入口
├── vite.config.ts                    # Vite 設定
├── tsconfig.json                     # TypeScript 設定
├── eslint.config.js                  # ESLint 設定
├── package.json
└── pnpm-lock.yaml
```

---

## 🤝 參與貢獻

歡迎各種形式的貢獻！這是一個個人學生專案，任何幫助 — 無論是程式碼、Bug 回報、翻譯還是文件 — 都備受感激。

- **🐛 回報 Bug** — [提交 Bug 報告](https://github.com/Eververdants/ETBSaveManager/issues)
- **💡 功能建議** — [提交功能請求](https://github.com/Eververdants/ETBSaveManager/issues)
- **🌐 新增翻譯** — 國際化系統採用模組化設計，新增語言檔案即可貢獻新語言
- **📧 聯絡信箱** — llzgd@outlook.com

---

## 開源授權

[MIT License](LICENSE) © 2026 Eververdants

---

## ⭐ 支持專案

ETB Save Manager 是一個開源社群專案。如果您覺得它有用，歡迎在 GitHub 上為倉庫點亮星標！

<p align="center">
  <a href="https://github.com/Eververdants/ETBSaveManager/stargazers">
    <img src="https://img.shields.io/github/stars/Eververdants/ETBSaveManager?style=for-the-badge&label=在%20GitHub%20上點亮星標&logo=github" alt="在 GitHub 上點亮星標">
  </a>
</p>

---

## ⚠️ 免責聲明

本專案**與 Fancy Games 或《逃離後室》（Escape The Backrooms）沒有任何關聯、背書或連結關係**。

遊戲素材（如關卡圖示、物品圖示）**僅用於識別目的**，協助使用者辨認存檔所屬的關卡或物品。  
《逃離後室》及其素材的所有權利均屬於其各自所有者。

---

<p align="center">
  <sub>使用 ❤️ 和 <a href="https://vuejs.org/">Vue.js</a> + <a href="https://v2.tauri.app/">Tauri</a> 建置</sub>
</p>
