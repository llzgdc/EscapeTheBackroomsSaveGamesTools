/**
 * Archive Service
 * Business logic for archive operations
 */

import type { Archive, CreateArchiveOptions } from "./models";
import { validateArchiveName, validateInventoryTemplate } from "./validators";

/**
 * Typed failure reasons a caller can branch on to offer a fix instead of
 * surfacing a dead-end error. Currently only the backend's overwrite guard
 * rejection (create/rename onto an existing archive name).
 */
export type ArchiveErrorType = "duplicate_name";

export interface ArchiveServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorType?: ArchiveErrorType;
}

/**
 * Archive business service
 */
export class ArchiveService {
  /**
   * Parse archive name to extract components
   */
  parseArchiveName(name: string): {
    mode: string;
    archiveName: string;
    difficulty: string;
  } | null {
    const regex = /^(SINGLEPLAYER|MULTIPLAYER)_(.+)_(Easy|Normal|Hard|Nightmare|\d+)\.sav$/i;
    const match = name.match(regex);
    if (!match) return null;

    return {
      mode: match[1].toUpperCase(),
      archiveName: match[2],
      difficulty: match[3],
    };
  }

  /**
   * Validate archive before creation
   */
  validateBeforeCreation(options: CreateArchiveOptions): ArchiveServiceResult<void> {
    const nameValidation = validateArchiveName(options.archiveName);
    if (!nameValidation.valid) {
      return {
        success: false,
        error: nameValidation.errors.join(", "),
      };
    }

    if (!options.level || options.level.trim().length === 0) {
      return {
        success: false,
        error: "Level is required",
      };
    }

    const inventoryValidation = validateInventoryTemplate(options.players as unknown[]);
    if (!inventoryValidation.valid) {
      return {
        success: false,
        error: inventoryValidation.errors.join(", "),
      };
    }

    return { success: true };
  }

  /**
   * Check if archive can be edited
   */
  canEditArchive(archive: Archive): boolean {
    return !archive.hidden && archive.path.length > 0;
  }

  /**
   * Check if archive can be deleted
   */
  canDeleteArchive(archive: Archive): boolean {
    return archive.path.length > 0;
  }

  /**
   * Generate archive display name
   */
  getDisplayName(archive: Archive): string {
    const parsed = this.parseArchiveName(archive.name);
    if (parsed) {
      return parsed.archiveName;
    }
    return archive.name;
  }

  /**
   * Filter archives by criteria
   */
  filterArchives(
    archives: Archive[],
    criteria: {
      mode?: string;
      difficulty?: string;
      visibleOnly?: boolean;
      searchTerm?: string;
    },
  ): Archive[] {
    return archives.filter((archive) => {
      if (criteria.mode && archive.mode !== criteria.mode) {
        return false;
      }

      if (criteria.difficulty && archive.difficulty !== criteria.difficulty) {
        return false;
      }

      if (criteria.visibleOnly && archive.isVisible === false) {
        return false;
      }

      if (criteria.searchTerm) {
        const term = criteria.searchTerm.toLowerCase();
        const displayName = this.getDisplayName(archive).toLowerCase();
        if (!displayName.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort archives by name
   */
  sortArchivesByName(archives: Archive[]): Archive[] {
    return [...archives].sort((a, b) => {
      const nameA = this.getDisplayName(a).toLowerCase();
      const nameB = this.getDisplayName(b).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  /**
   * Sort archives by date
   */
  sortArchivesByDate(archives: Archive[], descending = true): Archive[] {
    return [...archives].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return descending ? dateB - dateA : dateA - dateB;
    });
  }
}

// Singleton instance
export const archiveService = new ArchiveService();
