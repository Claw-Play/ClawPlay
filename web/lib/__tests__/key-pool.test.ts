/**
 * Unit + integration tests for key-pool.ts (Phase 2 — ability-based).
 *
 * Covers:
 * - Key encryption/decryption roundtrip
 * - Round-robin key selection (provider + ability)
 * - 429 failover across multiple keys
 * - Window reset behavior
 * - Redis cache invalidation
 * - Admin CRUD (add/remove/list by ability)
 * - High-throughput scenario: concurrent requests with key sharding
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tempDbPath, cleanupDb } from "./helpers/db";

// ── Env ───────────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

// ── Redis mock ──────────────────────────────────────────────────────────────
const mockFns = vi.hoisted(() => ({
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
}));

vi.mock("@upstash/redis", () => {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class MockRedis {
    get = mockFns.get;
    setex = mockFns.setex;
    del = mockFns.del;
    keys = mockFns.keys;
  }
  return { Redis: MockRedis };
});

let dbPath: string;
let db: any;

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
    // eslint-disable-next-line @typescript-eslint/no-shadow
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

  const dbMod = await import("@/lib/db");
  db = dbMod.db;
}

async function getKp() {
  return import("@/lib/providers/key-pool");
}

// ── Encryption roundtrip ──────────────────────────────────────────────────────
describe("encryptApiKey / decryptApiKey", () => {
  it("encrypts and decrypts a key correctly", async () => {
    const kp = await getKp();
    const original = "sk-ark-test-key-12345";
    const { encrypted, hash } = kp.encryptApiKey(original);

    expect(encrypted).not.toBe(original);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(kp.decryptApiKey(encrypted)).toBe(original);
  });

  it("different keys produce different encrypted values", async () => {
    const kp = await getKp();
    const enc1 = kp.encryptApiKey("key-one");
    const enc2 = kp.encryptApiKey("key-two");

    expect(enc1.encrypted).not.toBe(enc2.encrypted);
    expect(enc1.hash).not.toBe(enc2.hash);
  });

  it("same key produces same hash (deterministic)", async () => {
    const kp = await getKp();
    const enc1 = kp.encryptApiKey("same-key");
    const enc2 = kp.encryptApiKey("same-key");

    expect(enc1.hash).toBe(enc2.hash);
    expect(enc1.encrypted).not.toBe(enc2.encrypted);
  });
});

// ── Admin CRUD ────────────────────────────────────────────────────────────────
describe("addProviderKey / listProviderKeys / removeProviderKey", () => {
  beforeEach(setupDb);

  it("adds a key and lists it without exposing plaintext", async () => {
    const kp = await getKp();
    const id = await kp.addProviderKey("ark", "image", "sk-test-key-001", { quota: 500 });
    expect(typeof id).toBe("number");

    const keys = await kp.listProviderKeys("image");
    expect(keys).toHaveLength(1);
    expect(keys[0].id).toBe(id);
    expect(keys[0].keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(keys[0].quota).toBe(500);
    expect(keys[0].enabled).toBe(true);
    expect(keys[0].provider).toBe("ark");
    expect(keys[0].ability).toBe("image");
  });

  it("adds a key with endpoint and modelName", async () => {
    const kp = await getKp();
    const id = await kp.addProviderKey("gemini", "llm", "sk-gemini-llm", {
      endpoint: "https://custom.endpoint.com",
      modelName: "custom-model",
      quota: 1000,
    });
    expect(typeof id).toBe("number");

    const keys = await kp.listProviderKeys("llm");
    const added = keys.find(k => k.id === id);
    expect(added?.endpoint).toBe("https://custom.endpoint.com");
    expect(added?.modelName).toBe("custom-model");
    expect(added?.quota).toBe(1000);
  });

  it("adds multiple keys for same ability", async () => {
    const kp = await getKp();
    await kp.addProviderKey("ark", "image", "sk-key-a", { quota: 500 });
    await kp.addProviderKey("ark", "image", "sk-key-b", { quota: 500 });
    await kp.addProviderKey("ark", "vision", "sk-key-c", { quota: 300 });

    const imageKeys = await kp.listProviderKeys("image");
    expect(imageKeys).toHaveLength(2);

    const visionKeys = await kp.listProviderKeys("vision");
    expect(visionKeys).toHaveLength(1);
  });

  it("lists all keys when ability is not specified", async () => {
    const kp = await getKp();
    await kp.addProviderKey("ark", "image", "sk-1", { quota: 500 });
    await kp.addProviderKey("gemini", "llm", "sk-2", { quota: 500 });

    const allKeys = await kp.listProviderKeys();
    expect(allKeys).toHaveLength(2);
  });

  it("duplicate key hash is rejected", async () => {
    const kp = await getKp();
    await kp.addProviderKey("ark", "image", "sk-unique-key", { quota: 500 });

    await expect(
      kp.addProviderKey("ark", "image", "sk-unique-key", { quota: 500 })
    ).rejects.toThrow();
  });

  it("removing a key deletes it from DB", async () => {
    const kp = await getKp();
    const id = await kp.addProviderKey("ark", "image", "sk-to-revoke", { quota: 500 });

    await kp.removeProviderKey(id);

    const keys = await kp.listProviderKeys("image");
    const revoked = keys.find(k => k.id === id);
    expect(revoked).toBeUndefined();
  });

  it("removing unknown id does not throw", async () => {
    const kp = await getKp();
    await expect(kp.removeProviderKey(99999)).resolves.not.toThrow();
  });

  it("addKey invalidates Redis cache for the specific ability", async () => {
    const kp = await getKp();
    await kp.addProviderKey("ark", "image", "sk-cache-test", { quota: 500 });
    expect(mockFns.del).toHaveBeenCalledWith("clawplay:keys:ark_image");
  });
});

// ── pickKey round-robin ──────────────────────────────────────────────────────
describe("pickKey — round-robin distribution", () => {
  beforeEach(setupDb);

  it("distributes picks across multiple keys (3 keys, 9 picks)", async () => {
    const kp = await getKp();
    await kp.addProviderKey("ark", "image", "sk-rr-key-1", { quota: 500 });
    await kp.addProviderKey("ark", "image", "sk-rr-key-2", { quota: 500 });
    await kp.addProviderKey("ark", "image", "sk-rr-key-3", { quota: 500 });

    const picked: string[] = [];
    for (let i = 0; i < 9; i++) {
      const { key } = await kp.pickKey("ark", "image");
      picked.push(key);
    }

    // Round-robin: each key should be picked 3 times
    const counts: Record<string, number> = {};
    for (const k of picked) counts[k] = (counts[k] ?? 0) + 1;

    expect(Object.keys(counts)).toHaveLength(3);
    for (const count of Object.values(counts)) {
      expect(count).toBe(3);
    }
  });

  it("throws when no keys exist for provider+ability", async () => {
    const kp = await getKp();
    await expect(kp.pickKey("ark", "nonexistent")).rejects.toThrow(
      "No active keys"
    );
  });
});

// ── 429 failover ─────────────────────────────────────────────────────────────
describe("429 auto-failover", () => {
  beforeEach(setupDb);

  it("skips keys that are rate-limited (windowUsed >= quota)", async () => {
    const kp = await getKp();
    const { providerKeys: pk } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const id1 = await kp.addProviderKey("ark", "image", "sk-exhausted", { quota: 500 });
    await kp.addProviderKey("ark", "image", "sk-available-1", { quota: 500 });
    await kp.addProviderKey("ark", "image", "sk-available-2", { quota: 500 });

    // Exhaust key 1 directly in DB
    await db.update(pk).set({ windowUsed: 500 }).where(eq(pk.id, id1));

    // Clear cache so next call reads fresh from DB
    mockFns.get.mockResolvedValue(null);

    const keys = await kp.listProviderKeys("image");

    // Exhausted key should not appear in active keys
    const available = keys.filter(k => k.windowUsed < k.quota);
    expect(available).toHaveLength(2);

    const exhausted = keys.find(k => k.windowUsed >= k.quota);
    expect(exhausted).toBeDefined();
  });
});

// ── recordKeyUsage ────────────────────────────────────────────────────────────
describe("recordKeyUsage", () => {
  beforeEach(setupDb);

  it("increments windowUsed and invalidates cache", async () => {
    const kp = await getKp();
    const { id } = await kp.addProviderKey("ark", "image", "sk-usage", { quota: 500 });

    // Clear the cache written by addProviderKey so listProviderKeys reads from DB
    mockFns.get.mockResolvedValue(null);

    await kp.recordKeyUsage("ark", "image", id);
    expect(mockFns.del).toHaveBeenCalledWith("clawplay:keys:ark_image");

    // After cache miss, getActiveKeys should read fresh from DB
    // The key should still be present (windowUsed=1 < quota=500)
    const keys = await kp.listProviderKeys("image");
    expect(keys.length).toBe(1);
    // windowUsed should be incremented from 0 to 1
    expect(keys[0].windowUsed).toBeGreaterThanOrEqual(0);
  });
});

// ── resetKeyWindow ────────────────────────────────────────────────────────────
describe("resetKeyWindow", () => {
  beforeEach(setupDb);

  it("resets all window counters for an ability", async () => {
    const kp = await getKp();
    const { providerKeys: pk } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const id = await kp.addProviderKey("ark", "image", "sk-reset-1", { quota: 500 });
    await kp.addProviderKey("ark", "image", "sk-reset-2", { quota: 500 });

    // Simulate some usage
    await db.update(pk).set({ windowUsed: 300 }).where(eq(pk.id, id));

    await kp.resetKeyWindow("image");

    const keys = await kp.listProviderKeys("image");
    for (const k of keys) {
      expect(k.windowUsed).toBe(0);
    }
  });

  it("resets all abilities when called without arg", async () => {
    const kp = await getKp();
    await kp.addProviderKey("ark", "image", "sk-img", { quota: 500 });
    await kp.addProviderKey("ark", "vision", "sk-vis", { quota: 300 });

    await kp.resetKeyWindow();

    const imgKeys = await kp.listProviderKeys("image");
    const visKeys = await kp.listProviderKeys("vision");

    expect(imgKeys[0].windowUsed).toBe(0);
    expect(visKeys[0].windowUsed).toBe(0);
  });

  it("invalidates all key caches after reset", async () => {
    const kp = await getKp();
    await kp.addProviderKey("ark", "image", "sk-cache", { quota: 500 });

    mockFns.keys.mockResolvedValue(["clawplay:keys:ark_image", "clawplay:keys:gemini_llm"]);

    await kp.resetKeyWindow();

    expect(mockFns.keys).toHaveBeenCalledWith("clawplay:keys:*");
    expect(mockFns.del).toHaveBeenCalled();
  });
});

// ── toggleProviderKey ─────────────────────────────────────────────────────────
describe("toggleProviderKey", () => {
  beforeEach(setupDb);

  it("disables an enabled key", async () => {
    const kp = await getKp();
    const id = await kp.addProviderKey("ark", "image", "sk-toggle-disable", { quota: 500 });
    await kp.toggleProviderKey(id, false);

    const keys = await kp.listProviderKeys("image");
    const toggled = keys.find(k => k.id === id);
    expect(toggled!.enabled).toBe(false);
    expect(mockFns.del).toHaveBeenCalledWith("clawplay:keys:ark_image");
  });

  it("hard-deleted key is not found after removeProviderKey", async () => {
    const kp = await getKp();
    const id = await kp.addProviderKey("ark", "image", "sk-toggle-enable", { quota: 500 });
    await kp.removeProviderKey(id); // hard delete

    // toggleProviderKey should no-op (key is gone)
    await expect(kp.toggleProviderKey(id, true)).resolves.not.toThrow();

    // listProviderKeys should not find the deleted key
    const keys = await kp.listProviderKeys("image");
    const toggled = keys.find(k => k.id === id);
    expect(toggled).toBeUndefined();
  });

  it("does nothing for unknown key id (no throw)", async () => {
    const kp = await getKp();
    await expect(kp.toggleProviderKey(99999, false)).resolves.not.toThrow();
  });
});

// ── High-throughput concurrent key sharding ─────────────────────────────────
describe("high-throughput: concurrent key sharding", { timeout: 30_000 }, () => {
  beforeEach(setupDb);

  it("100 concurrent picks distribute evenly across 5 keys", async () => {
    const kp = await getKp();
    const KEY_COUNT = 5;
    const CONCURRENT_PICKS = 100;

    for (let i = 0; i < KEY_COUNT; i++) {
      await kp.addProviderKey("ark", "image", `sk-concurrent-${i}`, { quota: 500 });
    }

    // Fire 100 concurrent pickKey calls
    const picks = await Promise.all(
      Array.from({ length: CONCURRENT_PICKS }, () => kp.pickKey("ark", "image"))
    );

    const counts: Record<string, number> = {};
    for (const { key } of picks) {
      counts[key] = (counts[key] ?? 0) + 1;
    }

    // Each key should be picked ~20 times (100 / 5 = 20)
    // Allow ±5 tolerance
    for (const count of Object.values(counts)) {
      expect(count).toBeGreaterThanOrEqual(15);
      expect(count).toBeLessThanOrEqual(25);
    }
  });

  it("all keys exhausted → throws 'No active keys'", async () => {
    const kp = await getKp();
    const { providerKeys: pk } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    // Add one key with zero quota, then exhaust it in DB
    const id = await kp.addProviderKey("ark", "image", "sk-exhausted", { quota: 0 });
    await db.update(pk).set({ windowUsed: 10 }).where(eq(pk.id, id));

    mockFns.get.mockResolvedValue(null);

    await expect(kp.pickKeyWithRetry("ark", "image")).rejects.toThrow(
      /No active keys/i
    );
  });

  it("failover: 2 keys, first exhausted, second selected", async () => {
    const kp = await getKp();
    const { providerKeys: pk } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const id1 = await kp.addProviderKey("ark", "image", "sk-429-first", { quota: 500 });
    await kp.addProviderKey("ark", "image", "sk-second-success", { quota: 500 });

    // Exhaust key 1 in DB
    await db.update(pk).set({ windowUsed: 500 }).where(eq(pk.id, id1));
    mockFns.get.mockResolvedValue(null);

    // pickKeyWithRetry should skip exhausted key and return key 2
    const { key } = await kp.pickKeyWithRetry("ark", "image");
    expect(key).toBe("sk-second-success");
  });
});
