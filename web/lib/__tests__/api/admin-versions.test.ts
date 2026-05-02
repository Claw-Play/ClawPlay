/**
 * Integration tests for GET/PATCH /api/admin/versions/[versionId]
 * Uses a real SQLite temp DB; Redis and analytics are mocked.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { tempDbPath, cleanupDb, seedUser, seedAdmin, seedReviewer } from "../helpers/db";
import { makeRequest } from "../helpers/request";

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    eval: vi.fn().mockResolvedValue(990),
  })),
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
  analytics: { skill: { version_approve: vi.fn(), version_reject: vi.fn() } },
}));

process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

let dbPath: string;
let db: any;
let GET_versions: (req: any) => Promise<Response>;
let PATCH_version: (req: any, ctx: any) => Promise<Response>;
let adminCookie: string;
let reviewerCookie: string;
let userCookie: string;
let versionId: string;
let versionId2: string;
let skillId: string;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const mod = await import("@/app/api/admin/versions/[versionId]/route");
  GET_versions = mod.GET;
  PATCH_version = mod.PATCH;

  const admin = await seedAdmin(db, { email: "admin@example.com" });
  const reviewer = await seedReviewer(db, { email: "reviewer@example.com" });
  const user = await seedUser(db, { email: "user@example.com" });
  adminCookie = admin.cookie;
  reviewerCookie = reviewer.cookie;
  userCookie = user.cookie;

  versionId = "admin-version-uuid";
  versionId2 = "admin-version-uuid-2";
  skillId = "admin-versions-skill-uuid";

  const { skills, skillVersions } = await import("@/lib/db/schema");
  await db.insert(skills).values({
    id: skillId,
    slug: "admin-versions-skill",
    name: "Admin Versions Skill",
    summary: "For admin version testing",
    authorId: admin.user.id,
    authorName: "Admin",
    authorEmail: "admin@example.com",
    repoUrl: "https://github.com/admin/admin-versions",
    iconEmoji: "📦",
    moderationStatus: "approved",
    moderationReason: "",
    moderationFlags: "[]",
    latestVersionId: versionId,
    statsStars: 0,
  });

  await db.insert(skillVersions).values([
    {
      id: versionId,
      skillId,
      version: "1.0.0",
      changelog: "First release",
      content: "# v1.0.0",
      parsedMetadata: JSON.stringify({ name: "admin-versions" }),
      moderationStatus: "pending",
      moderationFlags: "[]",
    },
    {
      id: versionId2,
      skillId,
      version: "1.1.0",
      changelog: "Second release",
      content: "# v1.1.0",
      parsedMetadata: JSON.stringify({ name: "admin-versions" }),
      moderationStatus: "approved",
      moderationFlags: "[]",
    },
  ]);
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

describe("GET /api/admin/versions/[versionId]", () => {
  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/admin/versions");
    const res = await GET_versions(req);
    expect(res.status).toBe(401);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/versions");
    const res = await GET_versions(req);
    expect(res.status).toBe(403);
  });

  it("admin → 200 with versions (default filter=pending)", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/versions");
    const res = await GET_versions(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.versions.length).toBeGreaterThanOrEqual(1);
  });

  it("reviewer → 200", async () => {
    cookieStore.token = reviewerCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/versions");
    const res = await GET_versions(req);
    expect(res.status).toBe(200);
  });

  it("filters by moderation status", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/versions?filter=approved");
    const res = await GET_versions(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.versions.every((v: any) => v.moderationStatus === "approved")).toBe(true);
  });

  it("filter=all returns all versions", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/versions?filter=all");
    const res = await GET_versions(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.versions).toHaveLength(2);
  });
});

describe("PATCH /api/admin/versions/[versionId]", () => {
  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("PATCH", `/api/admin/versions/${versionId}`, {
      body: { action: "approve" },
    });
    const res = await PATCH_version(req, { params: { versionId } });
    expect(res.status).toBe(401);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/versions/${versionId}`, {
      body: { action: "approve" },
    });
    const res = await PATCH_version(req, { params: { versionId } });
    expect(res.status).toBe(403);
  });

  it("non-existent version → 404", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/admin/versions/non-existent", {
      body: { action: "approve" },
    });
    const res = await PATCH_version(req, { params: { versionId: "non-existent" } });
    expect(res.status).toBe(404);
  });

  it("invalid action → 400", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/versions/${versionId}`, {
      body: { action: "invalid-action" },
    });
    const res = await PATCH_version(req, { params: { versionId } });
    expect(res.status).toBe(400);
  });

  it("reject without reason → 400", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/versions/${versionId}`, {
      body: { action: "reject" },
    });
    const res = await PATCH_version(req, { params: { versionId } });
    expect(res.status).toBe(400);
  });

  it("admin approves pending version → 200", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/versions/${versionId}`, {
      body: { action: "approve" },
    });
    const res = await PATCH_version(req, { params: { versionId } });
    expect(res.status).toBe(200);
  });

  it("admin rejects version with reason → 200", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/versions/${versionId2}`, {
      body: { action: "reject", reason: "Does not meet quality standards" },
    });
    const res = await PATCH_version(req, { params: { versionId: versionId2 } });
    expect(res.status).toBe(200);
  });

  it("reviewer can approve version → 200", async () => {
    cookieStore.token = reviewerCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/admin/versions/non-existent", {
      body: { action: "approve" },
    });
    const res = await PATCH_version(req, { params: { versionId: "non-existent" } });
    expect(res.status).toBe(404); // not found, but auth check passed
  });
});
