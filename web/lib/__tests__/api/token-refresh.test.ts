/**
 * Integration tests for POST /api/user/token/refresh
 * Uses a real SQLite temp DB; Redis and next/headers are mocked.
 * This route has 0% coverage — tested for the first time here.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, and, isNull } from "drizzle-orm";
import { tempDbPath, cleanupDb, seedUser } from "../helpers/db";
import { makeRequest } from "../helpers/request";
import { encryptToken } from "@/lib/token";

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
let POST_refresh: (req: any) => Promise<Response>;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const refreshMod = await import("@/app/api/user/token/refresh/route");
  POST_refresh = refreshMod.POST;
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/user/token/refresh", () => {
  it("valid token → 200, returns new encrypted token, old token revoked", async () => {
    const { user } = await seedUser(db);

    // Create a CLAWPLAY_TOKEN (AES-256-GCM encrypted)
    const encryptedToken = encryptToken({ userId: user.id });

    // Also store it in DB (mimics real generate flow)
    const { userTokens } = await import("@/lib/db/schema");
    const { hashToken } = await import("@/lib/token");
    const tokenHash = hashToken(encryptedToken);
    await db.insert(userTokens).values({
      id: "token-1",
      userId: user.id,
      tokenHash,
      encryptedPayload: encryptedToken,
    });

    const req = makeRequest("POST", "/api/user/token/refresh", {
      headers: { Authorization: `Bearer ${encryptedToken}` },
    });
    const res = await POST_refresh(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(typeof json.token).toBe("string");
    expect(json.token.length).toBeGreaterThan(10);
    expect(json.refreshed).toBe(true);
    expect(json.command).toContain("export CLAWPLAY_TOKEN=");

    // Verify old token is revoked
    const oldRecord = await db.query.userTokens.findFirst({
      where: (t: any, { eq }: any) => eq(t.id, "token-1"),
    });
    expect(oldRecord.revokedAt).not.toBeNull();

    // Verify new token is stored (not revoked)
    const newRecord = await db.query.userTokens.findFirst({
      where: (t: any, { and, isNull: isn }: any) =>
        and(isn(t.revokedAt), eq(t.userId, user.id)),
    });
    expect(newRecord.id).not.toBe("token-1");
    expect(newRecord.encryptedPayload).toBe(json.token);
  });

  it("no token (no auth header, no cookie) → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("POST", "/api/user/token/refresh");
    const res = await POST_refresh(req);
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toMatch(/token/i);
  });

  it("invalid/garbage token → 401", async () => {
    const req = makeRequest("POST", "/api/user/token/refresh", {
      headers: { Authorization: "Bearer not-a-valid-base64!!!" },
    });
    const res = await POST_refresh(req);
    expect(res.status).toBe(401);
  });

  it("token for non-existent user → 404", async () => {
    // Create a token with a userId that doesn't exist
    const fakeToken = encryptToken({ userId: 999999 });
    const req = makeRequest("POST", "/api/user/token/refresh", {
      headers: { Authorization: `Bearer ${fakeToken}` },
    });
    const res = await POST_refresh(req);
    expect(res.status).toBe(404);
  });
});
