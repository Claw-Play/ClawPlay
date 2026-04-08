/**
 * Integration tests for GET /api/skills/[slug]/download
 * Covers: slug validation, version resolution, ZIP generation.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tempDbPath, cleanupDb } from "../helpers/db";
import { makeRequest } from "../helpers/request";
import JSZip from "jszip";

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
let GET_download: (req: any, ctx: any) => Promise<Response>;

const SKILL_ID = "dl-test-skill-uuid";
const VERSION_ID = "dl-test-version-uuid";

const SKILL_MD = `# Avatar Creator

Generate beautiful avatars using AI.`;

const SAMPLE_SKILL_MD = `---
name: avatar-creator
---
${SKILL_MD}`;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const dlMod = await import("@/app/api/skills/[slug]/download/route");
  GET_download = dlMod.GET;

  // Seed an approved skill with a version
  const { skills, skillVersions } = await import("@/lib/db/schema");
  await db.insert(skills).values({
    id: SKILL_ID,
    slug: "avatar-creator",
    name: "Avatar Creator",
    summary: "Make avatars",
    authorName: "Alice",
    authorEmail: "alice@example.com",
    repoUrl: "https://github.com/alice/avatar",
    iconEmoji: "🎨",
    moderationStatus: "approved",
    moderationReason: "",
    moderationFlags: "[]",
    latestVersionId: VERSION_ID,
    statsStars: 100,
  });

  await db.insert(skillVersions).values({
    id: VERSION_ID,
    skillId: SKILL_ID,
    version: "1.2.0",
    changelog: "Initial release",
    content: SAMPLE_SKILL_MD,
    parsedMetadata: JSON.stringify({ name: "avatar-creator" }),
  });

  // Seed a second version
  await db.insert(skillVersions).values({
    id: "dl-test-version-v1",
    skillId: SKILL_ID,
    version: "1.0.0",
    changelog: "First version",
    content: "# Avatar Creator v1\nOld version.",
    parsedMetadata: "{}",
  });
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
});

describe("GET /api/skills/[slug]/download", () => {
  it("returns ZIP with SKILL.md and origin.json (latest version)", async () => {
    const req = makeRequest("GET", "/api/skills/avatar-creator/download");
    const res = await GET_download(req, { params: { slug: "avatar-creator" } });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toContain("avatar-creator-");
    expect(res.headers.get("Content-Disposition")).toContain(".zip");
    expect(res.headers.get("Cache-Control")).toContain("public");

    const buffer = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files);

    expect(files).toContain("SKILL.md");
    expect(files).toContain("origin.json");

    const skillMd = await zip.files["SKILL.md"].async("string");
    expect(skillMd).toContain("Avatar Creator");

    const origin = JSON.parse(await zip.files["origin.json"].async("string"));
    expect(origin.slug).toBe("avatar-creator");
    expect(origin.name).toBe("Avatar Creator");
    expect(origin.source).toBe("clawplay");
    expect(origin.version).toBe("1.2.0"); // latest
    expect(origin.installedAt).toBeTruthy();
  });

  it("returns specific version when ?version= is provided", async () => {
    const req = makeRequest("GET", "/api/skills/avatar-creator/download?version=1.0.0");
    const res = await GET_download(req, { params: { slug: "avatar-creator" } });

    expect(res.status).toBe(200);
    const buffer = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(Buffer.from(buffer));
    const origin = JSON.parse(await zip.files["origin.json"].async("string"));
    expect(origin.version).toBe("1.0.0");
  });

  it("returns 404 for non-existent slug", async () => {
    const req = makeRequest("GET", "/api/skills/does-not-exist/download");
    const res = await GET_download(req, { params: { slug: "does-not-exist" } });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("returns 404 for non-approved (pending) skill", async () => {
    const { skills, skillVersions } = await import("@/lib/db/schema");
    await db.insert(skills).values({
      id: "pending-skill",
      slug: "pending-skill",
      name: "Pending Skill",
      summary: "",
      authorName: "Bob",
      authorEmail: "bob@example.com",
      repoUrl: "",
      iconEmoji: "📝",
      moderationStatus: "pending", // not approved
      moderationReason: "",
      moderationFlags: "[]",
      latestVersionId: "pending-version",
      statsStars: 0,
    });
    await db.insert(skillVersions).values({
      id: "pending-version",
      skillId: "pending-skill",
      version: "1.0.0",
      changelog: "",
      content: "# Pending",
      parsedMetadata: "{}",
    });

    const req = makeRequest("GET", "/api/skills/pending-skill/download");
    const res = await GET_download(req, { params: { slug: "pending-skill" } });

    expect(res.status).toBe(404);
  });

  it("returns 404 for deleted skill", async () => {
    const { skills, skillVersions } = await import("@/lib/db/schema");
    const deletedAt = new Date();
    await db.insert(skills).values({
      id: "deleted-skill",
      slug: "deleted-skill",
      name: "Deleted Skill",
      summary: "",
      authorName: "Charlie",
      authorEmail: "charlie@example.com",
      repoUrl: "",
      iconEmoji: "🗑️",
      moderationStatus: "approved",
      moderationReason: "",
      moderationFlags: "[]",
      latestVersionId: "deleted-version",
      statsStars: 0,
      deletedAt,
    });
    await db.insert(skillVersions).values({
      id: "deleted-version",
      skillId: "deleted-skill",
      version: "1.0.0",
      changelog: "",
      content: "# Deleted",
      parsedMetadata: "{}",
    });

    const req = makeRequest("GET", "/api/skills/deleted-skill/download");
    const res = await GET_download(req, { params: { slug: "deleted-skill" } });

    expect(res.status).toBe(404);
  });

  it("returns 404 for invalid version param", async () => {
    const req = makeRequest("GET", "/api/skills/avatar-creator/download?version=99.99.99");
    const res = await GET_download(req, { params: { slug: "avatar-creator" } });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/version/i);
  });

  it("returns 400 for path traversal in slug", async () => {
    const req = makeRequest("GET", "/api/skills/../../../etc/passwd/download");
    const res = await GET_download(req, { params: { slug: "../../../etc/passwd" } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
  });

  it("returns 400 for slug with special characters", async () => {
    const req = makeRequest("GET", "/api/skills/avatar_creator/download");
    const res = await GET_download(req, { params: { slug: "avatar_creator" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid/i);
  });

  it("returns 400 for slug with spaces", async () => {
    const req = makeRequest("GET", "/api/skills/avatar%20creator/download");
    const res = await GET_download(req, { params: { slug: "avatar creator" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty slug", async () => {
    const req = makeRequest("GET", "/api/skills//download");
    const res = await GET_download(req, { params: { slug: "" } });
    expect(res.status).toBe(400);
  });

  it("returns 404 when skill has no latestVersionId", async () => {
    const { skills } = await import("@/lib/db/schema");
    await db.insert(skills).values({
      id: "no-version-skill",
      slug: "no-version-skill",
      name: "No Version Skill",
      summary: "",
      authorName: "Dan",
      authorEmail: "dan@example.com",
      repoUrl: "",
      iconEmoji: "❓",
      moderationStatus: "approved",
      moderationReason: "",
      moderationFlags: "[]",
      latestVersionId: null, // no version
      statsStars: 0,
    });

    const req = makeRequest("GET", "/api/skills/no-version-skill/download");
    const res = await GET_download(req, { params: { slug: "no-version-skill" } });

    expect(res.status).toBe(404);
  });

  it("Content-Disposition includes slug and version in filename", async () => {
    const req = makeRequest("GET", "/api/skills/avatar-creator/download?version=1.0.0");
    const res = await GET_download(req, { params: { slug: "avatar-creator" } });

    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("avatar-creator");
    expect(disposition).toContain("1.0.0");
    expect(disposition).toMatch(/filename="avatar-creator-1\.0\.0\.zip"/);
  });

  it("origin.json contains source=clawplay", async () => {
    const req = makeRequest("GET", "/api/skills/avatar-creator/download");
    const res = await GET_download(req, { params: { slug: "avatar-creator" } });

    const buffer = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(Buffer.from(buffer));
    const origin = JSON.parse(await zip.files["origin.json"].async("string"));

    expect(origin.source).toBe("clawplay");
    expect(origin.slug).toBe("avatar-creator");
    expect(origin.name).toBe("Avatar Creator");
    expect(typeof origin.installedAt).toBe("string");
  });

  it("origin.json is valid JSON with correct shape", async () => {
    const req = makeRequest("GET", "/api/skills/avatar-creator/download");
    const res = await GET_download(req, { params: { slug: "avatar-creator" } });

    const buffer = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(Buffer.from(buffer));
    const originStr = await zip.files["origin.json"].async("string");
    const origin = JSON.parse(originStr);

    expect(origin).toHaveProperty("slug");
    expect(origin).toHaveProperty("name");
    expect(origin).toHaveProperty("version");
    expect(origin).toHaveProperty("source");
    expect(origin).toHaveProperty("installedAt");
    // JSON should be pretty-printed (2-space indent)
    expect(originStr).toContain("\n");
  });
});
