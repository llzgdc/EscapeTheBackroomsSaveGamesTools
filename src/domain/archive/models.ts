/**
 * Domain Models - Archive
 * Core business entities for archive management
 */

export interface Archive {
  id: number;
  name: string;
  /** Display name from MAINSAVE's SaveDisplayNamesLookup (what the game shows). */
  displayName?: string | null;
  difficulty: string;
  actualDifficulty: string;
  mode: string;
  date: string;
  currentLevel: string;
  hidden: boolean;
  path: string;
  isVisible?: boolean;
}

export interface ArchiveMetadata {
  id: number;
  name: string;
  /** Display name from MAINSAVE's SaveDisplayNamesLookup (what the game shows). */
  displayName?: string | null;
  difficulty: string;
  mode: string;
  date: string;
  hidden: boolean;
  path: string;
  isVisible?: boolean;
  fileSize: number;
}

export interface ArchiveDetail {
  path: string;
  currentLevel: string;
  actualDifficulty: string;
}

/**
 * One soft-deleted archive sitting in the recycle bin.
 * `path` points at the `.sav.trash` file on disk (diagnostics); every
 * backend call (restore / permanent delete) is addressed by `originalPath`,
 * the `.sav` location the archive would return to — the backend recomputes
 * the trash location from it.
 */
export interface TrashedArchive {
  id: number;
  name: string;
  difficulty: string;
  mode: string;
  date: string;
  path: string;
  originalPath: string;
  fileSize: number;
}

/** Outcome of a restore attempt the trash page can branch on. */
export type RestoreTrashOutcome =
  { status: "success" } | { status: "conflict"; archiveName: string } | { status: "error"; message: string };

/**
 * Raw archive config as parsed from user input (before enrichment).
 * Differs from the app-level ArchiveConfig in @/types/archive:
 * here parsedInfo is a simple key/value map and difficulty is a raw string.
 */
export interface ParsedArchiveConfig {
  id: string;
  name: string;
  parsedInfo: {
    level?: string;
    difficulty?: string;
    mode?: string;
  };
  level: string | null;
  difficulty: string | null;
  actualDifficulty: string | null;
  inventoryTemplate: unknown[] | null;
  finalLevel: string | null;
  finalDifficulty: string | null;
  finalActualDifficulty: string | null;
  finalInventory: unknown[];
  hasIndividualSettings: boolean;
  validationErrors: string[];
}

export interface CreateArchivePlayer {
  steamId: string;
  inventory: number[];
  sanity: number;
}

export interface CreateArchiveOptions {
  archiveName: string;
  level: string;
  gameMode: string;
  difficulty: string;
  actualDifficulty: string;
  players: CreateArchivePlayer[];
  basicArchive: Record<string, unknown>;
  mainEnding: boolean;
  megUnlocked: boolean;
}

/**
 * Result of the backend's pre-flight archive-name availability check
 * (`check_archive_name`). When `available` is false, `suggestion` holds a
 * first-free alternative like "Hotel (2)" (empty when none could be found).
 */
export interface ArchiveNameAvailability {
  available: boolean;
  suggestion: string;
}
