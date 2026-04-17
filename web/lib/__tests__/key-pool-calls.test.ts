/**
 * Tests for totalCalls (lifetime counter) and window auto-reset behavior.
 *
 * Covers:
 * - totalCalls starts at 0 after addProviderKey
 * - totalCalls increments on each recordKeyUsage call
 * - totalCalls never resets; windowUsed resets on minute boundary
 * - Window auto-reset on pickKey (past minute resets windowUsed)
 * - Window does NOT reset within same minute
 * - windowStart updates to current minute after reset
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tempDbPath, cleanupDb } from "./helpers/db";

// ── Env & Redis mock ─────────────────────────────────────────────────────────
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
});

afterEach(() => {
  cleanupDb(dbPath);
});

function reapplyMocks() {
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
}

async function setupDb() {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();
  reapplyMocks();
}

async function getKp() {
  return import("@/lib/providers/key-pool");
}

// ── totalCalls — lifetime counter ─────────────────────────────────────────────
describe("totalCalls — lifetime counter", () => {
  beforeEach(setupDb);

  it("starts at 0 after addProviderKey", async () => {
    const kp = await getKp();
    const id = await kp.addProviderKey("ark", "image", "sk-total-calls-test", { quota: 500 });
    mockFns.get.mockResolvedValue(null);

    const keys = await kp.listProviderKeys("image");
    const added = keys.find((k: any) => k.id === id);
    expect(added?.totalCalls).toBe(0);
  });

  it("increments totalCalls on each recordKeyUsage call", async () => {
    const kp = await getKp();
    const id = await kp.addProviderKey("ark", "llm", "sk-tc-inc", { quota: 500 });
    mockFns.get.mockResolvedValue(null);

    await kp.recordKeyUsage("ark", "llm", id);
    await kp.recordKeyUsage("ark", "llm", id);
    await kp.recordKeyUsage("ark", "llm", id);

    const keys = await kp.listProviderKeys("llm");
    const record = keys.find((k: any) => k.id === id);
    expect(record?.totalCalls).toBe(3);
  });

  it("windowUsed resets on minute boundary but totalCalls never resets", async () => {
    const kp = await getKp();
    const { providerKeys: pk } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/lib/db");

    const id = await kp.addProviderKey("ark", "vision", "sk-total-vs-window", { quota: 500 });
    mockFns.get.mockResolvedValue(null);

    // Simulate 10 calls
    for (let i = 0; i < 10; i++) {
      await kp.recordKeyUsage("ark", "vision", id);
    }

    const keys1 = await kp.listProviderKeys("vision");
    const r1 = keys1.find((k: any) => k.id === id);
    expect(r1!.totalCalls).toBe(10);
    expect(r1!.windowUsed).toBe(10);

    // Expire the window: set windowStart to 2 minutes ago
    const pastMinute = Math.floor(Date.now() / 60000) - 2;
    await db.update(pk).set({ windowStart: pastMinute * 60 }).where(eq(pk.id, id));
    mockFns.get.mockResolvedValue(null);

    // pickKey should trigger auto-reset
    await kp.pickKey("ark", "vision");

    const keys2 = await kp.listProviderKeys("vision");
    const r2 = keys2.find((k: any) => k.id === id);
    expect(r2!.totalCalls).toBe(10); // totalCalls stays at 10 (never resets)
    expect(r2!.windowUsed).toBe(0);  // windowUsed resets to 0
  });
});

// ── Window auto-reset ─────────────────────────────────────────────────────────
describe("window auto-reset on pickKey", () => {
  beforeEach(setupDb);

  it("windowUsed resets when windowStart is in a past minute", async () => {
    const kp = await getKp();
    const { providerKeys: pk } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/lib/db");

    const id = await kp.addProviderKey("ark", "llm", "sk-window-reset-test", { quota: 500 });
    mockFns.get.mockResolvedValue(null);

    // Simulate usage: 5 calls
    await db.update(pk).set({ windowUsed: 5 }).where(eq(pk.id, id));

    // Expire window: set windowStart to 2 minutes ago
    const pastMinute = Math.floor(Date.now() / 60000) - 2;
    await db.update(pk).set({ windowStart: pastMinute * 60 }).where(eq(pk.id, id));
    mockFns.get.mockResolvedValue(null);

    // pickKey triggers auto-reset
    await kp.pickKey("ark", "llm");

    const keys = await kp.listProviderKeys("llm");
    const record = keys.find((k: any) => k.id === id);
    expect(record!.windowUsed).toBe(0);
  });

  it("windowUsed does NOT reset when still within same minute window", async () => {
    const kp = await getKp();
    const { providerKeys: pk } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/lib/db");

    const id = await kp.addProviderKey("ark", "llm", "sk-window-no-reset", { quota: 500 });
    mockFns.get.mockResolvedValue(null);

    // Set windowUsed to 7 within current minute
    const currentMinute = Math.floor(Date.now() / 60000);
    await db.update(pk).set({ windowUsed: 7, windowStart: currentMinute * 60 }).where(eq(pk.id, id));
    mockFns.get.mockResolvedValue(null);

    await kp.pickKey("ark", "llm");

    const keys = await kp.listProviderKeys("llm");
    const record = keys.find((k: any) => k.id === id);
    expect(record!.windowUsed).toBe(7); // Still 7 (no reset within same minute)
  });

  it("windowStart updates to current minute after reset", async () => {
    const kp = await getKp();
    const { providerKeys: pk } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/lib/db");

    const id = await kp.addProviderKey("ark", "image", "sk-ws-update", { quota: 500 });
    mockFns.get.mockResolvedValue(null);

    // Set windowStart to 3 minutes ago
    const pastMinute = Math.floor(Date.now() / 60000) - 3;
    await db.update(pk).set({ windowStart: pastMinute * 60 }).where(eq(pk.id, id));
    mockFns.get.mockResolvedValue(null);

    await kp.pickKey("ark", "image");

    const keys = await kp.listProviderKeys("image");
    const record = keys.find((k: any) => k.id === id);
    // windowStart is stored as Unix seconds; check it's been updated to near-current time
    const nowSeconds = Math.floor(Date.now() / 1000);
    const twoMinutesAgoSeconds = nowSeconds - 120;
    expect(record!.windowStart).toBeGreaterThan(twoMinutesAgoSeconds); // was updated from past
  });
});
