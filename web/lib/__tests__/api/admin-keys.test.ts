/**
 * Integration tests for /api/admin/keys route (Phase 2 — ability-based).
 *
 * Covers:
 * - GET: list keys by ability (admin only, no plaintext exposure)
 * - POST: add key with provider+ability (admin only)
 * - DELETE: revoke key by id (admin only)
 * - Auth: admin vs regular user vs unauthenticated
 * - Validation: invalid provider/ability, missing fields
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { tempDbPath, cleanupDb, seedUser, seedAdmin } from "../helpers/db";
import { makeRequest } from "../helpers/request";

// ── Redis mock ──────────────────────────────────────────────────────────────
const mockFns = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  keys: vi.fn().mockResolvedValue([]),
  setex: vi.fn().mockResolvedValue("OK"),
}));

const cookieStore = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(() => ({
    get: (name: string) =>
      name === "clawplay_token" && cookieStore.token
        ? { value: cookieStore.token }
        : undefined,
  })),
}));

vi.mock("@/lib/analytics", () => ({
  analytics: { skill: { approve: vi.fn(), reject: vi.fn() } },
  logEvent: vi.fn(),
  incrementSkillStat: vi.fn(),
}));

process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

let dbPath: string;
let db: any;
let adminCookie: string;
let userCookie: string;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  vi.unmock("@upstash/redis");
  vi.mock("@upstash/redis", () => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    class MockRedis {
      get = mockFns.get;
      set = mockFns.set;
      del = mockFns.del;
      keys = mockFns.keys;
      setex = mockFns.setex;
    }
    return { Redis: MockRedis };
  });

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const admin = await seedAdmin(db, { email: "admin@example.com" });
  const user = await seedUser(db, { email: "user@example.com" });
  adminCookie = admin.cookie;
  userCookie = user.cookie;
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

async function getHandler() {
  const mod = await import("@/app/api/admin/keys/route");
  return mod;
}

// ── GET /api/admin/keys ─────────────────────────────────────────────────────
describe("GET /api/admin/keys", () => {
  beforeAll(async () => {
    const { addProviderKey } = await import("@/lib/providers/key-pool");
    await addProviderKey("ark", "image", "sk-admin-test-1", { quota: 500 });
    await addProviderKey("ark", "image", "sk-admin-test-2", { quota: 600 });
    await addProviderKey("ark", "vision", "sk-vis-test", { quota: 300 });
  });

  it("admin → 200, returns keys for specified ability", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/keys?ability=image", {
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    // Response is grouped by ability
    expect(json.grouped?.image).toHaveLength(2);
    expect(json.keys).toHaveLength(2);
    for (const k of json.keys) {
      expect(k).not.toHaveProperty("encryptedKey");
      expect(k).not.toHaveProperty("decryptedKey");
      expect(k.keyHash).toMatch(/^[a-f0-9]{64}$/);
      expect(k.quota).toBeGreaterThan(0);
      expect(k.provider).toBe("ark");
      expect(k.ability).toBe("image");
    }
  });

  it("admin → 200, returns empty array for ability with no keys", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/keys?ability=llm", {
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.grouped?.llm ?? []).toHaveLength(0);
  });

  it("admin → 200, no ability param returns all keys grouped", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/keys", {
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    // Should have image + vision keys from beforeAll
    expect(json.keys.length).toBeGreaterThanOrEqual(3);
    expect(json.grouped.image).toHaveLength(2);
    expect(json.grouped.vision).toHaveLength(1);
  });

  it("admin → 400, invalid ability", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/keys?ability=invalid", {
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid.*ability|无效.*ability/i);
  });

  it("regular user → 403 Forbidden", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/keys?ability=image", {
      cookie: userCookie,
    });
    const h = await getHandler();
    const res = await h.GET(req);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401 Unauthorized", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/admin/keys?ability=image");
    const h = await getHandler();
    const res = await h.GET(req);
    expect(res.status).toBe(401);
  });
});

// ── POST /api/admin/keys ────────────────────────────────────────────────────
describe("POST /api/admin/keys", () => {
  it("admin → 201, adds a new key", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark", ability: "image", key: "sk-newly-added", quota: 500 },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.id).toBeGreaterThan(0);
  });

  it("admin → 201, quota defaults to 500", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "gemini", ability: "llm", key: "sk-with-default-quota" },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);

    expect(res.status).toBe(201);

    const { listProviderKeys } = await import("@/lib/providers/key-pool");
    const allKeys = await listProviderKeys();
    const added = allKeys.find(k => k.keyHash && k.ability === "llm" && k.provider === "gemini");
    expect(added?.quota).toBe(500);
  });

  it("admin → 201, adds a key with endpoint and modelName", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: {
        provider: "ark",
        ability: "vision",
        key: "sk-with-endpoint",
        endpoint: "https://custom.endpoint.com/api",
        modelName: "custom-model",
        quota: 1000,
      },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("admin → 409, duplicate key hash", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req1 = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark", ability: "llm", key: "sk-dup-test", quota: 500 },
      cookie: adminCookie,
    });
    const req2 = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark", ability: "llm", key: "sk-dup-test", quota: 500 },
      cookie: adminCookie,
    });
    const h1 = await getHandler();
    await h1.POST(req1);

    const h2 = await getHandler();
    const res = await h2.POST(req2);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/already exists|此密钥已存在/i);
  });

  // ── Same key across different abilities ────────────────────────────────────
  it("admin → 201, same key for ark+llm", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark", ability: "llm", key: "sk-cross-ability-test", quota: 500 },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("admin → 201, same key for ark+image (different ability)", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    // Ark LLM key already added in previous test — now add ark Image with SAME key
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark", ability: "image", key: "sk-cross-ability-test", quota: 500 },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("admin → 201, same key for ark+vision (third ability)", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark", ability: "vision", key: "sk-cross-ability-test", quota: 500 },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("all three abilities stored correctly with same key", async () => {
    const { listProviderKeys } = await import("@/lib/providers/key-pool");
    const allKeys = await listProviderKeys();
    // Only count keys with sk-cross-ability-test hash
    const arkKeys = allKeys.filter(k =>
      k.provider === "ark" && k.ability !== undefined
    );
    // The same key should appear in all three abilities
    const hashGroups: Record<string, string[]> = {};
    for (const k of arkKeys) {
      if (!hashGroups[k.keyHash]) hashGroups[k.keyHash] = [];
      hashGroups[k.keyHash].push(k.ability);
    }
    // Find the group with all three abilities
    const fullGroup = Object.values(hashGroups).find(abilities =>
      abilities.includes("llm") && abilities.includes("image") && abilities.includes("vision")
    );
    expect(fullGroup).toBeDefined();
    expect(fullGroup!.sort()).toEqual(["image", "llm", "vision"]);
  });

  it("admin → 409, same key for same (ark, llm) again", async () => {
    // Already added ark+llm with sk-cross-ability-test above — should still 409
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark", ability: "llm", key: "sk-cross-ability-test", quota: 500 },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(409);
  });

  it("admin → 201, same key for gemini+llm (different provider)", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "gemini", ability: "llm", key: "sk-cross-ability-test", quota: 500 },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(201);
  });

  it("admin → 400, invalid provider", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "invalid_provider", ability: "llm", key: "sk-foo" },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid.*provider|无效.*provider/i);
  });

  it("admin → 400, invalid ability", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark", ability: "invalid_ability", key: "sk-foo" },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid.*ability|无效.*ability/i);
  });

  it("admin → 400, missing required fields", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark" }, // missing 'ability' and 'key'
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(400);
  });

  it("admin → 400, missing ability", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark", key: "sk-foo" }, // missing 'ability'
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(400);
  });

  it("admin → 400, negative quota", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark", ability: "llm", key: "sk-foo", quota: -10 },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(400);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark", ability: "llm", key: "sk-hack" },
      cookie: userCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark", ability: "llm", key: "sk-hack" },
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/admin/keys ────────────────────────────────────────────────────
describe("DELETE /api/admin/keys", () => {
  let keyIdToDelete: number;

  beforeAll(async () => {
    const { addProviderKey } = await import("@/lib/providers/key-pool");
    const id = await addProviderKey("ark", "llm", "sk-to-delete-in-test", { quota: 500 });
    keyIdToDelete = id;
  });

  it("admin → 200, deletes key by id", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("DELETE", `/api/admin/keys?id=${keyIdToDelete}`, {
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.DELETE(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // Verify key is removed from DB
    const { listProviderKeys } = await import("@/lib/providers/key-pool");
    const allKeys = await listProviderKeys();
    const deleted = allKeys.find(k => k.id === keyIdToDelete);
    expect(deleted).toBeUndefined();
  });

  it("admin → 400, missing id param", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("DELETE", "/api/admin/keys", {
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.DELETE(req);
    expect(res.status).toBe(400);
  });

  it("admin → 400, invalid id", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("DELETE", "/api/admin/keys?id=abc", {
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.DELETE(req);
    expect(res.status).toBe(400);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("DELETE", `/api/admin/keys?id=${keyIdToDelete}`, {
      cookie: userCookie,
    });
    const h = await getHandler();
    const res = await h.DELETE(req);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("DELETE", `/api/admin/keys?id=${keyIdToDelete}`);
    const h = await getHandler();
    const res = await h.DELETE(req);
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/admin/keys — toggle enabled ────────────────────────────────────
describe("PATCH /api/admin/keys — toggle key enabled state", () => {
  let keyIdToToggle: number;

  beforeAll(async () => {
    const { addProviderKey } = await import("@/lib/providers/key-pool");
    const id = await addProviderKey("gemini", "vision", "sk-to-toggle-in-test", { quota: 500 });
    keyIdToToggle = id;
  });

  it("admin → 200, disables an enabled key", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/admin/keys", {
      body: { id: keyIdToToggle, enabled: false },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.PATCH(req);

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    const { listProviderKeys } = await import("@/lib/providers/key-pool");
    const allKeys = await listProviderKeys();
    const toggled = allKeys.find(k => k.id === keyIdToToggle);
    expect(toggled?.enabled).toBe(false);
  });

  it("admin → 200, re-enables a disabled key", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/admin/keys", {
      body: { id: keyIdToToggle, enabled: true },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.PATCH(req);

    expect(res.status).toBe(200);
    const { listProviderKeys } = await import("@/lib/providers/key-pool");
    const allKeys = await listProviderKeys();
    const toggled = allKeys.find(k => k.id === keyIdToToggle);
    expect(toggled?.enabled).toBe(true);
  });

  it("admin → 400, missing id", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/admin/keys", {
      body: { enabled: false },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.PATCH(req);
    expect(res.status).toBe(400);
  });

  it("admin → 400, missing enabled", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/admin/keys", {
      body: { id: keyIdToToggle },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.PATCH(req);
    expect(res.status).toBe(400);
  });

  it("admin → 400, enabled is not boolean", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/admin/keys", {
      body: { id: keyIdToToggle, enabled: "yes" },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.PATCH(req);
    expect(res.status).toBe(400);
  });

  it("admin → 400, id is not number", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/admin/keys", {
      body: { id: "abc", enabled: false },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.PATCH(req);
    expect(res.status).toBe(400);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/admin/keys", {
      body: { id: keyIdToToggle, enabled: false },
      cookie: userCookie,
    });
    const h = await getHandler();
    const res = await h.PATCH(req);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("PATCH", "/api/admin/keys", {
      body: { id: keyIdToToggle, enabled: false },
    });
    const h = await getHandler();
    const res = await h.PATCH(req);
    expect(res.status).toBe(401);
  });
});
