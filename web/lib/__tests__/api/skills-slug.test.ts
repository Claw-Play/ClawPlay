/**
 * Integration tests for skills detail API routes.
 * Covers: GET /api/skills/[slug] and GET /api/skills/[slug]/versions
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tempDbPath, cleanupDb } from "../helpers/db";
import { makeRequest } from "../helpers/request";

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    eval: vi.fn().mockResolvedValue(990),
  })),
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
let GET_slug: (req: any, ctx: any) => Promise<Response>;
let GET_versions: (req: any, ctx: any) => Promise<Response>;

const SKILL_ID = "test-skill-uuid";
const VERSION_ID = "test-version-uuid";

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const slugMod = await import("@/app/api/skills/[slug]/route");
  const versionsMod = await import("@/app/api/skills/[slug]/versions/route");
  GET_slug = slugMod.GET;
  GET_versions = versionsMod.GET;

  // Seed an approved skill with a version
  const { skills, skillVersions } = await import("@/lib/db/schema");
  await db.insert(skills).values({
    id: SKILL_ID,
    slug: "avatar-creator",
    name: "Avatar Creator",
    summary: "Make beautiful avatars",
    authorName: "Alice",
    authorEmail: "alice@example.com",
    repoUrl: "https://github.com/alice/avatar-creator",
    iconEmoji: "🎨",
    moderationStatus: "approved",
    moderationReason: "",
    moderationFlags: "[]",
    latestVersionId: VERSION_ID,
    statsStars: 3,
  });
  await db.insert(skillVersions).values({
    id: VERSION_ID,
    skillId: SKILL_ID,
    version: "1.2.0",
    changelog: "Initial release",
    content: "# Avatar Creator\nMake avatars.",
    parsedMetadata: JSON.stringify({ name: "avatar-creator" }),
  });

  // Seed a second version for the same skill
  await db.insert(skillVersions).values({
    id: "test-version-v1",
    skillId: SKILL_ID,
    version: "1.0.0",
    changelog: "First version",
    content: "# Avatar Creator v1",
    parsedMetadata: "{}",
  });
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
});

describe("GET /api/skills/[slug]", () => {
  it("existing slug → 200 with skill and version content", async () => {
    const req = makeRequest("GET", "/api/skills/avatar-creator");
    const res = await GET_slug(req, { params: { slug: "avatar-creator" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.skill.slug).toBe("avatar-creator");
    expect(json.skill.name).toBe("Avatar Creator");
    expect(json.skill.version).toBe("1.2.0");
    expect(json.skill.content).toContain("Avatar Creator");
    expect(json.skill.parsedMetadata).toMatchObject({ name: "avatar-creator" });
  });

  it("non-existent slug → 404", async () => {
    const req = makeRequest("GET", "/api/skills/does-not-exist");
    const res = await GET_slug(req, { params: { slug: "does-not-exist" } });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toMatch(/not found/i);
  });
});

describe("GET /api/skills/[slug]/versions", () => {
  it("existing slug → 200 with version list ordered by createdAt desc", async () => {
    const req = makeRequest("GET", "/api/skills/avatar-creator/versions");
    const res = await GET_versions(req, { params: { slug: "avatar-creator" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(json.versions)).toBe(true);
    expect(json.versions.length).toBe(2);
    // Only id, version, changelog, createdAt fields
    expect(json.versions[0]).toHaveProperty("id");
    expect(json.versions[0]).toHaveProperty("version");
    expect(json.versions[0]).toHaveProperty("changelog");
    expect(json.versions[0]).not.toHaveProperty("content");
  });

  it("non-existent slug → 404", async () => {
    const req = makeRequest("GET", "/api/skills/does-not-exist/versions");
    const res = await GET_versions(req, { params: { slug: "does-not-exist" } });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toMatch(/not found/i);
  });
});
