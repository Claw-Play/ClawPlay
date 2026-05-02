/**
 * Integration tests for versions API routes.
 * Covers: GET/POST /api/skills/[slug]/versions and GET/PATCH /api/skills/[slug]/versions/[version]
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tempDbPath, cleanupDb, seedUser, seedAdmin } from "../helpers/db";
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

const scanMock = vi.hoisted(() => ({
  result: { safe: true, flags: [] as { code: string; description: string; severity: string }[] },
}));

vi.mock("@/lib/skill-security-scan", () => ({
  scanSkillContent: vi.fn().mockImplementation(() => scanMock.result),
}));

const llmMock = vi.hoisted(() => ({
  result: null as { verdict: string; reason: string; flags: { code: string; description: string }[] } | null,
  shouldThrow: false,
}));

vi.mock("@/lib/skill-llm-safety", () => ({
  llmSafetyReview: vi.fn().mockImplementation(() => {
    if (llmMock.shouldThrow) throw new Error("LLM not available");
    return llmMock.result;
  }),
}));

vi.mock("@/lib/providers/llm", () => ({
  getLLMProvider: vi.fn(() => ({ generate: vi.fn() })),
}));

vi.mock("@/lib/i18n", () => ({
  getT: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock("@/lib/analytics", () => ({
  analytics: { skill: { version_submit: vi.fn() } },
}));

process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

let dbPath: string;
let db: any;
let dbSchema: any;
let GET_versions: (req: any, ctx: any) => Promise<Response>;
let POST_version: (req: any, ctx: any) => Promise<Response>;
let GET_version: (req: any, ctx: any) => Promise<Response>;
let PATCH_version: (req: any, ctx: any) => Promise<Response>;
let authorCookie: string;
let adminCookie: string;
let authorId: string;
let skillId: string;
let versionId: string;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;
  dbSchema = await import("@/lib/db/schema");

  const versionsMod = await import("@/app/api/skills/[slug]/versions/route");
  GET_versions = versionsMod.GET;
  POST_version = versionsMod.POST;

  const versionMod = await import("@/app/api/skills/[slug]/versions/[version]/route");
  GET_version = versionMod.GET;
  PATCH_version = versionMod.PATCH;

  // Seed users
  const author = await seedUser(db, { email: "author@example.com" });
  const admin = await seedAdmin(db, { email: "admin@example.com" });
  authorCookie = author.cookie;
  adminCookie = admin.cookie;
  authorId = author.user.id;
  versionId = "v1-uuid";
  skillId = "versions-skill-uuid";

  // Seed a skill
  await db.insert(dbSchema.skills).values({
    id: skillId,
    slug: "versions-skill",
    name: "Versions Skill",
    summary: "Has multiple versions",
    authorId: authorId,
    authorName: "Test User",
    authorEmail: "author@example.com",
    repoUrl: "https://github.com/test/versions-skill",
    iconEmoji: "📦",
    moderationStatus: "approved",
    moderationReason: "",
    moderationFlags: "[]",
    latestVersionId: versionId,
    statsStars: 0,
  });

  // Seed an existing version
  await db.insert(dbSchema.skillVersions).values({
    id: versionId,
    skillId: skillId,
    version: "1.0.0",
    changelog: "Initial release",
    content: "# Versions Skill\nOriginal content.",
    parsedMetadata: JSON.stringify({ name: "versions-skill" }),
    moderationStatus: "approved",
    moderationFlags: "[]",
  });

  // Seed a 2nd version
  await db.insert(dbSchema.skillVersions).values({
    id: "v2-uuid",
    skillId: skillId,
    version: "1.1.0",
    changelog: "Minor improvements",
    content: "# Versions Skill\nUpdated content.",
    parsedMetadata: JSON.stringify({ name: "versions-skill" }),
    moderationStatus: "approved",
    moderationFlags: "[]",
  });
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/skills/[slug]/versions
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/skills/[slug]/versions", () => {
  it("existing slug → 200 with version list", async () => {
    const req = makeRequest("GET", "/api/skills/versions-skill/versions");
    const res = await GET_versions(req, { params: { slug: "versions-skill" } });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.versions).toHaveLength(2);
  });

  it("non-existent slug → 404", async () => {
    const req = makeRequest("GET", "/api/skills/not-found/versions");
    const res = await GET_versions(req, { params: { slug: "not-found" } });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/skills/[slug]/versions
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/skills/[slug]/versions", () => {
  beforeEach(() => {
    cookieStore.token = undefined;
    scanMock.result = { safe: true, flags: [] };
    llmMock.result = null;
    llmMock.shouldThrow = false;
  });

  it("unauthenticated → 401", async () => {
    const req = makeRequest("POST", "/api/skills/versions-skill/versions", {
      body: { version: "1.2.0", skillMdContent: "# v1.2.0" },
    });
    const res = await POST_version(req, { params: { slug: "versions-skill" } });
    expect(res.status).toBe(401);
  });

  it("non-existent slug → 404", async () => {
    cookieStore.token = authorCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/skills/nonexistent/versions", {
      body: { version: "1.2.0", skillMdContent: "# v1.2.0" },
    });
    const res = await POST_version(req, { params: { slug: "nonexistent" } });
    expect(res.status).toBe(404);
  });

  it("non-author, non-admin → 403", async () => {
    // Create another user who is not the author
    const other = await seedUser(db, { email: "other@example.com" });
    cookieStore.token = other.cookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/skills/versions-skill/versions", {
      body: { version: "1.2.0", skillMdContent: "# v1.2.0" },
    });
    const res = await POST_version(req, { params: { slug: "versions-skill" } });
    expect(res.status).toBe(403);
  });

  it("missing version → 400", async () => {
    cookieStore.token = authorCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/skills/versions-skill/versions", {
      body: { skillMdContent: "# v1.2.0" },
    });
    const res = await POST_version(req, { params: { slug: "versions-skill" } });
    expect(res.status).toBe(400);
  });

  it("invalid semver → 400", async () => {
    cookieStore.token = authorCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/skills/versions-skill/versions", {
      body: { version: "not-semver", skillMdContent: "# v1.2.0" },
    });
    const res = await POST_version(req, { params: { slug: "versions-skill" } });
    expect(res.status).toBe(400);
  });

  it("changelog too long → 400", async () => {
    cookieStore.token = authorCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/skills/versions-skill/versions", {
      body: { version: "1.2.0", skillMdContent: "# v1.2.0", changelog: "x".repeat(1001) },
    });
    const res = await POST_version(req, { params: { slug: "versions-skill" } });
    expect(res.status).toBe(400);
  });

  it("security scan fails → 400", async () => {
    cookieStore.token = authorCookie.replace("clawplay_token=", "");
    scanMock.result = {
      safe: false,
      flags: [{ code: "EXEC", description: "Exec code detected", severity: "error" }],
    };
    const req = makeRequest("POST", "/api/skills/versions-skill/versions", {
      body: { version: "1.2.0", skillMdContent: "# v1.2.0" },
    });
    const res = await POST_version(req, { params: { slug: "versions-skill" } });
    expect(res.status).toBe(400);
  });

  it("LLM review UNSAFE → 400", async () => {
    cookieStore.token = authorCookie.replace("clawplay_token=", "");
    llmMock.result = {
      verdict: "UNSAFE",
      reason: "Dangerous content",
      flags: [{ code: "MALICIOUS", description: "Malicious pattern" }],
    };
    const req = makeRequest("POST", "/api/skills/versions-skill/versions", {
      body: { version: "1.2.0", skillMdContent: "# v1.2.0" },
    });
    const res = await POST_version(req, { params: { slug: "versions-skill" } });
    expect(res.status).toBe(400);
  });

  it("LLM throws → graceful degradation (201)", async () => {
    cookieStore.token = authorCookie.replace("clawplay_token=", "");
    llmMock.shouldThrow = true;
    const req = makeRequest("POST", "/api/skills/versions-skill/versions", {
      body: { version: "2.0.0", skillMdContent: "# v2.0.0" },
    });
    const res = await POST_version(req, { params: { slug: "versions-skill" } });
    expect(res.status).toBe(201);
  });

  it("author submits new version → 201, auto-approved (skill is approved)", async () => {
    cookieStore.token = authorCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/skills/versions-skill/versions", {
      body: { version: "3.0.0", skillMdContent: "# v3.0.0" },
    });
    const res = await POST_version(req, { params: { slug: "versions-skill" } });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.moderationStatus).toBe("approved");
    expect(json.version).toBe("3.0.0");
  });

  it("author submits first version on pending skill → 201, pending review", async () => {
    // Seed a pending skill
    await db.insert(dbSchema.skills).values({
      id: "pending-skill-uuid",
      slug: "pending-skill",
      name: "Pending Skill",
      summary: "Needs review",
      authorId: authorId,
      authorName: "Test User",
      authorEmail: "author@example.com",
      repoUrl: "https://github.com/test/pending-skill",
      iconEmoji: "⏳",
      moderationStatus: "pending",
      moderationReason: "",
      moderationFlags: "[]",
      statsStars: 0,
    });

    cookieStore.token = authorCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/skills/pending-skill/versions", {
      body: { version: "0.1.0", skillMdContent: "# v0.1.0" },
    });
    const res = await POST_version(req, { params: { slug: "pending-skill" } });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.moderationStatus).toBe("pending");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/skills/[slug]/versions/[version]
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/skills/[slug]/versions/[version]", () => {
  it("existing version → 200 with full content", async () => {
    const req = makeRequest("GET", "/api/skills/versions-skill/versions/1.0.0");
    const res = await GET_version(req, { params: { slug: "versions-skill", version: "1.0.0" } });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.version).toBe("1.0.0");
    expect(json.content).toContain("Original content");
  });

  it("non-existent skill → 404", async () => {
    const req = makeRequest("GET", "/api/skills/not-found/versions/1.0.0");
    const res = await GET_version(req, { params: { slug: "not-found", version: "1.0.0" } });
    expect(res.status).toBe(404);
  });

  it("non-existent version → 404", async () => {
    const req = makeRequest("GET", "/api/skills/versions-skill/versions/99.99.99");
    const res = await GET_version(req, { params: { slug: "versions-skill", version: "99.99.99" } });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/skills/[slug]/versions/[version]
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/skills/[slug]/versions/[version]", () => {
  beforeEach(() => {
    cookieStore.token = authorCookie.replace("clawplay_token=", "");
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("PATCH", "/api/skills/versions-skill/versions/1.0.0", {
      body: { action: "deprecate" },
    });
    const res = await PATCH_version(req, { params: { slug: "versions-skill", version: "1.0.0" } });
    expect(res.status).toBe(401);
  });

  it("invalid action → 400", async () => {
    const req = makeRequest("PATCH", "/api/skills/versions-skill/versions/1.0.0", {
      body: { action: "unknown-action" },
    });
    const res = await PATCH_version(req, { params: { slug: "versions-skill", version: "1.0.0" } });
    expect(res.status).toBe(400);
  });

  it("author deprecates version → 200", async () => {
    // Use 1.1.0 since it's not deprecated
    const req = makeRequest("PATCH", "/api/skills/versions-skill/versions/1.1.0", {
      body: { action: "deprecate" },
    });
    const res = await PATCH_version(req, { params: { slug: "versions-skill", version: "1.1.0" } });
    expect(res.status).toBe(200);
  });

  it("non-author deprecate → 403", async () => {
    const other = await seedUser(db, { email: "other2@example.com" });
    cookieStore.token = other.cookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/skills/versions-skill/versions/1.0.0", {
      body: { action: "deprecate" },
    });
    const res = await PATCH_version(req, { params: { slug: "versions-skill", version: "1.0.0" } });
    expect(res.status).toBe(403);
  });

  it("admin undeprecates version → 200", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/skills/versions-skill/versions/1.1.0", {
      body: { action: "undeprecate" },
    });
    const res = await PATCH_version(req, { params: { slug: "versions-skill", version: "1.1.0" } });
    expect(res.status).toBe(200);
  });

  it("admin sets latest version → 200", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/skills/versions-skill/versions/1.0.0", {
      body: { action: "set-latest" },
    });
    const res = await PATCH_version(req, { params: { slug: "versions-skill", version: "1.0.0" } });
    expect(res.status).toBe(200);
  });

  it("non-admin set-latest → 403", async () => {
    cookieStore.token = authorCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/skills/versions-skill/versions/1.0.0", {
      body: { action: "set-latest" },
    });
    const res = await PATCH_version(req, { params: { slug: "versions-skill", version: "1.0.0" } });
    expect(res.status).toBe(403);
  });

  it("non-existent skill → 404", async () => {
    const req = makeRequest("PATCH", "/api/skills/not-found/versions/1.0.0", {
      body: { action: "deprecate" },
    });
    const res = await PATCH_version(req, { params: { slug: "not-found", version: "1.0.0" } });
    expect(res.status).toBe(404);
  });

  it("non-existent version → 404", async () => {
    const req = makeRequest("PATCH", "/api/skills/versions-skill/versions/99.99.99", {
      body: { action: "deprecate" },
    });
    const res = await PATCH_version(req, { params: { slug: "versions-skill", version: "99.99.99" } });
    expect(res.status).toBe(404);
  });
});
