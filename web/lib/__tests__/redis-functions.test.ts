import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mockFns exist when vi.mock factory runs
const mockFns = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  eval: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: function MockRedis() {
    this.get = mockFns.get;
    this.set = mockFns.set;
    this.eval = mockFns.eval;
  },
}));

// Set env before module load
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

import {
  getQuota,
  checkQuota,
  incrementQuota,
  initQuota,
  DEFAULT_QUOTA_FREE,
} from "@/lib/redis";

describe("Redis quota functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getQuota", () => {
    it("returns QuotaInfo when data exists", async () => {
      mockFns.get.mockResolvedValueOnce({ used: 100, limit: 1000 });
      const result = await getQuota(1);
      expect(result).toEqual({ used: 100, limit: 1000, remaining: 900 });
    });

    it("returns null when no quota data exists", async () => {
      mockFns.get.mockResolvedValueOnce(null);
      const result = await getQuota(2);
      expect(result).toBeNull();
    });

    it("clamps remaining to 0 when over limit", async () => {
      mockFns.get.mockResolvedValueOnce({ used: 1200, limit: 1000 });
      const result = await getQuota(3);
      expect(result!.remaining).toBe(0);
    });

    it("returns null on Redis error", async () => {
      mockFns.get.mockRejectedValueOnce(new Error("connection failed"));
      const result = await getQuota(4);
      expect(result).toBeNull();
    });
  });

  describe("checkQuota", () => {
    it("returns allowed=true when under quota", async () => {
      mockFns.get.mockResolvedValueOnce({ used: 0, limit: 1000 });
      const result = await checkQuota(1, "image.generate");
      expect(result.allowed).toBe(true);
    });

    it("returns allowed=false when over quota", async () => {
      // image.generate costs 10; 995 + 10 = 1005 > 1000
      mockFns.get.mockResolvedValueOnce({ used: 995, limit: 1000 });
      const result = await checkQuota(1, "image.generate");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Quota exceeded/);
    });

    it("uses DEFAULT_QUOTA_FREE when no quota data", async () => {
      mockFns.get.mockResolvedValueOnce(null);
      const result = await checkQuota(5, "tts.synthesize");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeDefined();
    });

    it("returns allowed=true optimistically on Redis error", async () => {
      mockFns.get.mockRejectedValueOnce(new Error("timeout"));
      const result = await checkQuota(6, "image.generate");
      expect(result.allowed).toBe(true);
    });

    it("allows whoami (cost=0) even at quota limit", async () => {
      mockFns.get.mockResolvedValueOnce({ used: 1000, limit: 1000 });
      const result = await checkQuota(1, "whoami");
      expect(result.allowed).toBe(true);
    });
  });

  describe("incrementQuota", () => {
    it("returns ok=true with remaining when Lua script succeeds", async () => {
      mockFns.eval.mockResolvedValueOnce(990);
      const result = await incrementQuota(1, "image.generate");
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(990);
    });

    it("returns ok=false when Lua script returns -1 (quota exceeded)", async () => {
      mockFns.eval.mockResolvedValueOnce(-1);
      const result = await incrementQuota(1, "image.generate");
      expect(result.ok).toBe(false);
    });

    it("returns ok=false on Redis error (fail-safe)", async () => {
      mockFns.eval.mockRejectedValueOnce(new Error("Redis down"));
      const result = await incrementQuota(1, "image.generate");
      expect(result.ok).toBe(false);
    });
  });

  describe("initQuota", () => {
    it("calls redis.set with correct key and initial values", async () => {
      mockFns.set.mockResolvedValueOnce("OK");
      await initQuota(10, 500);
      expect(mockFns.set).toHaveBeenCalledWith(
        "clawplay:quota:10",
        { used: 0, limit: 500 },
        { ex: 86400 }
      );
    });

    it("uses DEFAULT_QUOTA_FREE as default limit", async () => {
      mockFns.set.mockResolvedValueOnce("OK");
      await initQuota(11);
      expect(mockFns.set).toHaveBeenCalledWith(
        "clawplay:quota:11",
        { used: 0, limit: DEFAULT_QUOTA_FREE },
        { ex: 86400 }
      );
    });

    it("does not throw on Redis error", async () => {
      mockFns.set.mockRejectedValueOnce(new Error("Redis down"));
      await expect(initQuota(12)).resolves.toBeUndefined();
    });
  });
});
