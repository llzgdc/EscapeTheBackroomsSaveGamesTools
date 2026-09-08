/**
 * Local storage service - Optimized
 * Supports synchronous reading (from cache) and async persistence
 */

// In-memory cache - immediately available
let cache: Record<string, unknown> = {};
let initialized = false;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let initPromise: Promise<void> | null = null;

// Storage configuration
const STORAGE_DIR = "data";
const STORAGE_FILE = "settings.json";
// beforeunload 写入 localStorage 的最后快照 key，启动时用于恢复比文件更新的变更
const FLUSH_BACKUP_KEY = "__storage_flush_backup";

// Keys to migrate
const KEYS_TO_MIGRATE: readonly string[] = [
  "theme",
  "language",
  "updateSource",
  "performanceMonitor",
  "developerMode",
  "gpuAccelerationDisabled",
  "newYearThemeMode",
  "themeBeforeNewYear",
  "quick_create_tutorial_completed",
  "steamApiKey",
  "locale",
  "fabScrollHintShown",
  "hubUnlocked",
  "lastUpdateCheck",
  "user-custom-theme",
  "pluginSystemBetaUser",
  "pluginSystemBetaNotified",
  "seasonalThemeMode",
];

// Keys to keep in localStorage (for fast startup)
const KEYS_TO_KEEP_IN_LOCALSTORAGE: readonly string[] = ["theme", "language", "locale"];

// Critical keys that need immediate file persistence
const CRITICAL_KEYS: readonly string[] = ["theme", "language", "locale"];

/**
 * Get storage item (sync, read from cache)
 */
export function getItem<T = unknown>(key: string, defaultValue: T | null = null): T | null {
  // Prefer reading from cache
  if (cache[key] !== undefined) {
    return cache[key] as T;
  }
  // Before initialization, try reading from localStorage (for compatibility)
  if (!initialized) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }
    } catch (e) {
      console.warn("Failed to get storage item:", key, e);
    }
  }
  return defaultValue;
}

/**
 * Set storage item
 */
export function setItem(key: string, value: unknown): void {
  cache[key] = value;

  // Write critical config to localStorage synchronously (for fast startup)
  if (KEYS_TO_KEEP_IN_LOCALSTORAGE.includes(key)) {
    try {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch (e) {
      console.warn("Failed to set localStorage item:", key, e);
    }
  }

  if (initialized) {
    // Critical keys: write to file immediately to prevent data loss on crash.
    // We kick off the save synchronously (no microtask deferral) so the caller
    // can await persistence via flush() before e.g. closing the window.
    if (CRITICAL_KEYS.includes(key)) {
      saveToFile().catch((e) => console.warn("[Storage] critical save failed:", e));
    } else {
      debouncedSave();
    }
  }
}

/**
 * Remove storage item
 */
export function removeItem(key: string): void {
  delete cache[key];
  if (initialized) {
    debouncedSave();
  }
}

/**
 * Clear all storage
 */
export function clear(): void {
  cache = { _migrated: true };
  if (initialized) {
    debouncedSave();
  }
}

/**
 * Get all keys
 */
export function keys(): string[] {
  return Object.keys(cache).filter((k) => !k.startsWith("_"));
}

/**
 * Check if initialized
 */
export function isInitialized(): boolean {
  return initialized;
}

/**
 * Debounced save
 */
function debouncedSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveToFile, 500);
}

/**
 * Save to file
 */
async function saveToFile(): Promise<void> {
  try {
    const { BaseDirectory, writeTextFile } = await import("@tauri-apps/plugin-fs");
    const filePath = `${STORAGE_DIR}/${STORAGE_FILE}`;
    // Stamp the write time so restoreFlushBackup() can tell whether the
    // beforeunload localStorage backup is newer than this file.
    const content = JSON.stringify({ ...cache, _savedAt: Date.now() }, null, 2);
    await writeTextFile(filePath, content, { baseDir: BaseDirectory.AppData });
  } catch (error) {
    console.warn("[Storage] 保存失败:", error);
  }
}

/**
 * Force immediate save
 */
export async function flush(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  await saveToFile();
}

/**
 * Restore pending changes captured by the beforeunload flush backup when the
 * backup is newer than what made it into settings.json (the 500ms debounced
 * save may not have landed before the window closed). Always clears the backup.
 */
function restoreFlushBackup(): void {
  try {
    const raw = localStorage.getItem(FLUSH_BACKUP_KEY);
    localStorage.removeItem(FLUSH_BACKUP_KEY);
    if (!raw) return;

    const backup = JSON.parse(raw) as Record<string, unknown>;
    const flushedAt = typeof backup._flushedAt === "number" ? backup._flushedAt : 0;
    const savedAt = typeof cache._savedAt === "number" ? (cache._savedAt as number) : 0;
    if (flushedAt <= savedAt) return;

    // Adopt the backup payload, dropping bookkeeping keys (_flushedAt etc.)
    const restored: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(backup)) {
      if (!key.startsWith("_")) {
        restored[key] = value;
      }
    }
    cache = restored;
    debouncedSave();
    console.info("[Storage] Restored pending changes from beforeunload backup");
  } catch (e) {
    console.warn("[Storage] Failed to restore flush backup:", e);
  }
}

/**
 * Set up page lifecycle flush hooks (visibilitychange + beforeunload)
 * Called internally after init, or can be called manually.
 */
function setupLifecycleFlush(): void {
  // Flush when tab becomes hidden (mobile/smartphone tab switch, desktop minimize)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // Flush without blocking the visibilitychange event
      flush();
    }
  });

  // Flush on page unload/refresh/close
  window.addEventListener("beforeunload", () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    // Best-effort file save: it is async, so the webview may be torn down
    // before it lands — the synchronous localStorage backup below is what
    // restoreFlushBackup() reads on the next startup.
    saveToFile();
    const pendingJson = JSON.stringify({ ...cache, _flushedAt: Date.now() });
    try {
      localStorage.setItem(FLUSH_BACKUP_KEY, pendingJson);
    } catch (e) {
      console.warn("[Storage] beforeunload flush failed:", e);
    }
  });
}

/**
 * Initialize storage service
 */
export async function initStorage(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const { BaseDirectory, exists, mkdir, readTextFile } = await import("@tauri-apps/plugin-fs");

      // Ensure directory exists
      const dirExists = await exists(STORAGE_DIR, { baseDir: BaseDirectory.AppData });
      if (!dirExists) {
        await mkdir(STORAGE_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
      }

      // Read existing data
      const filePath = `${STORAGE_DIR}/${STORAGE_FILE}`;
      const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });

      if (fileExists) {
        const content = await readTextFile(filePath, { baseDir: BaseDirectory.AppData });
        try {
          cache = JSON.parse(content);
        } catch (parseError) {
          console.warn("[Storage] 缓存文件解析失败，使用空缓存:", parseError);
          cache = {};
        }
      }

      initialized = true;

      // Set up lifecycle flush hooks after init
      setupLifecycleFlush();

      // Recover changes newer than the file from the beforeunload backup
      restoreFlushBackup();

      // Migrate from localStorage (runs in background)
      if (!cache._migrated) {
        migrateFromLocalStorage();
      }
    } catch (error) {
      console.warn("[Storage] 初始化失败，使用内存缓存:", error);
      initialized = true;
      // Still try to set up lifecycle hooks even when init fails
      setupLifecycleFlush();
      restoreFlushBackup();
    }
  })();

  return initPromise;
}

/**
 * Migrate data from localStorage
 */
function migrateFromLocalStorage(): void {
  let migrated = false;

  for (const key of KEYS_TO_MIGRATE) {
    const value = localStorage.getItem(key);
    if (value !== null && cache[key] === undefined) {
      try {
        cache[key] = JSON.parse(value);
      } catch {
        cache[key] = value;
      }
      migrated = true;
    }
  }

  if (migrated) {
    cache._migrated = true;
    debouncedSave();

    // Clear old data, but keep keys needed for fast startup
    for (const key of KEYS_TO_MIGRATE) {
      if (!KEYS_TO_KEEP_IN_LOCALSTORAGE.includes(key)) {
        localStorage.removeItem(key);
      }
    }
  } else {
    cache._migrated = true;
    debouncedSave();
  }

  // Ensure fast startup keys are synced to localStorage
  for (const key of KEYS_TO_KEEP_IN_LOCALSTORAGE) {
    if (cache[key] !== undefined) {
      try {
        const value = cache[key];
        localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      } catch (e) {
        console.warn("Failed to sync localStorage item during flush:", key, e);
      }
    }
  }
}

// Export default object
export default {
  getItem,
  setItem,
  removeItem,
  clear,
  keys,
  isInitialized,
  flush,
  initStorage,
};
