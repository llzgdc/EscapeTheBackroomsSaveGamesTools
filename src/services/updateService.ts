import { getCurrentUpdateSource } from "@/config/updateConfig";
import { APP_VERSION } from "@/config/version";
import storage from "./storageService";
import type { UpdateInfo, UpdateSourceConfig } from "@/types/update";
import { openUrl } from "@tauri-apps/plugin-opener";

// Version information — sourced from package.json via @/config/version so it
// can never drift out of sync with the app build.
const CURRENT_VERSION = APP_VERSION;

// Simplified update status
export const UpdateStatus = {
  IDLE: "idle",
  CHECKING: "checking",
  AVAILABLE: "available",
  NOT_AVAILABLE: "not_available",
  ERROR: "error",
} as const;

export type UpdateStatusValue = (typeof UpdateStatus)[keyof typeof UpdateStatus];

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  preRelease: {
    type: string;
    typePriority: number;
    numbers: number[];
  } | null;
  isPreRelease: boolean;
}

interface ReleaseAsset {
  browser_download_url?: string;
  download_url?: string;
  url?: string;
  name?: string;
  filename?: string;
  [key: string]: unknown;
}

interface ReleaseInfo {
  tag_name: string;
  created_at?: string;
  published_at?: string;
  body?: string;
  description?: string;
  prerelease?: boolean;
  html_url?: string;
  url?: string;
  assets?: ReleaseAsset[];
  [key: string]: unknown;
}

interface ProcessedVersion {
  version: string;
  published_at: string;
  body: string;
  prerelease: boolean;
  html_url: string;
  assets: ReleaseAsset[];
}

interface UpdateCheckError {
  type: string;
  message: string;
  originalError?: string;
}

class UpdateService {
  status: UpdateStatusValue;
  updateInfo: UpdateInfo | null;
  error: UpdateCheckError | string | null;

  constructor() {
    this.status = UpdateStatus.IDLE;
    this.updateInfo = null;
    this.error = null;
  }

  /**
   * Check for updates - supports GitHub and Gitee
   * @returns Update information
   */
  async checkForUpdates(): Promise<UpdateInfo | { shouldUpdate: false; message: string }> {
    try {
      this.status = UpdateStatus.CHECKING;
      this.error = null;

      const sourceConfig: UpdateSourceConfig = getCurrentUpdateSource();
      const apiUrl = sourceConfig.apiUrl;
      const releasesUrl = sourceConfig.releasesUrl;

      console.info(`使用 ${sourceConfig.name} 检查更新...`);

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`无法获取版本信息 (HTTP ${response.status})`);
      }

      const data = await response.json();

      // Handle API differences between Gitee and GitHub
      let releases: ReleaseInfo[];
      if (sourceConfig.name.includes("Gitee")) {
        // Gitee API returns an array
        releases = Array.isArray(data) ? data : [data];
      } else {
        // GitHub API returns an array
        releases = Array.isArray(data) ? data : [data];
      }

      if (!releases || releases.length === 0) {
        throw new Error("No versions found");
      }

      // Extract version info from all releases
      const allVersions: ProcessedVersion[] = releases.map((r) => {
        const version = r.tag_name.replace("v", "");
        // Determine if this is a pre-release: prefer API's prerelease field, but also check version format
        const isPreReleaseByApi = sourceConfig.name.includes("Gitee") ? r.prerelease || false : r.prerelease || false;
        const isPreReleaseByVersion = version.includes("-"); // Version containing '-' indicates a pre-release

        // If version format indicates pre-release, force mark as pre-release
        const isPreRelease = isPreReleaseByVersion || isPreReleaseByApi;

        return {
          version,
          published_at: sourceConfig.name.includes("Gitee") ? r.created_at! : r.published_at!,
          body: sourceConfig.name.includes("Gitee")
            ? r.body || r.description || "暂无更新说明"
            : r.body || "No update notes available",
          prerelease: isPreRelease,
          html_url: r.html_url || r.url || "",
          assets: r.assets || [],
        };
      });

      // Determine if the current version is a pre-release
      const currentIsPreRelease = CURRENT_VERSION.includes("-");

      console.info(`当前版本: ${CURRENT_VERSION} (${currentIsPreRelease ? "预发布" : "正式版"})`);
      console.info(
        `找到 ${allVersions.length} 个版本:`,
        allVersions.map((v) => `${v.version}${v.prerelease ? " (预发布)" : ""}`),
      );

      // Separate stable versions and pre-release versions
      const stableVersions = allVersions.filter((v) => !v.prerelease);
      const preReleaseVersions = allVersions.filter((v) => v.prerelease);

      console.info(
        `正式版本: ${stableVersions.length} 个`,
        stableVersions.map((v) => v.version),
      );
      console.info(
        `预发布版本: ${preReleaseVersions.length} 个`,
        preReleaseVersions.map((v) => v.version),
      );

      // Prefer stable versions; only consider pre-release if no stable version exists or all stable versions are older
      let latestVersion: ProcessedVersion | null = null;

      // Find latest stable version first
      if (stableVersions.length > 0) {
        latestVersion = stableVersions.reduce((latest, current) => {
          return this.isNewVersion(current.version, latest.version) ? current : latest;
        });

        console.info(`Latest stable version: ${latestVersion.version}`);

        // If latest stable is newer than current, use it
        if (this.isNewVersion(latestVersion.version, CURRENT_VERSION)) {
          console.info(`✓ Found newer stable version: ${latestVersion.version}`);
        } else {
          console.info(`✗ Latest stable ${latestVersion.version} is not newer than current ${CURRENT_VERSION}`);

          // Stable not new enough, check pre-release
          if (preReleaseVersions.length > 0) {
            const latestPreRelease = preReleaseVersions.reduce((latest, current) => {
              return this.isNewVersion(current.version, latest.version) ? current : latest;
            });

            console.info(`Latest pre-release version: ${latestPreRelease.version}`);

            // If pre-release is newer than current, use it
            if (this.isNewVersion(latestPreRelease.version, CURRENT_VERSION)) {
              latestVersion = latestPreRelease;
              console.info(`✓ Using pre-release version: ${latestVersion.version}`);
            } else {
              console.info(`✗ No newer version found`);
            }
          }
        }
      } else if (preReleaseVersions.length > 0) {
        // No stable versions, use pre-release
        latestVersion = preReleaseVersions.reduce((latest, current) => {
          return this.isNewVersion(current.version, latest.version) ? current : latest;
        });
        console.info(`Only pre-release versions available, using: ${latestVersion.version}`);
      }

      if (!latestVersion) {
        throw new Error("No available version found");
      }

      console.info(
        `Final selected version: ${latestVersion.version}${latestVersion.prerelease ? " (Pre-release)" : " (Stable)"}`,
      );
      console.info("Assets:", latestVersion.assets);

      if (this.isNewVersion(latestVersion.version, CURRENT_VERSION)) {
        this.status = UpdateStatus.AVAILABLE;
        // Get download link
        let directDownloadUrl: string | null = null;

        // Try to get direct download link
        if (latestVersion.assets && latestVersion.assets.length > 0) {
          // Prefer zip files, fall back to the first available asset
          const zipAsset = latestVersion.assets.find((asset) => {
            const downloadUrl = asset.browser_download_url || asset.download_url || asset.url;
            const fileName = asset.name || asset.filename || "";
            return downloadUrl && (fileName.endsWith(".zip") || fileName.endsWith(".exe") || fileName.endsWith(".dmg"));
          });

          if (zipAsset) {
            directDownloadUrl = zipAsset.browser_download_url || zipAsset.download_url || zipAsset.url || null;
          } else {
            // Use the first available asset
            const firstAsset = latestVersion.assets[0];
            directDownloadUrl = firstAsset.browser_download_url || firstAsset.download_url || firstAsset.url || null;
          }
        }

        this.updateInfo = {
          version: latestVersion.version,
          date: latestVersion.published_at,
          body: latestVersion.body,
          downloadUrl: latestVersion.html_url || releasesUrl,
          directDownloadUrl: directDownloadUrl || latestVersion.html_url || releasesUrl,
          prerelease: latestVersion.prerelease,
          shouldUpdate: true,
          source: sourceConfig.name,
        };
        return this.updateInfo;
      } else {
        this.status = UpdateStatus.NOT_AVAILABLE;
        return { shouldUpdate: false, message: "Already up to date" };
      }
    } catch (error: unknown) {
      console.error("检查更新失败:", error);
      this.status = UpdateStatus.ERROR;

      const err = error instanceof Error ? error : new Error(String(error));

      // Check if this is a rate limit error
      let errorMessage = err.message;
      let errorType = "Network error";

      if (err.message?.includes("rate limit") || err.message?.includes("429")) {
        errorMessage = "Request too frequent, please try again later";
        errorType = "Rate Limit";
      } else if (err.message?.includes("network") || err.message?.includes("timeout")) {
        errorMessage = "Network connection timeout, please check network and retry";
        errorType = "Network Connection";
      } else if (err.message?.includes("404")) {
        errorMessage = "Failed to get update info, please try again later";
        errorType = "Resource Not Found";
      } else if (err.message?.includes("403")) {
        errorMessage = "Access restricted, please try again later";
        errorType = "Access Restricted";
      }

      this.error = {
        type: errorType,
        message: errorMessage,
        originalError: err.message,
      };

      throw {
        type: errorType,
        message: errorMessage,
        originalError: err.message,
      };
    }
  }

  /**
   * Version comparison supporting pre-release versions
   * @param newVersion - New version number
   * @param currentVersion - Current version number
   * @returns Whether it's a new version
   */
  isNewVersion(newVersion: string, currentVersion: string): boolean {
    const parseVersion = (version: string): ParsedVersion => {
      // Split main version and pre-release identifier
      const [mainVersion, ...preReleaseParts] = version.split("-");
      const [major, minor, patch] = mainVersion.split(".").map(Number);

      // Parse pre-release version
      let preRelease: ParsedVersion["preRelease"] = null;
      if (preReleaseParts.length > 0) {
        const preReleaseStr = preReleaseParts.join("-");
        const match = preReleaseStr.match(/^(Alpha|Beta|RC|alpha|beta|rc)(?:[-.](\d+(?:\.\d+)*))?$/i);
        if (match) {
          const [, type, numStr] = match;
          const numParts = numStr ? numStr.split(".").map(Number) : [0];

          // Pre-release type priority: Alpha < Beta < RC < Stable
          const typePriority: Record<string, number> = {
            alpha: 0,
            beta: 1,
            rc: 2,
          };

          const typeKey = type.toLowerCase();
          preRelease = {
            type: typeKey,
            typePriority: typePriority[typeKey] ?? 3,
            numbers: numParts,
          };
        } else {
          // Unrecognized pre-release identifier, treat as low priority
          preRelease = { type: "unknown", typePriority: -1, numbers: [0] };
        }
      }

      return {
        major,
        minor,
        patch,
        preRelease,
        isPreRelease: preRelease !== null,
      };
    };

    const newVer = parseVersion(newVersion);
    const currentVer = parseVersion(currentVersion);

    // Compare major version
    if (newVer.major !== currentVer.major) {
      return newVer.major > currentVer.major;
    }
    if (newVer.minor !== currentVer.minor) {
      return newVer.minor > currentVer.minor;
    }
    if (newVer.patch !== currentVer.patch) {
      return newVer.patch > currentVer.patch;
    }

    // Same major version, compare pre-release versions
    if (newVer.isPreRelease && currentVer.isPreRelease) {
      // Both are pre-release versions
      if (newVer.preRelease!.typePriority !== currentVer.preRelease!.typePriority) {
        return newVer.preRelease!.typePriority > currentVer.preRelease!.typePriority;
      }

      // Same pre-release type, compare version numbers
      const newNums = newVer.preRelease!.numbers;
      const currentNums = currentVer.preRelease!.numbers;
      const maxLen = Math.max(newNums.length, currentNums.length);

      for (let i = 0; i < maxLen; i++) {
        const newNum = newNums[i] || 0;
        const currentNum = currentNums[i] || 0;

        if (newNum !== currentNum) {
          return newNum > currentNum;
        }
      }

      return false; // Exactly the same
    } else if (!newVer.isPreRelease && currentVer.isPreRelease) {
      // New version is stable, current version is pre-release
      return true;
    } else if (newVer.isPreRelease && !currentVer.isPreRelease) {
      // New version is pre-release, current version is stable
      return false;
    }

    return false; // Exactly the same
  }

  /**
   * Open download URL in system browser via Tauri opener plugin
   */
  async downloadAndInstall(): Promise<void> {
    if (!this.updateInfo) {
      throw new Error("没有可用的更新");
    }

    try {
      const url = this.updateInfo.directDownloadUrl;

      // Use Tauri opener plugin to open URL in default browser
      await openUrl(url);

      console.info("已打开下载链接:", url);
    } catch (error: unknown) {
      console.error("打开下载链接失败:", error);
      this.status = UpdateStatus.ERROR;
      this.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Get current status
   * @returns Status
   */
  getStatus(): UpdateStatusValue {
    return this.status;
  }

  /**
   * Get update information
   * @returns Update information
   */
  getUpdateInfo(): UpdateInfo | null {
    return this.updateInfo;
  }

  /**
   * Reset state
   */
  reset(): void {
    this.status = UpdateStatus.IDLE;
    this.updateInfo = null;
    this.error = null;
  }

  /**
   * Simplified rate limiting - check once every 12 hours
   * @returns Whether update check is allowed
   */
  canCheckUpdate(): boolean {
    const lastCheck = storage.getItem<string>("lastUpdateCheck");
    if (!lastCheck) return true;

    const now = Date.now();
    const lastCheckTime = parseInt(lastCheck, 10);
    const hoursSinceLastCheck = (now - lastCheckTime) / (1000 * 60 * 60);

    return hoursSinceLastCheck >= 24;
  }

  /**
   * Record last check time
   */
  recordLastCheck(): void {
    storage.setItem("lastUpdateCheck", Date.now().toString());
  }

  /**
   * Get current version number
   * @returns Current version number
   */
  getCurrentVersion(): string {
    return CURRENT_VERSION;
  }

  /**
   * Get current update source information
   * @returns Current update source configuration
   */
  getCurrentUpdateSource(): UpdateSourceConfig {
    return getCurrentUpdateSource();
  }
}

// Create singleton instance
export const updateService = new UpdateService();

// Check for updates on startup (simplified)
export const checkUpdateOnStartup = async (): Promise<void> => {
  if (updateService.canCheckUpdate()) {
    try {
      await updateService.checkForUpdates();
      updateService.recordLastCheck();
    } catch (error) {
      console.error("启动时检查更新失败:", error);
    }
  }
};
