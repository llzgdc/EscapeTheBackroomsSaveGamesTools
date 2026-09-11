/**
 * Format a byte count as a compact human-readable size ("1.5 MB").
 * Non-finite or non-positive values collapse to "0 KB" — trashed files
 * that vanished between listing and formatting should render empty,
 * not "NaN TB".
 */
const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  const unitIndex = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** unitIndex;
  // Whole numbers (and bytes) stay integer; sub-100 values keep one decimal.
  const digits = unitIndex === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${UNITS[unitIndex]}`;
}
