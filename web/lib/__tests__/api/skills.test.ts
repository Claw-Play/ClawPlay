/**
 * Integration tests for skills API routes.
 * Uses a real SQLite temp DB; Redis is mocked.
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

const SAMPLE_SKILL_MD = `---
name: test-skill
version: 1.0.0
---
# Test Skill
A test skill for integration tests.
`;

let dbPath: string;
let db: any;
let GET_skills: (req: any) => Promise<Response>;
let POST_submit: (req: any) => Promise<Response>;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const skillsMod = await import("@/app/api/skills/route");
  const submitMod = await import("@/app/api/skills/submit/route");

  GET_skills = skillsMod.GET;
  POST_submit = submitMod.POST;

  // Seed skill data directly in DB
  const { skills, skillVersions } = await import("@/lib/db/schema");

  const now = new Date();

  await db.insert(skills).values([
    {
      id: "approved-1",
      slug: "approved-skill",
      name: "Approved Skill",
      summary: "Visible to public",
      authorName: "author",
      authorEmail: "author@example.com",
      repoUrl: "",
      iconEmoji: "🦐",
      moderationStatus: "approved",
      moderationReason: "",
      moderationFlags: "[]",
      latestVersionId: "v-approved-1",
      statsStars: 5,
    },
    {
      id: "approved-2",
      slug: "approved-skill-2",
      name: "Approved Skill 2",
      summary: "Second approved skill",
      authorName: "author2",
      authorEmail: "author2@example.com",
      repoUrl: "",
      iconEmoji: "🎨",
      moderationStatus: "approved",
      moderationReason: "",
      moderationFlags: "[]",
      latestVersionId: "v-approved-2",
      statsStars: 10,
    },
    {
      id: "pending-1",
      slug: "pending-skill",
      name: "Pending Skill",
      summary: "Not yet approved",
      authorName: "author",
      authorEmail: "author@example.com",
      repoUrl: "",
      iconEmoji: "🎮",
      moderationStatus: "pending",
      moderationReason: "",
      moderationFlags: "[]",
      latestVersionId: "v-pending-1",
      statsStars: 0,
    },
    {
      id: "deleted-1",
      slug: "deleted-skill",
      name: "Deleted Skill",
      summary: "Soft deleted",
      authorName: "author",
      authorEmail: "author@example.com",
      repoUrl: "",
      iconEmoji: "🦐",
      moderationStatus: "approved",
      moderationReason: "",
      moderationFlags: "[]",
      latestVersionId: "v-deleted-1",
      statsStars: 0,
      deletedAt: now,
    },
  ]);

  // Insert corresponding versions (required by FK)
  await db.insert(skillVersions).values([
    { id: "v-approved-1", skillId: "approved-1", version: "1.0.0", changelog: "", content: "", parsedMetadata: "{}" },
    { id: "v-approved-2", skillId: "approved-2", version: "1.0.0", changelog: "", content: "", parsedMetadata: "{}" },
    { id: "v-pending-1", skillId: "pending-1", version: "1.0.0", changelog: "", content: "", parsedMetadata: "{}" },
    { id: "v-deleted-1", skillId: "deleted-1", version: "1.0.0", changelog: "", content: "", parsedMetadata: "{}" },
  ]);
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/skills", () => {
  it("only returns approved + non-deleted skills", async () => {
    const req = makeRequest("GET", "/api/skills");
    const res = await GET_skills(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    const names = json.skills.map((s: any) => s.name);
    expect(names).toContain("Approved Skill");
    expect(names).not.toContain("Pending Skill");
    expect(names).not.toContain("Deleted Skill");
  });

  it("emoji filter returns only matching skills", async () => {
    const req = makeRequest("GET", "/api/skills?emoji=🦐");
    const res = await GET_skills(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.skills.length).toBeGreaterThan(0);
    expect(json.skills.every((s: any) => s.iconEmoji === "🦐")).toBe(true);
    expect(json.skills.some((s: any) => s.iconEmoji === "🎨")).toBe(false);
  });

  it("sort=stars returns skills ordered by statsStars descending", async () => {
    const req = makeRequest("GET", "/api/skills?sort=stars");
    const res = await GET_skills(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.skills.length).toBeGreaterThanOrEqual(2);
    const stars = json.skills.map((s: any) => s.statsStars);
    for (let i = 1; i < stars.length; i++) {
      expect(stars[i - 1]).toBeGreaterThanOrEqual(stars[i]);
    }
    // approved-2 has 10 stars, approved-1 has 5 — 2 should come first
    expect(json.skills[0].slug).toBe("approved-skill-2");
  });

  it("sort=newest is the default order", async () => {
    const req = makeRequest("GET", "/api/skills?sort=newest");
    const res = await GET_skills(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.skills.length).toBeGreaterThanOrEqual(2);
  });

  it("pending skill does not appear in public list", async () => {
    const req = makeRequest("GET", "/api/skills");
    const res = await GET_skills(req);
    const json = await res.json();

    const slugs = json.skills.map((s: any) => s.slug);
    expect(slugs).not.toContain("pending-skill");
  });
});

describe("POST /api/skills/submit", () => {
  it("valid submission → 201, DB has skill + skillVersion records", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("POST", "/api/skills/submit", {
      body: { name: "My Integration Skill", skillMdContent: SAMPLE_SKILL_MD },
      cookie,
    });
    const res = await POST_submit(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.skill.slug).toBe("my-integration-skill");
    expect(json.skill.version).toBe("1.0.0");

    // Verify DB records
    const { skills, skillVersions } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const skill = await db.query.skills.findFirst({
      where: eq(skills.id, json.skill.id),
    });
    expect(skill.moderationStatus).toBe("pending");
    const version = await db.query.skillVersions.findFirst({
      where: eq(skillVersions.skillId, json.skill.id),
    });
    expect(version).toBeTruthy();
  });

  it("missing name → 400", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("POST", "/api/skills/submit", {
      body: { skillMdContent: SAMPLE_SKILL_MD },
      cookie,
    });
    const res = await POST_submit(req);
    expect(res.status).toBe(400);
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("POST", "/api/skills/submit", {
      body: { name: "My Skill", skillMdContent: SAMPLE_SKILL_MD },
    });
    const res = await POST_submit(req);
    expect(res.status).toBe(401);
  });

  it("duplicate skill name → second skill gets a unique slug with suffix", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const body = { name: "Duplicate Skill", skillMdContent: SAMPLE_SKILL_MD };

    const res1 = await POST_submit(makeRequest("POST", "/api/skills/submit", { body, cookie }));
    const res2 = await POST_submit(makeRequest("POST", "/api/skills/submit", { body, cookie }));

    const json1 = await res1.json();
    const json2 = await res2.json();

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(json1.skill.slug).not.toBe(json2.skill.slug);
    expect(json2.skill.slug).toMatch(/^duplicate-skill-/);
  });
});
