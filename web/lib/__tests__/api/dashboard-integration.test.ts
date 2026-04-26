/**
 * Integration tests for the dashboard page's API data flow.
 * Verifies that GET /api/user/me and POST /api/user/token/generate
 * return the correct shapes consumed by DashboardPage client component.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tempDbPath, cleanupDb, seedUser } from "../helpers/db";
import { makeRequest } from "../helpers/request";

// ── Redis mock ────────────────────────────────────────────────────────────────
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    eval: vi.fn().mockResolvedValue(990),
  })),
}));

// ── Controllable next/headers mock ───────────────────────────────────────────
const cookieStore = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(() => ({
    get: (name: string) =>
      name === "clawplay_token" && cookieStore.token
        ? { value: cookieStore.token }
        : undefined,
  })),
}));

// ── Env vars ──────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

let dbPath: string;
let db: any;
let GET_me: (req: any) => Promise<Response>;
let POST_generate: () => Promise<Response>;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const meMod = await import("@/app/api/user/me/route");
  const generateMod = await import("@/app/api/user/token/generate/route");

  GET_me = meMod.GET;
  POST_generate = generateMod.POST;
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Dashboard data flow", () => {
  it("GET /api/user/me returns full user + quota shape for dashboard", async () => {
    const { user, email, cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("GET", "/api/user/me", { cookie });
    const res = await GET_me(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    // UserInfo shape expected by DashboardPage
    expect(json.user).toMatchObject({
      id: expect.any(Number),
      name: expect.any(String),
      role: expect.any(String),
      createdAt: expect.any(String),
    });
    // email comes from userIdentities join (nullable)
    expect(json.user.email).toBe(email);
    // QuotaInfo shape expected by DashboardPage
    expect(json.quota).toMatchObject({
      used: expect.any(Number),
      limit: expect.any(Number),
      remaining: expect.any(Number),
    });
    expect(json.user.id).toBe(user.id);
  });

  it("quota.remaining = quota.limit - quota.used", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("GET", "/api/user/me", { cookie });
    const res = await GET_me(req);
    const json = await res.json();

    expect(json.quota.remaining).toBe(json.quota.limit - json.quota.used);
  });

  it("ignores event_logs when Redis has no quota snapshot", async () => {
    const { user, cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const { eventLogs } = await import("@/lib/db/schema");
    await db.insert(eventLogs).values({
      event: "quota.use",
      userId: user.id,
      targetType: "ability",
      targetId: "llm.generate",
      metadata: JSON.stringify({ totalTokens: 20927 }),
    });

    const req = makeRequest("GET", "/api/user/me", { cookie });
    const res = await GET_me(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.quota).toEqual({
      used: 0,
      limit: 100000,
      remaining: 100000,
    });
  });

  it("POST /api/user/token/generate returns permanent token (no expiresAt)", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const res = await POST_generate();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ token: expect.any(String) });
    expect(json.token.length).toBeGreaterThan(10);
    // No expiresAt — tokens are permanent
    expect(json.expiresAt).toBeUndefined();
  });

  it("unauthenticated GET /api/user/me returns 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/user/me");
    const res = await GET_me(req);
    expect(res.status).toBe(401);
  });

  it("unauthenticated POST /api/user/token/generate returns 401", async () => {
    cookieStore.token = undefined;
    const res = await POST_generate();
    expect(res.status).toBe(401);
  });
});
