/**
 * Debug test for totalCalls mapping
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tempDbPath, cleanupDb } from "./helpers/db";

process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

const mockFns = vi.hoisted(() => ({
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
}));

vi.mock("@upstash/redis", () => {
  class MockRedis {
    get = mockFns.get;
    setex = mockFns.setex;
    del = mockFns.del;
    keys = mockFns.keys;
  }
  return { Redis: MockRedis };
});

let dbPath: string;

beforeEach(() => {
  vi.clearAllMocks();
  mockFns.get.mockResolvedValue(null);
  mockFns.setex.mockResolvedValue("OK");
  mockFns.del.mockResolvedValue(1);
  mockFns.keys.mockResolvedValue([]);
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();
});

afterEach(() => {
  cleanupDb(dbPath);
});

describe("debug totalCalls", () => {
  it("check totalCalls in listProviderKeys", async () => {
    vi.unmock("@upstash/redis");
    vi.mock("@upstash/redis", () => {
      class MockRedis {
        get = mockFns.get;
        setex = mockFns.setex;
        del = mockFns.del;
        keys = mockFns.keys;
      }
      return { Redis: MockRedis };
    });

    const { db } = await import("@/lib/db");
    const kp = await import("@/lib/providers/key-pool");
    const { providerKeys } = await import("@/lib/db/schema");

    const id = await kp.addProviderKey("ark", "llm", "sk-debug", { quota: 500 });

    // Check raw DB
    const rawRows = (db as any).raw("SELECT * FROM provider_keys WHERE id = ?", [id]);
    console.log("Raw DB rows:", JSON.stringify(rawRows));
    console.log("Raw total_calls:", rawRows[0]?.total_calls);

    const keys = await kp.listProviderKeys("llm");
    const found = keys.find((k: any) => k.id === id);
    console.log("Found key:", JSON.stringify(found));
    expect(found?.totalCalls).toBe(0);
  });
});
