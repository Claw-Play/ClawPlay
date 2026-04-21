/**
 * Integration tests for GET /api/ability/check
 * Uses real SQLite temp DB; Redis is mocked.
 * No external provider calls — pure token + quota logic.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tempDbPath, cleanupDb, seedUser } from "../helpers/db";
import { makeRequest } from "../helpers/request";
import { encryptToken, hashToken } from "@/lib/token";

// ── Mock @/lib/redis directly — avoids Upstash singleton issues
const getQuotaMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/redis", () => ({
  getQuota: getQuotaMock,
  checkQuota: vi.fn(),
  incrementQuota: vi.fn(),
  checkAndIncrementQuota: vi.fn(),
  ABILITY_COSTS: {},
  DEFAULT_QUOTA_FREE: 100000,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(() => ({ get: () => undefined })),
}));

process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

let dbPath: string;
let db: any;
let GET_check: (req: any) => Promise<Response>;
let userId: number;
let tokenSeq = 0;
let activeToken: string | null = null;

async function makeToken(overrides: Partial<{ userId: number }> = {}) {
  const tokenUserId = overrides.userId ?? userId;
  if (tokenUserId === userId && activeToken) {
    return activeToken;
  }
  const token = encryptToken({ userId: tokenUserId });
  if (tokenUserId === userId) {
    const { userTokens } = await import("@/lib/db/schema");
    await db.insert(userTokens).values({
      id: `ability-check-token-${++tokenSeq}`,
      userId: tokenUserId,
      tokenHash: hashToken(token),
      encryptedPayload: token,
    });
    activeToken = token;
  }
  return token;
}

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const { GET } = await import("@/app/api/ability/check/route");
  GET_check = GET;

  const seeded = await seedUser(db);
  userId = seeded.user.id;
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
});

describe("GET /api/ability/check", () => {
  it("no token → 401", async () => {
    const req = makeRequest("GET", "/api/ability/check");
    const res = await GET_check(req);
    expect(res.status).toBe(401);
  });

  it("invalid token → 401", async () => {
    const req = makeRequest("GET", "/api/ability/check", {
      headers: { Authorization: "Bearer not-a-real-token" },
    });
    const res = await GET_check(req);
    expect(res.status).toBe(401);
  });

  it("valid token (no exp field) → 200 (tokens are permanent)", async () => {
    // Tokens are now permanent — exp field is optional and ignored
    const token = await makeToken();
    const req = makeRequest("GET", "/api/ability/check", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET_check(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.userId).toBe(userId);
  });

  it("valid token, Redis has quota → 200 with source=redis", async () => {
    getQuotaMock.mockResolvedValueOnce({ used: 5, limit: 1000, remaining: 995 });

    const token = await makeToken();
    const req = makeRequest("GET", "/api/ability/check", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET_check(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.userId).toBe(userId);
    expect(json.used).toBe(5);
    expect(json.limit).toBe(1000);
    expect(json.remaining).toBe(995);
    expect(json.source).toBe("redis");
  });

  it("valid token, Redis unavailable (dev) → 200 with source=none", async () => {
    getQuotaMock.mockResolvedValueOnce(null);

    const token = await makeToken();
    const req = makeRequest("GET", "/api/ability/check", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET_check(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.source).toBe("none");
    expect(json.userId).toBe(userId);
    expect(typeof json.used).toBe("number");
    expect(typeof json.limit).toBe("number");
  });

  it("token without a DB record → 401", async () => {
    const token = await makeToken({ userId: 99999 });
    const req = makeRequest("GET", "/api/ability/check", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET_check(req);
    expect(res.status).toBe(401);
  });

  it("revoked token → 401", async () => {
    const token = await makeToken();
    const { userTokens } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(userTokens).set({ revokedAt: new Date() }).where(eq(userTokens.tokenHash, hashToken(token)));

    const req = makeRequest("GET", "/api/ability/check", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET_check(req);
    expect(res.status).toBe(401);
  });
});
