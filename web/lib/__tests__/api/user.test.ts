/**
 * Integration tests for user API routes.
 * Uses a real SQLite temp DB; Redis and next/headers are mocked.
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
// We use vi.hoisted so the variable is in scope when vi.mock factory runs
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
let POST_revoke: (req: any) => Promise<Response>;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const meMod = await import("@/app/api/user/me/route");
  const generateMod = await import("@/app/api/user/token/generate/route");
  const revokeMod = await import("@/app/api/user/token/revoke/route");

  GET_me = meMod.GET;
  POST_generate = generateMod.POST;
  POST_revoke = revokeMod.POST;
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/user/me", () => {
  it("authenticated → 200 with user info and quota", async () => {
    const { user, email, cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("GET", "/api/user/me", { cookie });
    const res = await GET_me(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user.id).toBe(user.id);
    expect(json.user.email).toBe(email); // email comes from userIdentities join
    expect(json.quota).toMatchObject({ limit: 1000, used: 0, remaining: 1000 });
  });

  it("no cookie → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/user/me");
    const res = await GET_me(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/user/token/generate", () => {
  it("authenticated → 200, returns encrypted token, DB record created", async () => {
    const { user, cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const res = await POST_generate();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(typeof json.token).toBe("string");
    expect(json.token.length).toBeGreaterThan(10);
    // Tokens are permanent — no expiresAt field

    // Verify DB record
    const { userTokens } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const record = await db.query.userTokens.findFirst({
      where: eq(userTokens.userId, user.id),
    });
    expect(record).toBeTruthy();
    expect(record.revokedAt).toBeNull();
  });

  it("no cookie → 401", async () => {
    cookieStore.token = undefined;
    const res = await POST_generate();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/user/token/revoke", () => {
  it("revoke existing token → 200, DB revokedAt set", async () => {
    const { user, cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    // Generate a token first
    const genRes = await POST_generate();
    expect(genRes.status).toBe(200);

    // Find the token record
    const { userTokens } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const record = await db.query.userTokens.findFirst({
      where: eq(userTokens.userId, user.id),
    });

    // Revoke it
    const req = makeRequest("POST", "/api/user/token/revoke", {
      body: { tokenId: record.id },
      cookie,
    });
    const res = await POST_revoke(req);
    expect(res.status).toBe(200);

    // Verify DB updated
    const updated = await db.query.userTokens.findFirst({
      where: eq(userTokens.id, record.id),
    });
    expect(updated.revokedAt).not.toBeNull();
  });

  it("revoke non-existent tokenId → 404", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("POST", "/api/user/token/revoke", {
      body: { tokenId: "nonexistent-id" },
      cookie,
    });
    const res = await POST_revoke(req);
    expect(res.status).toBe(404);
  });
});
