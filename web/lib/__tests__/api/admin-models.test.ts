/**
 * Unit + integration tests for model-config.ts
 *
 * Covers:
 * - setModelConfig: upsert, clear (delete)
 * - listModelConfigs: returns envDefault for each row
 * - Auth: admin vs regular user vs unauthenticated
 * - Validation: invalid provider/ability, missing fields
 * - DELETE resets to env default
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tempDbPath, cleanupDb, seedUser, seedAdmin } from "../helpers/db";
import { makeRequest } from "../helpers/request";

// ── Env ───────────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.IMAGE_MODEL_ARK = "test-ark-image-model";
process.env.LLM_MODEL_ARK = "test-ark-llm-model";
process.env.VISION_MODEL_ARK = "test-ark-vision-model";
process.env.IMAGE_MODEL_GEMINI = "test-gemini-image-model";
process.env.LLM_MODEL_GEMINI = "test-gemini-llm-model";
process.env.VISION_MODEL_GEMINI = "test-gemini-vision-model";
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

// ── Redis mock ────────────────────────────────────────────────────────────────
const mockFns = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  keys: vi.fn().mockResolvedValue([]),
  setex: vi.fn().mockResolvedValue("OK"),
}));

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

// ── Cookie store mock ────────────────────────────────────────────────────────
const cookieStore = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(() => ({
    get: (name: string) =>
      name === "clawplay_token" && cookieStore.token
        ? { value: cookieStore.token }
        : undefined,
  })),
}));

// ── Module-level state ────────────────────────────────────────────────────────
let dbPath: string;
let db: any;
let adminCookie: string;
let userCookie: string;

beforeEach(() => {
  vi.clearAllMocks();
  mockFns.get.mockResolvedValue(null);
  mockFns.setex.mockResolvedValue("OK");
  mockFns.del.mockResolvedValue(1);
  mockFns.keys.mockResolvedValue([]);
  cookieStore.token = undefined;
});

afterEach(() => {
  cleanupDb(dbPath);
});

async function setupDb() {
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
}

async function seedUsers() {
  const admin = await seedAdmin(db, { email: "admin@example.com" });
  const user = await seedUser(db, { email: "user@example.com" });
  adminCookie = admin.cookie;
  userCookie = user.cookie;
}

async function getHandler() {
  const mod = await import("@/app/api/admin/models/route");
  return mod;
}

// ── GET /api/admin/models ───────────────────────────────────────────────────
describe("GET /api/admin/models", () => {
  beforeEach(async () => {
    await setupDb();
    await seedUsers();
  });

  it("admin → 200, returns model configs with envDefault", async () => {
    // Init from env (auto on import) should have seeded defaults
    const { listModelConfigs } = await import("@/lib/providers/model-config");
    const configs = await listModelConfigs();

    // After init, there should be entries for each provider_ability combo
    expect(configs.length).toBeGreaterThan(0);

    for (const c of configs) {
      expect(c).toHaveProperty("envDefault");
      expect(typeof c.envDefault).toBe("string");
      expect(c.envDefault.length).toBeGreaterThan(0);
    }
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/models", {
      cookie: userCookie,
    });
    const h = await getHandler();
    const res = await h.GET();
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/admin/models");
    const h = await getHandler();
    const res = await h.GET();
    expect(res.status).toBe(401);
  });
});

// ── POST /api/admin/models ─────────────────────────────────────────────────
describe("POST /api/admin/models", () => {
  beforeEach(async () => {
    await setupDb();
    await seedUsers();
  });

  it("admin → 200, sets a custom model name", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/models", {
      body: { provider: "ark_image", ability: "image", modelName: "my-custom-image-model" },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // Verify in DB
    const { listModelConfigs } = await import("@/lib/providers/model-config");
    const configs = await listModelConfigs();
    const arkImg = configs.find(c => c.provider === "ark_image" && c.ability === "image");
    expect(arkImg).toBeDefined();
    expect(arkImg!.modelName).toBe("my-custom-image-model");
    expect(arkImg!.isDefault).toBe(false);
  });

  it("admin → 200, upserts: updating existing sets new value", async () => {
    const mc = await import("@/lib/providers/model-config");

    // Set initial value
    await mc.setModelConfig("ark_image", "image", "initial-model");

    // Update via API
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/models", {
      body: { provider: "ark_image", ability: "image", modelName: "updated-model" },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(200);

    const configs = await mc.listModelConfigs();
    const arkImg = configs.find(c => c.provider === "ark_image" && c.ability === "image");
    expect(arkImg!.modelName).toBe("updated-model");
  });

  it("admin → 400, invalid provider/ability combo", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/models", {
      body: { provider: "ark_image", ability: "invalid_ability", modelName: "foo" },
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/provider|ability|invalid/i);
  });

  it("admin → 400, missing required fields", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/models", {
      body: { provider: "ark_image" }, // missing ability + modelName
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(400);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/admin/models", {
      body: { provider: "ark_image", ability: "image", modelName: "hacked" },
      cookie: userCookie,
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("POST", "/api/admin/models", {
      body: { provider: "ark_image", ability: "image", modelName: "hacked" },
    });
    const h = await getHandler();
    const res = await h.POST(req);
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/admin/models ─────────────────────────────────────────────────
describe("DELETE /api/admin/models", () => {
  beforeEach(async () => {
    await setupDb();
    await seedUsers();
  });

  it("admin → 200, clears a model config (resets to env default)", async () => {
    const mc = await import("@/lib/providers/model-config");

    // First set a custom model
    await mc.setModelConfig("ark_llm", "llm", "my-custom-llm-model");

    // Verify it was set
    let configs = await mc.listModelConfigs();
    const arkLlm = configs.find(c => c.provider === "ark_llm" && c.ability === "llm");
    expect(arkLlm!.modelName).toBe("my-custom-llm-model");

    // Delete via API
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("DELETE", "/api/admin/models?provider=ark_llm&ability=llm", {
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.DELETE(req);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    // Verify cleared — row should be gone (env default is used)
    configs = await mc.listModelConfigs();
    const row = configs.find(c => c.provider === "ark_llm" && c.ability === "llm");
    // After clear (delete), the row is removed, so listModelConfigs won't include it
    expect(row).toBeUndefined();
  });

  it("admin → 400, missing provider/ability params", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("DELETE", "/api/admin/models", {
      cookie: adminCookie,
    });
    const h = await getHandler();
    const res = await h.DELETE(req);
    expect(res.status).toBe(400);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("DELETE", "/api/admin/models?provider=ark_image&ability=image", {
      cookie: userCookie,
    });
    const h = await getHandler();
    const res = await h.DELETE(req);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("DELETE", "/api/admin/models?provider=ark_image&ability=image");
    const h = await getHandler();
    const res = await h.DELETE(req);
    expect(res.status).toBe(401);
  });
});
