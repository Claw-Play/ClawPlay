/**
 * Timestamp utilities for ClawPlay.
 *
 * Key invariant: event_logs.created_at is stored as Unix seconds.
 * All conversions to JS Date must multiply by 1000.
 */

/**
 * Convert Unix seconds (DB format) to JS Date.
 */
export function unixSecToDate(unixSec: number | null | undefined): Date | null {
  if (unixSec == null) return null;
  return new Date(unixSec * 1000);
}

/**
 * Convert JS milliseconds to Unix seconds (for DB queries).
 * All raw SQL `WHERE created_at >= ?` params must use this.
 */
export function toUnixSec(ms: number): number {
  return Math.floor(ms / 1000);
}

/**
 * Format date part: "Apr 17, 2026"
 */
export function formatDate(date: Date | null, locale = "en-US"): string {
  if (!date) return "—";
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format time part: "14:30:00"
 */
export function formatTime(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Full timestamp: "17/04/2026, 14:30:00" (en-GB)
 */
export function formatTs(unixSec: number): string {
  const d = unixSecToDate(unixSec);
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
