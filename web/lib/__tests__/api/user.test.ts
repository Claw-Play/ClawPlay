/**
 * Integration tests for user API routes.
 * Uses a real SQLite temp DB; Redis and next/headers are mocked.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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
let PATCH_me: (req: any) => Promise<Response>;
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
  PATCH_me = meMod.PATCH;
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
    expect(json.quota).toMatchObject({ limit: 100000, used: 0, remaining: 100000 });
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

  it("unauthenticated revoke → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("POST", "/api/user/token/revoke");
    const res = await POST_revoke(req);
    expect(res.status).toBe(401);
  });

  it("already revoked token → 404", async () => {
    const { user, cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    // Generate a token
    const genRes = await POST_generate();
    expect(genRes.status).toBe(200);

    const { userTokens } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const record = await db.query.userTokens.findFirst({
      where: eq(userTokens.userId, user.id),
    });

    // Revoke it first time
    const req1 = makeRequest("POST", "/api/user/token/revoke", {
      body: { tokenId: record.id },
      cookie,
    });
    expect((await POST_revoke(req1)).status).toBe(200);

    // Try to revoke again — should be 404
    const req2 = makeRequest("POST", "/api/user/token/revoke", {
      body: { tokenId: record.id },
      cookie,
    });
    const res2 = await POST_revoke(req2);
    expect(res2.status).toBe(404);
  });

  it("revoke current active token (no tokenId) → 200", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    // Generate a token
    const genRes = await POST_generate();
    expect(genRes.status).toBe(200);

    // Revoke without providing tokenId (should revoke current active)
    const req = makeRequest("POST", "/api/user/token/revoke", { cookie });
    const res = await POST_revoke(req);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/user/me — Bearer token", () => {
  it("Bearer CLAWPLAY_TOKEN (AES-256-GCM) → 200", async () => {
    const { user } = await seedUser(db);

    // Create an encrypted CLAWPLAY_TOKEN
    const encryptedToken = encryptToken({ userId: user.id });

    // Store it in DB
    const { userTokens } = await import("@/lib/db/schema");
    const { hashToken } = await import("@/lib/token");
    await db.insert(userTokens).values({
      id: "bearer-token-1",
      userId: user.id,
      tokenHash: hashToken(encryptedToken),
      encryptedPayload: encryptedToken,
    });

    cookieStore.token = undefined; // no JWT cookie
    const req = makeRequest("GET", "/api/user/me", {
      headers: { Authorization: `Bearer ${encryptedToken}` },
    });
    const res = await GET_me(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user.id).toBe(user.id);
  });

  it("Bearer token with invalid format → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/user/me", {
      headers: { Authorization: "Bearer not-valid-base64!!!" },
    });
    const res = await GET_me(req);
    expect(res.status).toBe(401);
  });

  it("Bearer token for non-existent user → 404", async () => {
    const fakeToken = encryptToken({ userId: 999998 });
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/user/me", {
      headers: { Authorization: `Bearer ${fakeToken}` },
    });
    const res = await GET_me(req);
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/user/me", () => {
  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("PATCH", "/api/user/me", { body: { name: "New Name" } });
    const res = await PATCH_me(req);
    expect(res.status).toBe(401);
  });

  it("update name successfully → 200", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("PATCH", "/api/user/me", {
      body: { name: "Alice Updated" },
      cookie,
    });
    const res = await PATCH_me(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe("Alice Updated");
  });

  it("name too short (< 2 chars) → 400", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("PATCH", "/api/user/me", {
      body: { name: "A" },
      cookie,
    });
    const res = await PATCH_me(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/2.*32|Name must be/);
  });

  it("name too long (> 32 chars) → 400", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("PATCH", "/api/user/me", {
      body: { name: "A".repeat(33) },
      cookie,
    });
    const res = await PATCH_me(req);
    expect(res.status).toBe(400);
  });

  it("update avatarColor with valid hex → 200", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("PATCH", "/api/user/me", {
      body: { avatarColor: "#FF5733" },
      cookie,
    });
    const res = await PATCH_me(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.avatarColor).toBe("#FF5733");
  });

  it("update avatarColor with invalid format → 400", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("PATCH", "/api/user/me", {
      body: { avatarColor: "not-a-color" },
      cookie,
    });
    const res = await PATCH_me(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/color|Invalid/i);
  });

  it("update avatarUrl with valid https URL → 200", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("PATCH", "/api/user/me", {
      body: { avatarUrl: "https://example.com/avatar.png" },
      cookie,
    });
    const res = await PATCH_me(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.avatarUrl).toBe("https://example.com/avatar.png");
  });

  it("update avatarUrl with data URL → 200", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("PATCH", "/api/user/me", {
      body: { avatarUrl: "data:image/png;base64,SGVsbG8=" },
      cookie,
    });
    const res = await PATCH_me(req);
    expect(res.status).toBe(200);
  });

  it("clear avatarUrl with null → 200", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("PATCH", "/api/user/me", {
      body: { avatarUrl: null },
      cookie,
    });
    const res = await PATCH_me(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.avatarUrl).toBeNull();
  });

  it("avatarUrl invalid format → 400", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("PATCH", "/api/user/me", {
      body: { avatarUrl: "ftp://example.com/file.png" },
      cookie,
    });
    const res = await PATCH_me(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/avatar|URL/i);
  });

  it("update avatarInitials → trimmed, uppercased", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("PATCH", "/api/user/me", {
      body: { avatarInitials: "ab" },
      cookie,
    });
    const res = await PATCH_me(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.avatarInitials).toBe("AB");
  });

  it("multiple fields updated in one PATCH → 200", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("PATCH", "/api/user/me", {
      body: {
        name: "Multi Update",
        avatarColor: "#AABBCC",
        avatarInitials: "mu",
      },
      cookie,
    });
    const res = await PATCH_me(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe("Multi Update");
    expect(json.avatarColor).toBe("#AABBCC");
    expect(json.avatarInitials).toBe("MU");
  });
});
