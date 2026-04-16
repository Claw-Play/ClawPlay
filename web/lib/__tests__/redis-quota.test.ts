/**
 * Unit tests for lib/redis.ts — covers untested branches in getQuota, checkQuota, incrementQuota.
 * Uses vi.mock for @upstash/redis so no real network calls are made.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis before importing redis module
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockEval = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: function MockRedis() {
    this.get = mockGet;
    this.set = mockSet;
    this.eval = mockEval;
  },
}));

process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

// Import after mock is set up
const { getQuota, checkQuota, incrementQuota, ABILITY_COSTS } = await import("@/lib/redis");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getQuota — cache and timeout branches", () => {
  it("returns cached data without calling Redis when cache is fresh", async () => {
    // First call populates cache
    mockGet.mockResolvedValueOnce({ used: 10, limit: 1000 });
    await getQuota(111);
    // Second call with same userId should use cache (no extra Redis call)
    await getQuota(111);
    // Should only have called Redis once (cache hit on second call)
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("returns null when Redis returns null (no quota data for user)", async () => {
    mockGet.mockResolvedValueOnce(null);
    const result = await getQuota(888);
    expect(result).toBeNull();
  });

  it("returns null when Redis times out (> 2s)", async () => {
    mockGet.mockImplementation(
      () => new Promise((r) => setTimeout(() => r({ used: 10, limit: 1000 }), 3000))
    );
    const result = await getQuota(777);
    expect(result).toBeNull();
  });
});

describe("checkQuota — production + unknown ability branches", () => {
  it("returns allowed=true in dev when Redis is unavailable", async () => {
    process.env.NODE_ENV = "development";
    mockGet.mockRejectedValueOnce(new Error("Redis down"));
    const result = await checkQuota(1, "image.generate");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(999);
  });

  it("returns allowed=false in production when Redis is unavailable", async () => {
    process.env.NODE_ENV = "production";
    mockGet.mockRejectedValueOnce(new Error("Redis down"));
    const result = await checkQuota(1, "image.generate");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/unavailable/i);
  });

  it("uses cost=1 for unknown ability and denies when at limit", async () => {
    mockGet.mockResolvedValueOnce({ used: 1000, limit: 1000 });
    const result = await checkQuota(1, "totally.unknown.ability");
    // used(1000) + cost(1) > limit(1000) → denied
    expect(result.allowed).toBe(false);
  });

  it("allows unknown ability when used is well below limit", async () => {
    mockGet.mockResolvedValueOnce({ used: 500, limit: 1000 });
    const result = await checkQuota(1, "totally.unknown.ability");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(500);
  });

  it("uses DEFAULT_QUOTA_FREE when Redis returns null", async () => {
    mockGet.mockResolvedValueOnce(null);
    const result = await checkQuota(1, "image.generate");
    // used=0, cost=10, limit=100000 → allowed
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(100000);
  });
});

describe("incrementQuota — Lua script and Redis failure branches", () => {
  it("returns ok=false when Lua script returns -1 (quota exceeded)", async () => {
    mockEval.mockResolvedValueOnce(-1);
    const result = await incrementQuota(1, 5000);
    expect(result.ok).toBe(false);
  });

  it("returns ok=true with remaining on Lua script success", async () => {
    mockEval.mockResolvedValueOnce(990);
    const result = await incrementQuota(1, 10);
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(990);
  });

  it("returns ok=false when Redis eval throws (network failure)", async () => {
    mockEval.mockRejectedValueOnce(new Error("Redis timeout"));
    const result = await incrementQuota(1, 10);
    expect(result.ok).toBe(false);
  });
});

describe("ABILITY_COSTS constants", () => {
  it("has all expected abilities", () => {
    expect(ABILITY_COSTS["image.generate"]).toBe(10);
    expect(ABILITY_COSTS["tts.synthesize"]).toBe(5);
    expect(ABILITY_COSTS["vision.analyze"]).toBe(5);
    expect(ABILITY_COSTS["llm.generate"]).toBe(5);
    expect(ABILITY_COSTS["whoami"]).toBe(0);
  });

  it("all costs are non-negative integers", () => {
    for (const [, cost] of Object.entries(ABILITY_COSTS)) {
      expect(cost).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(cost)).toBe(true);
    }
  });
});
