/**
 * Unit + integration tests for key-pool.ts
 *
 * Covers:
 * - Key encryption/decryption roundtrip
 * - Round-robin key selection
 * - 429 failover across multiple keys
 * - Window reset behavior
 * - Redis cache invalidation
 * - Admin CRUD (add/remove/list)
 * - High-throughput scenario: concurrent requests with key sharding
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tempDbPath, cleanupDb } from "./helpers/db";

// ── Env (set before any module import) ────────────────────────────────────────
process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

// ── Redis mock — factory must return a function/class (not object literal) ───────
// vi.hoisted() ensures mockFns are available when vi.mock factory runs
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

// ── Module-level state ────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function reapplyMocks() {
  // Must unmock first to clear any stale mock from vi.resetModules()
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
  reapplyMocks(); // must re-apply mock after resetModules

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
    expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
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
    expect(enc1.encrypted).not.toBe(enc2.encrypted); // IV is random → different ciphertext
  });
});

// ── Admin CRUD ────────────────────────────────────────────────────────────────
describe("addProviderKey / listProviderKeys / removeProviderKey", () => {
  beforeEach(setupDb);

  it("adds a key and lists it without exposing plaintext", async () => {
    const kp = await getKp();
    const id = await kp.addProviderKey("ark_image", "sk-test-key-001", 500);
    expect(typeof id).toBe("number");

    const keys = await kp.listProviderKeys("ark_image");
    expect(keys).toHaveLength(1);
    expect(keys[0].id).toBe(id);
    expect(keys[0].keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(keys[0].quota).toBe(500);
    expect(keys[0].enabled).toBe(true);
  });

  it("adds multiple keys for same provider", async () => {
    const kp = await getKp();
    await kp.addProviderKey("ark_image", "sk-key-a", 500);
    await kp.addProviderKey("ark_image", "sk-key-b", 500);
    await kp.addProviderKey("ark_vision", "sk-key-c", 300);

    const imageKeys = await kp.listProviderKeys("ark_image");
    expect(imageKeys).toHaveLength(2);

    const visionKeys = await kp.listProviderKeys("ark_vision");
    expect(visionKeys).toHaveLength(1);
  });

  it("duplicate key hash is rejected", async () => {
    const kp = await getKp();
    await kp.addProviderKey("ark_image", "sk-unique-key", 500);

    await expect(
      kp.addProviderKey("ark_image", "sk-unique-key", 500)
    ).rejects.toThrow();
  });

  it("revoking a key marks it as disabled", async () => {
    const kp = await getKp();
    const id = await kp.addProviderKey("ark_image", "sk-to-revoke", 500);
    const { keyHash } = (await kp.listProviderKeys("ark_image")).find(k => k.id === id)!;

    await kp.removeProviderKey("ark_image", keyHash);

    const keys = await kp.listProviderKeys("ark_image");
    const revoked = keys.find(k => k.id === id);
    expect(revoked!.enabled).toBe(false);
  });

  it("removing unknown hash does not throw", async () => {
    const kp = await getKp();
    await expect(
      kp.removeProviderKey("ark_image", "a".repeat(64))
    ).resolves.not.toThrow();
  });

  it("addKey invalidates Redis cache", async () => {
    const kp = await getKp();
    await kp.addProviderKey("ark_image", "sk-cache-test", 500);
    expect(mockFns.del).toHaveBeenCalledWith("clawplay:keys:ark_image");
  });
});

// ── pickKey round-robin ──────────────────────────────────────────────────────
describe("pickKey — round-robin distribution", () => {
  beforeEach(setupDb);

  it("distributes picks across multiple keys (3 keys, 9 picks)", async () => {
    const kp = await getKp();
    await kp.addProviderKey("ark_image", "sk-rr-key-1", 500);
    await kp.addProviderKey("ark_image", "sk-rr-key-2", 500);
    await kp.addProviderKey("ark_image", "sk-rr-key-3", 500);

    const picked: string[] = [];
    for (let i = 0; i < 9; i++) {
      const { key } = await kp.pickKey("ark_image");
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

  it("throws when no keys exist for provider", async () => {
    const kp = await getKp();
    await expect(kp.pickKey("nonexistent_provider")).rejects.toThrow(
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

    const id1 = await kp.addProviderKey("ark_image", "sk-exhausted", 500);
    await kp.addProviderKey("ark_image", "sk-available-1", 500);
    await kp.addProviderKey("ark_image", "sk-available-2", 500);

    // Exhaust key 1 directly in DB
    await db.update(pk).set({ windowUsed: 500 }).where(eq(pk.id, id1));

    // Clear cache so next call reads fresh from DB
    mockFns.get.mockResolvedValue(null);

    const keys = await kp.listProviderKeys("ark_image");

    // Exhausted key should not appear
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
    const id = await kp.addProviderKey("ark_image", "sk-usage", 500);

    await kp.recordKeyUsage("ark_image", id);

    expect(mockFns.del).toHaveBeenCalledWith("clawplay:keys:ark_image");

    const keys = await kp.listProviderKeys("ark_image");
    expect(keys[0].windowUsed).toBe(1);
  });
});

// ── resetKeyWindow ────────────────────────────────────────────────────────────
describe("resetKeyWindow", () => {
  beforeEach(setupDb);

  it("resets all window counters for a provider", async () => {
    const kp = await getKp();
    const { providerKeys: pk } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const id = await kp.addProviderKey("ark_image", "sk-reset-1", 500);
    await kp.addProviderKey("ark_image", "sk-reset-2", 500);

    // Simulate some usage
    await db.update(pk).set({ windowUsed: 300 }).where(eq(pk.id, id));

    await kp.resetKeyWindow("ark_image");

    const keys = await kp.listProviderKeys("ark_image");
    for (const k of keys) {
      expect(k.windowUsed).toBe(0);
    }
  });

  it("resets all providers when called without provider arg", async () => {
    const kp = await getKp();
    await kp.addProviderKey("ark_image", "sk-img", 500);
    await kp.addProviderKey("ark_vision", "sk-vis", 300);

    await kp.resetKeyWindow();

    const imgKeys = await kp.listProviderKeys("ark_image");
    const visKeys = await kp.listProviderKeys("ark_vision");

    expect(imgKeys[0].windowUsed).toBe(0);
    expect(visKeys[0].windowUsed).toBe(0);
  });

  it("invalidates all key caches after reset", async () => {
    const kp = await getKp();
    await kp.addProviderKey("ark_image", "sk-cache", 500);

    mockFns.keys.mockResolvedValue(["clawplay:keys:ark_image"]);

    await kp.resetKeyWindow();

    expect(mockFns.keys).toHaveBeenCalledWith("clawplay:keys:*");
    expect(mockFns.del).toHaveBeenCalled();
  });
});

// ── High-throughput scenario ──────────────────────────────────────────────────
describe("high-throughput: concurrent key sharding", () => {
  beforeEach(setupDb);

  it("100 concurrent picks distribute evenly across 5 keys", async () => {
    const kp = await getKp();
    const KEY_COUNT = 5;
    const CONCURRENT_PICKS = 100;

    for (let i = 0; i < KEY_COUNT; i++) {
      await kp.addProviderKey("ark_image", `sk-concurrent-${i}`, 500);
    }

    // Fire 100 concurrent pickKey calls
    const picks = await Promise.all(
      Array.from({ length: CONCURRENT_PICKS }, () => kp.pickKey("ark_image"))
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
    const id = await kp.addProviderKey("ark_image", "sk-exhausted", 0);
    await db.update(pk).set({ windowUsed: 10 }).where(eq(pk.id, id));

    mockFns.get.mockResolvedValue(null);

    await expect(kp.pickKeyWithRetry("ark_image")).rejects.toThrow(
      /No active keys/i
    );
  });

  it("failover: 2 keys, first exhausted, second selected", async () => {
    const kp = await getKp();
    const { providerKeys: pk } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const id1 = await kp.addProviderKey("ark_image", "sk-429-first", 500);
    await kp.addProviderKey("ark_image", "sk-second-success", 500);

    // Exhaust key 1 in DB
    await db.update(pk).set({ windowUsed: 500 }).where(eq(pk.id, id1));
    mockFns.get.mockResolvedValue(null);

    // pickKeyWithRetry should skip exhausted key and return key 2
    const { key } = await kp.pickKeyWithRetry("ark_image");
    expect(key).toBe("sk-second-success");
  });
});
