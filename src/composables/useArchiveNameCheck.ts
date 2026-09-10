import { ref } from "vue";
import { tauriArchiveAdapter } from "@/adapters/tauri/archiveAdapter";

/**
 * Debounced archive-name availability checking shared by the create wizard
 * (Step 2) and the edit flow (Basic tab).
 *
 * The point is to catch name collisions BEFORE the backend's overwrite guard
 * rejects the request, and to surface an actionable suggestion — so the user
 * gets a one-click fix instead of a raw "archive already exists" error.
 *
 * Check failures fail open (treated as "no known conflict"): the backend
 * guard still protects data, so a flaky check must never lock the UI.
 */

const CHECK_DEBOUNCE_MS = 300;

export function useArchiveNameCheck() {
  /** Conflicting archive name, or null when the name is free / unknown. */
  const nameConflict = ref<string | null>(null);
  /** First available alternative (e.g. "Hotel (2)") when conflicted. */
  const suggestedName = ref("");
  const isChecking = ref(false);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let sequence = 0;

  const clearPending = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const reset = () => {
    sequence++;
    clearPending();
    nameConflict.value = null;
    suggestedName.value = "";
    isChecking.value = false;
  };

  /**
   * Schedule a debounced availability check.
   * @param archiveName raw (untrimmed) input value
   * @param difficulty the exact difficulty string the save flow will use
   * @param excludePath archive's own .sav path (edit flow) so keeping the
   *   current name is not flagged as a conflict
   */
  const scheduleCheck = (archiveName: string, difficulty: string, excludePath?: string) => {
    const trimmed = archiveName.trim();
    if (!trimmed) {
      reset();
      return;
    }
    clearPending();
    isChecking.value = true;
    const current = ++sequence;
    timer = setTimeout(async () => {
      timer = null;
      const result = await tauriArchiveAdapter.checkArchiveName(trimmed, difficulty, excludePath);
      // A newer input arrived while the request was in flight — discard.
      if (current !== sequence) return;
      if (result.success && result.data) {
        nameConflict.value = result.data.available ? null : trimmed;
        suggestedName.value = result.data.available ? "" : result.data.suggestion;
      } else {
        // Fail open: unknown availability must not block the user.
        nameConflict.value = null;
        suggestedName.value = "";
      }
      isChecking.value = false;
    }, CHECK_DEBOUNCE_MS);
  };

  return { nameConflict, suggestedName, isChecking, scheduleCheck, reset };
}
