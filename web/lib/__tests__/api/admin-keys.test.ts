/**
 * Integration tests for /api/admin/keys route.
 *
 * Covers:
 * - GET: list keys (admin only, no plaintext exposure)
 * - POST: add key (admin only)
 * - DELETE: revoke key (admin only)
 * - Auth: admin vs regular user vs unauthenticated
 * - Validation: invalid provider, missing fields
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { tempDbPath, cleanupDb, seedUser, seedAdmin } from "../helpers/db";
import { makeRequest } from "../helpers/request";

// ── Redis mock — hoisted so mock fns survive vi.resetModules() ─────────────────
const mockFns = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  keys: vi.fn().mockResolvedValue([]),
  setex: vi.fn().mockResolvedValue("OK"),
}));

// ── Cookie store mock ─────────────────────────────────────────────────────────
const cookieStore = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(() => ({
    get: (name: string) =>
      name === "clawplay_token" && cookieStore.token
        ? { value: cookieStore.token }
        : undefined,
  })),
}));

// ── Analytics mock ────────────────────────────────────────────────────────────
vi.mock("@/lib/analytics", () => ({
  analytics: { skill: { approve: vi.fn(), reject: vi.fn() } },
  logEvent: vi.fn(),
  incrementSkillStat: vi.fn(),
}));

// ── Env ───────────────────────────────────────────────────────────────────────
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

  // Re-apply Redis mock after resetModules (factory must return a class/function)
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

  // Seed admin + regular user
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

// ── Helpers: re-import handler with fresh mocks ────────────────────────────────
async function getHandler() {
  const mod = await import("@/app/api/admin/keys/route");
  return mod;
}

// ── GET /api/admin/keys ─────────────────────────────────────────────────────
describe("GET /api/admin/keys", () => {
  beforeAll(async () => {
    // Seed some keys
    const { addProviderKey } = await import("@/lib/providers/key-pool");
    await addProviderKey("ark_image", "sk-admin-test-1", 500);
    await addProviderKey("ark_image", "sk-admin-test-2", 600);
    await addProviderKey("ark_vision", "sk-vis-test", 300);
  });

  it("admin → 200, returns keys for specified provider", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/keys?provider=ark_image", {
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.provider).toBe("ark_image");
    expect(json.keys).toHaveLength(2);
    // No plaintext key exposed
    for (const k of json.keys) {
      expect(k).not.toHaveProperty("encryptedKey");
      expect(k).not.toHaveProperty("decryptedKey");
      expect(k.keyHash).toMatch(/^[a-f0-9]{64}$/);
      expect(k.quota).toBeGreaterThan(0);
    }
  });

  it("admin → 200, returns empty array for provider with no keys", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/keys?provider=gemini_llm", {
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.keys).toHaveLength(0);
  });

  it("regular user → 403 Forbidden", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/keys?provider=ark_image", {
      cookie: userCookie,
    });
    const h = await getHandler();
    const res = await h.GET(req);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401 Unauthorized", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/admin/keys?provider=ark_image");
    const h = await getHandler();
    const res = await h.GET(req);
    expect(res.status).toBe(401);
  });

  it("missing provider param → 400", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/keys", {
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/provider/i);
  });
});

// ── POST /api/admin/keys ────────────────────────────────────────────────────
describe("POST /api/admin/keys", () => {
  it("admin → 201, adds a new key", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark_image", key: "sk-newly-added", quota: 500 },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.id).toBeGreaterThan(0);
    expect(json.message).toContain("ark_image");
  });

  it("admin → 201, quota defaults to 500", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark_image", key: "sk-with-default-quota" },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);

    expect(res.status).toBe(201);

    // Verify in DB
    const { listProviderKeys } = await import("@/lib/providers/key-pool");
    const keys = await listProviderKeys("ark_image");
    // Find the key we just added (it will be the last one)
    const added = keys[keys.length - 1];
    expect(added.quota).toBe(500); // default quota
  });

  it("admin → 409, duplicate key hash", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    // Must create fresh requests — body stream can only be consumed once
    const req1 = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark_image", key: "sk-duplicate-test", quota: 500 },
      cookie: adminCookie,
    });
    const req2 = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark_image", key: "sk-duplicate-test", quota: 500 },
      cookie: adminCookie,
    });
    const h1 = await getHandler();
    // First add succeeds
    await h1.POST(req1);

    // Second add with same key fails — fresh handler import
    const h2 = await getHandler();
    const res = await h2.POST(req2);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/already exists/i);
  });

  it("admin → 400, invalid provider", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "invalid_provider", key: "sk-foo" },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/provider/i);
  });

  it("admin → 400, missing required fields", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark_image" }, // missing 'key'
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(400);
  });

  it("admin → 400, negative quota", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark_image", key: "sk-foo", quota: -10 },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(400);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark_image", key: "sk-hack" },
      cookie: userCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("POST", "/api/admin/keys", {
      body: { provider: "ark_image", key: "sk-hack" },
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/admin/keys ───────────────────────────────────────────────────
describe("DELETE /api/admin/keys", () => {
  let keyHashToRevoke: string;

  beforeAll(async () => {
    // Add a key to revoke
    const { addProviderKey, listProviderKeys } = await import("@/lib/providers/key-pool");
    await addProviderKey("ark_image", "sk-to-revoke-in-test", 500);
    const keys = await listProviderKeys("ark_image");
    const toRevoke = keys.find(k => k.enabled === true && k.quota === 500);
    keyHashToRevoke = toRevoke!.keyHash;
  });

  it("admin → 200, revokes key by hash", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest(
      "DELETE",
      `/api/admin/keys?provider=ark_image&keyHash=${keyHashToRevoke}`,
      { cookie: adminCookie }
    );
    const h = await getHandler();
    const res = await h.DELETE(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // Verify in DB
    const { listProviderKeys } = await import("@/lib/providers/key-pool");
    const keys = await listProviderKeys("ark_image");
    const revoked = keys.find(k => k.keyHash === keyHashToRevoke);
    expect(revoked!.enabled).toBe(false);
  });

  it("admin → 400, missing params", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("DELETE", "/api/admin/keys", {
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.DELETE(req);
    expect(res.status).toBe(400);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest(
      "DELETE",
      `/api/admin/keys?provider=ark_image&keyHash=${"a".repeat(64)}`,
      { cookie: userCookie }
    );
    const h = await getHandler();
    const res = await h.DELETE(req);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest(
      "DELETE",
      `/api/admin/keys?provider=ark_image&keyHash=${"a".repeat(64)}`
    );
    const h = await getHandler();
    const res = await h.DELETE(req);
    expect(res.status).toBe(401);
  });
});
