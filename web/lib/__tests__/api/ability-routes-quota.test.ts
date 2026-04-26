/**
 * Integration tests for ability routes (vision, image, llm).
 *
 * Covered scenarios:
 * 1. Pre-check quota exceeded  → 429 before provider call
 * 2. Pre-check passes, provider succeeds, quota exceeded on increment → 429
 * 3. Pre-check passes, provider succeeds, increment succeeds → 200
 * 4. Pre-check passes, provider fails → 500/503
 * 5. Missing / invalid token → 401
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from "vitest";
import { tempDbPath, cleanupDb, seedUser } from "../helpers/db";
import { makeRequest } from "../helpers/request";
import { encryptToken, hashToken } from "@/lib/token";

// ── Mock @upstash/redis ─────────────────────────────────────────────────────────
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    eval: vi.fn().mockResolvedValue(990),
  })),
}));

// ── Mock Redis quota functions ─────────────────────────────────────────────────
const checkQuotaMock = vi.hoisted(() => vi.fn());
const incrementQuotaMock = vi.hoisted(() => vi.fn());
const getQuotaMock = vi.hoisted(() => vi.fn());
const analyticsQuotaExceededMock = vi.hoisted(() => vi.fn());
const analyticsQuotaUseMock = vi.hoisted(() => vi.fn());
const analyticsQuotaErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/redis", () => ({
  checkQuota: checkQuotaMock,
  incrementQuota: incrementQuotaMock,
  getQuota: getQuotaMock,
  DEFAULT_QUOTA_FREE: 100000,
  ABILITY_COSTS: {
    "image.generate": 10,
    "vision.analyze": 5,
    "llm.generate": 5,
    "tts.synthesize": 5,
    "voice.synthesize": 5,
    "whoami": 0,
  },
  initQuota: vi.fn(),
  getRedis: vi.fn().mockReturnValue(null),
}));

// ── Mock provider modules ──────────────────────────────────────────────────────
const visionAnalyzeMock = vi.hoisted(() => vi.fn());
const imageGenerateMock = vi.hoisted(() => vi.fn());
const llmGenerateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/providers/vision", () => ({
  getVisionProvider: vi.fn(() => Promise.resolve({ analyze: visionAnalyzeMock })),
}));

vi.mock("@/lib/providers/image", () => ({
  getImageProvider: vi.fn(() => Promise.resolve({ generate: imageGenerateMock })),
}));

vi.mock("@/lib/providers/llm", () => ({
  getLLMProvider: vi.fn(() => ({ generate: llmGenerateMock })),
}));

// ── Mock next/headers (cookie always empty — use Bearer token) ─────────────────
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(() => ({ get: () => undefined })),
}));

// ── Mock analytics ─────────────────────────────────────────────────────────────
vi.mock("@/lib/analytics", () => ({
  analytics: {
    quota: {
      exceeded: analyticsQuotaExceededMock,
      use: analyticsQuotaUseMock,
      error: analyticsQuotaErrorMock,
    },
  },
}));

// ── Env vars ───────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.ARK_TTS_API_KEY = "test-tts-api-key";
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";
process.env.NODE_ENV = "test";

let dbPath: string;
let db: any;
let userId: number;
let activeAuthToken: string | null = null;

// ── Per-route module refs ──────────────────────────────────────────────────────
let POST_vision: (req: any) => Promise<Response>;
let POST_image: (req: any) => Promise<Response>;
let POST_llm: (req: any) => Promise<Response>;
let POST_tts: (req: any) => Promise<Response>;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const seeded = await seedUser(db);
  userId = seeded.user.id;

  // Import routes after DB is configured
  const visionMod = await import("@/app/api/ability/vision/analyze/route");
  POST_vision = visionMod.POST;

  const imageMod = await import("@/app/api/ability/image/generate/route");
  POST_image = imageMod.POST;

  const llmMod = await import("@/app/api/ability/llm/generate/route");
  POST_llm = llmMod.POST;

  const ttsMod = await import("@/app/api/ability/tts/synthesize/route");
  POST_tts = ttsMod.POST;
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default: quota check passes, increment succeeds
  checkQuotaMock.mockResolvedValue({ allowed: true, remaining: 999 });
  incrementQuotaMock.mockResolvedValue({ ok: true, remaining: 999 });
  getQuotaMock.mockResolvedValue({ used: 0, limit: 100000, remaining: 100000 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function authHeader() {
  if (activeAuthToken) {
    return { Authorization: `Bearer ${activeAuthToken}` };
  }
  const token = encryptToken({ userId });
  const { userTokens } = await import("@/lib/db/schema");
  await db.insert(userTokens).values({
    id: "auth-token-1",
    userId,
    tokenHash: hashToken(token),
    encryptedPayload: token,
  });
  activeAuthToken = token;
  return { Authorization: `Bearer ${token}` };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1. Auth failures
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("Auth failures (all ability routes)", () => {
  it("vision → 401 without token", async () => {
    const req = makeRequest("POST", "/api/ability/vision/analyze", {
      body: { images: ["data:image/png;base64,abc"], prompt: "describe" },
    });
    expect((await POST_vision(req)).status).toBe(401);
  });

  it("vision → 401 with invalid token", async () => {
    const req = makeRequest("POST", "/api/ability/vision/analyze", {
      body: { images: ["data:image/png;base64,abc"], prompt: "describe" },
      headers: { Authorization: "Bearer not-valid" },
    });
    expect((await POST_vision(req)).status).toBe(401);
  });

  it("image → 401 without token", async () => {
    const req = makeRequest("POST", "/api/ability/image/generate", {
      body: { prompt: "a cat" },
    });
    expect((await POST_image(req)).status).toBe(401);
  });

  it("llm → 401 without token", async () => {
    const req = makeRequest("POST", "/api/ability/llm/generate", {
      body: { prompt: "hello" },
    });
    expect((await POST_llm(req)).status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2. Pre-check quota exceeded
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("Pre-check quota exceeded (before provider call)", () => {
  it("vision → 429 when checkQuota returns allowed=false", async () => {
    checkQuotaMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      reason: "Quota exceeded.",
    });

    const req = makeRequest("POST", "/api/ability/vision/analyze", {
      body: { images: ["data:image/png;base64,abc"], prompt: "describe" },
      headers: await authHeader(),
    });
    const res = await POST_vision(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toMatch(/Quota exceeded|配额已用完/);
    expect(json.remaining).toBe(0);
  });

  it("image → 429 when checkQuota returns allowed=false", async () => {
    checkQuotaMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      reason: "Quota exceeded.",
    });

    const req = makeRequest("POST", "/api/ability/image/generate", {
      body: { prompt: "a cat" },
      headers: await authHeader(),
    });
    const res = await POST_image(req);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/Quota exceeded|配额已用完/);
  });

  it("llm → 429 when checkQuota returns allowed=false", async () => {
    checkQuotaMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      reason: "Quota exceeded.",
    });

    const req = makeRequest("POST", "/api/ability/llm/generate", {
      body: { prompt: "hello" },
      headers: await authHeader(),
    });
    const res = await POST_llm(req);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/Quota exceeded|配额已用完/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3. Provider succeeds, incrementQuota returns ok=false (CRITICAL — was not covered)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("Quota exceeded AFTER provider success (incrementQuota returns ok=false)", () => {
  it("vision → 429 when Lua returns -1 (ok=false)", async () => {
    visionAnalyzeMock.mockResolvedValueOnce({
      description: "A cat sitting on a table",
      usage: { totalTokens: 500, inputTokens: 200, outputTokens: 300 },
    });
    // incrementQuota returns ok=false (quota would be exceeded)
    incrementQuotaMock.mockResolvedValueOnce({ ok: false });

    const req = makeRequest("POST", "/api/ability/vision/analyze", {
      body: { images: ["data:image/png;base64,abc"], prompt: "describe" },
      headers: await authHeader(),
    });
    const res = await POST_vision(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toMatch(/Quota exceeded|配额已用完/);
    expect(json.remaining).toBe(0);
  });

  it("image → 429 when Lua returns -1 (ok=false)", async () => {
    imageGenerateMock.mockResolvedValueOnce({
      url: "https://example.com/image.png",
      usage: { totalTokens: 1000 },
    });
    incrementQuotaMock.mockResolvedValueOnce({ ok: false });

    const req = makeRequest("POST", "/api/ability/image/generate", {
      body: { prompt: "a cat" },
      headers: await authHeader(),
    });
    const res = await POST_image(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toMatch(/Quota exceeded|配额已用完/);
    expect(json.remaining).toBe(0);
  });

  it("llm → 429 when Lua returns -1 (ok=false)", async () => {
    llmGenerateMock.mockResolvedValueOnce({
      text: "Hello, world!",
      usage: { totalTokens: 50, inputTokens: 10, outputTokens: 40 },
    });
    incrementQuotaMock.mockResolvedValueOnce({ ok: false });

    const req = makeRequest("POST", "/api/ability/llm/generate", {
      body: { prompt: "hello" },
      headers: await authHeader(),
    });
    const res = await POST_llm(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toMatch(/Quota exceeded|配额已用完/);
    expect(json.remaining).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4. Provider succeeds, increment succeeds → 200
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("Happy path: provider succeeds, quota incremented → 200", () => {
  it("vision → 200 with _quota in response", async () => {
    visionAnalyzeMock.mockResolvedValueOnce({
      description: "A cat sitting on a table",
      usage: { totalTokens: 500, inputTokens: 200, outputTokens: 300 },
    });
    incrementQuotaMock.mockResolvedValueOnce({ ok: true, remaining: 99500 });

    const req = makeRequest("POST", "/api/ability/vision/analyze", {
      body: { images: ["data:image/png;base64,abc"], prompt: "describe" },
      headers: await authHeader(),
    });
    const res = await POST_vision(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.description).toBe("A cat sitting on a table");
    expect(json._quota).toBeDefined();
    expect(json._quota.used).toBe(500);
    expect(json._quota.remaining).toBe(99500);
  });

  it("image → 200 with _quota in response", async () => {
    imageGenerateMock.mockResolvedValueOnce({
      url: "https://example.com/image.png",
      usage: { totalTokens: 1000 },
    });
    incrementQuotaMock.mockResolvedValueOnce({ ok: true, remaining: 99000 });

    const req = makeRequest("POST", "/api/ability/image/generate", {
      body: { prompt: "a cat" },
      headers: await authHeader(),
    });
    const res = await POST_image(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe("https://example.com/image.png");
    expect(json._quota.used).toBe(1000);
    expect(json._quota.remaining).toBe(99000);
  });

  it("llm → 200 with _quota in response", async () => {
    llmGenerateMock.mockResolvedValueOnce({
      text: "Hello, world!",
      usage: { totalTokens: 50, inputTokens: 10, outputTokens: 40 },
    });
    incrementQuotaMock.mockResolvedValueOnce({ ok: true, remaining: 99950 });

    const req = makeRequest("POST", "/api/ability/llm/generate", {
      body: { prompt: "hello" },
      headers: await authHeader(),
    });
    const res = await POST_llm(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.text).toBe("Hello, world!");
    expect(json._quota.used).toBe(50);
    expect(json._quota.remaining).toBe(99950);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5. Provider rate-limited → 503 (no quota deducted)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("Provider rate-limited → 503", () => {
  it("vision → 503 on PROVIDER_RATE_LIMITED error", async () => {
    const err = new Error("rate limited");
    (err as any).code = "PROVIDER_RATE_LIMITED";
    visionAnalyzeMock.mockRejectedValueOnce(err);

    const req = makeRequest("POST", "/api/ability/vision/analyze", {
      body: { images: ["data:image/png;base64,abc"], prompt: "describe" },
      headers: await authHeader(),
    });
    const res = await POST_vision(req);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/Service busy|服务繁忙/);
  });

  it("image → 503 on PROVIDER_RATE_LIMITED error", async () => {
    const err = new Error("rate limited");
    (err as any).code = "PROVIDER_RATE_LIMITED";
    imageGenerateMock.mockRejectedValueOnce(err);

    const req = makeRequest("POST", "/api/ability/image/generate", {
      body: { prompt: "a cat" },
      headers: await authHeader(),
    });
    const res = await POST_image(req);
    expect(res.status).toBe(503);
  });

  it("llm → 503 on PROVIDER_RATE_LIMITED error", async () => {
    const err = new Error("rate limited");
    (err as any).code = "PROVIDER_RATE_LIMITED";
    llmGenerateMock.mockRejectedValueOnce(err);

    const req = makeRequest("POST", "/api/ability/llm/generate", {
      body: { prompt: "hello" },
      headers: await authHeader(),
    });
    const res = await POST_llm(req);
    expect(res.status).toBe(503);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6. TTS route quota behavior
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("TTS route quota flow", () => {
  it("returns 401 without a bearer token", async () => {
    const req = makeRequest("POST", "/api/ability/tts/synthesize", {
      body: { text: "hello", voice: "BV001" },
    });
    const res = await POST_tts(req);
    expect(res.status).toBe(401);
  });

  it("returns 429 before provider call when quota check fails", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    checkQuotaMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      reason: "Quota exceeded.",
    });

    const req = makeRequest("POST", "/api/ability/tts/synthesize", {
      body: { text: "hello world" },
      headers: await authHeader(),
    });
    const res = await POST_tts(req);
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.remaining).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(analyticsQuotaExceededMock).toHaveBeenCalledTimes(1);
    expect(analyticsQuotaUseMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("returns 429 when provider succeeds but quota increment fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ audio: "mock-audio" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    incrementQuotaMock.mockResolvedValueOnce({ ok: false });

    const req = makeRequest("POST", "/api/ability/tts/synthesize", {
      body: { text: "hello world", voice: "BV001" },
      headers: await authHeader(),
    });
    const res = await POST_tts(req);
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.remaining).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(incrementQuotaMock).toHaveBeenCalledWith(userId, 5);
    expect(analyticsQuotaExceededMock).toHaveBeenCalledTimes(1);
    expect(analyticsQuotaUseMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("returns 200 and records quota use when provider and increment succeed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ audio: "mock-audio" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    incrementQuotaMock.mockResolvedValueOnce({ ok: true, remaining: 995 });

    const req = makeRequest("POST", "/api/ability/tts/synthesize", {
      body: { text: "hello world", voice: "BV001" },
      headers: await authHeader(),
    });
    const res = await POST_tts(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.audio).toBe("mock-audio");
    expect(json._quota).toEqual({ used: 5, remaining: 995 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(incrementQuotaMock).toHaveBeenCalledWith(userId, 5);
    expect(analyticsQuotaUseMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
