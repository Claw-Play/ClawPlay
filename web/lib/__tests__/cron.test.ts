/**
 * Tests for lib/cron/index.ts
 *
 * Uses vi.useFakeTimers() + mocked resetKeyWindow to test:
 * - startCronTimer singleton behavior
 * - Timer fires every 60 seconds
 * - Timer continues after errors
 * - stopCronTimer stops the timer
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock resetKeyWindow before importing cron ───────────────────────────────
const resetKeyUsageMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/providers/key-pool", () => ({
  resetKeyWindow: resetKeyUsageMock,
}));

// ── Cron module (imported after mock is set up) ─────────────────────────────
let startCronTimer: () => boolean;
let stopCronTimer: () => void;
let isCronTimerRunning: () => boolean;

beforeEach(async () => {
  vi.clearAllTimers();
  vi.useFakeTimers();
  resetKeyUsageMock.mockResolvedValue(undefined);
  resetKeyUsageMock.mockClear();

  // Re-import to reset singleton state
  vi.resetModules();
  // Re-apply the mock
  vi.mock("@/lib/providers/key-pool", () => ({
    resetKeyWindow: resetKeyUsageMock,
  }));

  const cron = await import("@/lib/cron");
  startCronTimer = cron.startCronTimer;
  stopCronTimer = cron.stopCronTimer;
  isCronTimerRunning = cron.isCronTimerRunning;
});

afterEach(() => {
  stopCronTimer();
  vi.useRealTimers();
});

// ── Singleton ────────────────────────────────────────────────────────────────
describe("singleton behavior", () => {
  it("returns true on first call", () => {
    expect(startCronTimer()).toBe(true);
  });

  it("returns false on second call", () => {
    startCronTimer();
    expect(startCronTimer()).toBe(false);
  });

  it("isCronTimerRunning is false before start", () => {
    expect(isCronTimerRunning()).toBe(false);
  });

  it("isCronTimerRunning is true after start", () => {
    startCronTimer();
    expect(isCronTimerRunning()).toBe(true);
  });

  it("isCronTimerRunning is false after stop", () => {
    startCronTimer();
    stopCronTimer();
    expect(isCronTimerRunning()).toBe(false);
  });
});

// ── Timer fires every 60 seconds ───────────────────────────────────────────
describe("timer interval", () => {
  it("does NOT call resetKeyWindow before 60 seconds", () => {
    startCronTimer();
    vi.advanceTimersByTime(30_000);
    expect(resetKeyUsageMock).not.toHaveBeenCalled();
  });

  it("calls resetKeyWindow after exactly 60 seconds", () => {
    startCronTimer();
    vi.advanceTimersByTime(60_000);
    expect(resetKeyUsageMock).toHaveBeenCalledTimes(1);
  });

  it("calls resetKeyWindow 3 times after 3 minutes", () => {
    startCronTimer();
    vi.advanceTimersByTime(180_000);
    expect(resetKeyUsageMock).toHaveBeenCalledTimes(3);
  });
});

// ── Error handling ──────────────────────────────────────────────────────────
describe("error handling", () => {
  it("timer continues after resetKeyWindow throws", () => {
    startCronTimer();

    // First call fails
    resetKeyUsageMock.mockRejectedValueOnce(new Error("DB error"));
    vi.advanceTimersByTime(60_000);
    expect(resetKeyUsageMock).toHaveBeenCalledTimes(1);

    // Subsequent calls succeed
    resetKeyUsageMock.mockResolvedValue(undefined);
    vi.advanceTimersByTime(60_000);
    expect(resetKeyUsageMock).toHaveBeenCalledTimes(2);
  });
});

// ── stopCronTimer ───────────────────────────────────────────────────────────
describe("stopCronTimer", () => {
  it("stops the timer — no more calls after stop", () => {
    startCronTimer();
    vi.advanceTimersByTime(120_000);
    expect(resetKeyUsageMock).toHaveBeenCalledTimes(2);

    stopCronTimer();

    // Advance another 2 minutes — should NOT trigger
    vi.advanceTimersByTime(120_000);
    expect(resetKeyUsageMock).toHaveBeenCalledTimes(2); // still 2
  });

  it("can restart after stop", () => {
    startCronTimer();
    vi.advanceTimersByTime(60_000);
    expect(resetKeyUsageMock).toHaveBeenCalledTimes(1);

    stopCronTimer();

    // Restart — should start fresh
    startCronTimer();
    vi.advanceTimersByTime(60_000);
    expect(resetKeyUsageMock).toHaveBeenCalledTimes(2); // one more call
  });
});
