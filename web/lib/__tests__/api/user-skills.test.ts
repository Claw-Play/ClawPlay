/**
 * Integration tests for GET /api/user/skills
 * Uses a real SQLite temp DB; Redis is mocked.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tempDbPath, cleanupDb, seedUser } from "../helpers/db";
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

process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

let dbPath: string;
let db: any;
let GET_skills: (req: any) => Promise<Response>;
let userCookie: string;
let userId: string;
const SKILL_ID = "user-skill-uuid";
const VERSION_ID = "user-version-uuid";

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const routeMod = await import("@/app/api/user/skills/route");
  GET_skills = routeMod.GET;

  const seeded = await seedUser(db);
  userCookie = seeded.cookie;
  userId = seeded.user.id;

  // Seed a skill + version for the user
  const { skills, skillVersions } = await import("@/lib/db/schema");
  await db.insert(skills).values({
    id: SKILL_ID,
    slug: "my-cool-skill",
    name: "My Cool Skill",
    summary: "A really cool skill",
    authorId: userId,
    authorName: "Test User",
    authorEmail: seeded.email,
    repoUrl: "https://github.com/test/my-cool-skill",
    iconEmoji: "✨",
    moderationStatus: "approved",
    moderationReason: "",
    moderationFlags: "[]",
    latestVersionId: VERSION_ID,
    statsStars: 0,
  });
  await db.insert(skillVersions).values({
    id: VERSION_ID,
    skillId: SKILL_ID,
    version: "1.0.0",
    changelog: "Initial release",
    content: "# My Cool Skill\nDo cool things.",
    parsedMetadata: JSON.stringify({ name: "my-cool-skill" }),
    moderationStatus: "approved",
    moderationFlags: "[]",
  });
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

describe("GET /api/user/skills", () => {
  it("no auth → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/user/skills");
    const res = await GET_skills(req);
    const json = await res.json();
    expect(res.status).toBe(401);
  });

  it("authenticated but no skills → empty array", async () => {
    // Create a second user with no skills
    const seeded2 = await seedUser(db, { email: "nobody@example.com" });
    cookieStore.token = seeded2.cookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/user/skills");
    const res = await GET_skills(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.skills).toEqual([]);
  });

  it("authenticated with skills → returns skill list", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/user/skills");
    const res = await GET_skills(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.skills).toHaveLength(1);
    expect(json.skills[0].slug).toBe("my-cool-skill");
    expect(json.skills[0].name).toBe("My Cool Skill");
    expect(json.skills[0].latestVersion).toBeDefined();
    expect(json.skills[0].latestVersion.version).toBe("1.0.0");
  });
});
