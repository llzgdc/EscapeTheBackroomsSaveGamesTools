/**
 * Duplicate archive-name error detection.
 *
 * The Rust backend serializes `AppError::DuplicateName` as
 * `{type: "duplicate_name", message: "An archive named 'X' already exists…"}`.
 * Older backend builds only carry the message string, so both shapes are
 * recognized here — the goal is that every flow that can hit the overwrite
 * guard can offer the user a fix instead of a dead-end error.
 */

const DUPLICATE_NAME_PATTERN = /An archive named '(.+?)' already exists/;

export interface DuplicateNameErrorInfo {
  /** Name of the conflicting archive as reported by the backend (may be empty). */
  archiveName: string;
}

/**
 * Detect a duplicate-name rejection from a raw Tauri invoke rejection,
 * a thrown Error, or an error message string.
 * Returns null when the error is something else.
 */
export function detectDuplicateNameError(error: unknown): DuplicateNameErrorInfo | null {
  let type: unknown;
  let message: unknown;
  if (typeof error === "object" && error !== null) {
    const e = error as { type?: unknown; message?: unknown };
    type = e.type;
    message = e.message;
  } else {
    message = error;
  }
  const text = typeof message === "string" ? message : "";
  const match = DUPLICATE_NAME_PATTERN.exec(text);
  if (type === "duplicate_name" || match) {
    return { archiveName: match?.[1] ?? "" };
  }
  return null;
}
