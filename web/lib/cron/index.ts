/**
 * Cron timer — resets key windows every minute.
 *
 * Architecture:
 * - On server start: first import (or first API call on serverless) triggers startCronTimer()
 * - Timer calls resetKeyWindow() every 60 seconds
 * - Singleton guard prevents multiple timers across hot-reloads or multiple instances
 *
 * For serverless (Vercel): keep /api/cron/reset-keys endpoint as Upstash QStash fallback.
 * For persistent servers (cloud VM, Railway, Render): this timer is the primary mechanism.
 */
import { resetKeyWindow } from "@/lib/providers/key-pool";

const CRON_INTERVAL_MS = 60_000; // 1 minute

let _started = false;
let _timer: ReturnType<typeof setInterval> | undefined;

/**
 * Start the cron timer. Idempotent — safe to call multiple times.
 * Returns true if started now, false if already running.
 */
export function startCronTimer(): boolean {
  if (_started) return false;
  _started = true;

  console.log("[cron] Key window reset timer started (every 60s)");

  _timer = setInterval(async () => {
    try {
      await resetKeyWindow();
      console.log("[cron] resetKeyWindow completed");
    } catch (err) {
      console.error("[cron] resetKeyWindow failed:", err);
    }
  }, CRON_INTERVAL_MS);

  return true;
}

/** Stop the cron timer (useful in tests) */
export function stopCronTimer(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = undefined;
    _started = false;
    console.log("[cron] Key window reset timer stopped");
  }
}

/** Whether the timer is currently running */
export function isCronTimerRunning(): boolean {
  return _started;
}
