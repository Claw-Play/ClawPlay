/**
 * Integration tests for admin API routes.
 * Uses a real SQLite temp DB; Redis and analytics are mocked.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tempDbPath, cleanupDb, seedUser, seedAdmin } from "../helpers/db";
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

// ── Analytics mock ────────────────────────────────────────────────────────────
vi.mock("@/lib/analytics", () => ({
  analytics: {
    skill: {
      approve: vi.fn(),
      reject: vi.fn(),
      feature: vi.fn(),
      unfeature: vi.fn(),
    },
  },
  logEvent: vi.fn(),
  incrementSkillStat: vi.fn(),
}));

// ── Env vars ──────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

let dbPath: string;
let db: any;
let GET_adminSkills: (req: any) => Promise<Response>;
let PATCH_adminSkill: (req: any, ctx: any) => Promise<Response>;
let adminCookie: string;
let userCookie: string;
let pendingSkillId: string;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const listMod = await import("@/app/api/admin/skills/route");
  const patchMod = await import("@/app/api/admin/skills/[id]/route");

  GET_adminSkills = listMod.GET;
  PATCH_adminSkill = patchMod.PATCH;

  // Seed users
  const admin = await seedAdmin(db, { email: "admin@example.com" });
  const user = await seedUser(db, { email: "user@example.com" });
  adminCookie = admin.cookie;
  userCookie = user.cookie;

  // Seed a pending skill
  const { skills, skillVersions } = await import("@/lib/db/schema");
  pendingSkillId = "pending-skill-id";
  await db.insert(skills).values({
    id: pendingSkillId,
    slug: "pending-skill",
    name: "Pending Skill",
    summary: "Awaiting review",
    authorName: "author",
    authorEmail: "author@example.com",
    repoUrl: "",
    iconEmoji: "🦐",
    moderationStatus: "pending",
    moderationReason: "",
    moderationFlags: "[]",
    latestVersionId: "v1",
    statsStars: 0,
  });
  await db.insert(skillVersions).values({
    id: "v1",
    skillId: pendingSkillId,
    version: "1.0.0",
    changelog: "",
    content: "",
    parsedMetadata: "{}",
  });
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/skills", () => {
  it("admin → 200, returns pending skills", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/skills", { cookie: adminCookie });
    const res = await GET_adminSkills(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    const slugs = json.skills.map((s: any) => s.slug);
    expect(slugs).toContain("pending-skill");
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/skills", { cookie: userCookie });
    const res = await GET_adminSkills(req);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/admin/skills");
    const res = await GET_adminSkills(req);
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/admin/skills/[id]", () => {
  it("approve → moderationStatus='approved' in DB, analytics.skill.approve called", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");

    const req = makeRequest("PATCH", `/api/admin/skills/${pendingSkillId}`, {
      body: { action: "approve", reason: "Looks good" },
      cookie: adminCookie,
    });
    const res = await PATCH_adminSkill(req, { params: { id: pendingSkillId } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toMatch(/approved/i);

    // Verify DB
    const { skills } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const updated = await db.query.skills.findFirst({
      where: eq(skills.id, pendingSkillId),
    });
    expect(updated.moderationStatus).toBe("approved");

    // Verify analytics.skill.approve was called
    const { analytics } = await import("@/lib/analytics");
    expect(analytics.skill.approve).toHaveBeenCalledWith(pendingSkillId, expect.any(Number));
  });

  it("reject → moderationStatus='rejected', moderationReason saved", async () => {
    // Insert a fresh pending skill to reject
    const { skills, skillVersions } = await import("@/lib/db/schema");
    const rejectId = "reject-skill-id";
    await db.insert(skills).values({
      id: rejectId,
      slug: "reject-skill",
      name: "Reject Skill",
      summary: "",
      authorName: "author",
      authorEmail: "author@example.com",
      repoUrl: "",
      iconEmoji: "🦐",
      moderationStatus: "pending",
      moderationReason: "",
      moderationFlags: "[]",
      latestVersionId: "v-rej",
      statsStars: 0,
    });
    await db.insert(skillVersions).values({
      id: "v-rej",
      skillId: rejectId,
      version: "1.0.0",
      changelog: "",
      content: "",
      parsedMetadata: "{}",
    });

    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/skills/${rejectId}`, {
      body: { action: "reject", reason: "Violates policy" },
      cookie: adminCookie,
    });
    const res = await PATCH_adminSkill(req, { params: { id: rejectId } });

    expect(res.status).toBe(200);

    const { eq } = await import("drizzle-orm");
    const updated = await db.query.skills.findFirst({
      where: eq(skills.id, rejectId),
    });
    expect(updated.moderationStatus).toBe("rejected");
    expect(updated.moderationReason).toBe("Violates policy");
  });

  it("invalid action → 400", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/skills/${pendingSkillId}`, {
      body: { action: "delete" },
      cookie: adminCookie,
    });
    const res = await PATCH_adminSkill(req, { params: { id: pendingSkillId } });
    expect(res.status).toBe(400);
  });

  it("non-admin user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/skills/${pendingSkillId}`, {
      body: { action: "approve" },
      cookie: userCookie,
    });
    const res = await PATCH_adminSkill(req, { params: { id: pendingSkillId } });
    expect(res.status).toBe(403);
  });

  it("feature → isFeatured=1 in DB", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/skills/${pendingSkillId}`, {
      body: { action: "feature" },
      cookie: adminCookie,
    });
    const res = await PATCH_adminSkill(req, { params: { id: pendingSkillId } });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.message).toMatch(/featured/i);

    const { skills } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const updated = await db.query.skills.findFirst({
      where: eq(skills.id, pendingSkillId),
    });
    expect(updated.isFeatured).toBe(1);
  });

  it("unfeature → isFeatured=0 in DB", async () => {
    // First feature it (if not already), then unfeature
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/skills/${pendingSkillId}`, {
      body: { action: "unfeature" },
      cookie: adminCookie,
    });
    const res = await PATCH_adminSkill(req, { params: { id: pendingSkillId } });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.message).toMatch(/unfeatured/i);

    const { skills } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const updated = await db.query.skills.findFirst({
      where: eq(skills.id, pendingSkillId),
    });
    expect(updated.isFeatured).toBe(0);
  });

  it("skill not found → 404", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/admin/skills/nonexistent-skill-id", {
      body: { action: "approve" },
      cookie: adminCookie,
    });
    const res = await PATCH_adminSkill(req, { params: { id: "nonexistent-skill-id" } });
    expect(res.status).toBe(404);
  });
});
