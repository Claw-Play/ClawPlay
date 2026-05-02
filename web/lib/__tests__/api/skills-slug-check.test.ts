import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { tempDbPath, cleanupDb, seedUser } from "../helpers/db";
import { makeRequest } from "../helpers/request";

const cookieStore = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(() => ({
    get: (name: string) =>
      name === "clawplay_token" && cookieStore.token
        ? { value: cookieStore.token }
        : undefined,
  })),
}));

vi.mock("@/lib/i18n", () => ({
  getT: vi.fn().mockResolvedValue((key: string) => key),
}));

process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

let dbPath: string;
let db: any;
let POST: (req: any) => Promise<Response>;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const routeMod = await import("@/app/api/skills/slug-check/route");
  POST = routeMod.POST;
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

beforeEach(async () => {
  cookieStore.token = undefined;
  const { skills } = await import("@/lib/db/schema");
  await db.delete(skills);
});

describe("POST /api/skills/slug-check", () => {
  it("401 when unauthenticated", async () => {
    const req = makeRequest("POST", "/api/skills/slug-check", {
      body: { name: "Test Skill" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns base slug when available", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const req = makeRequest("POST", "/api/skills/slug-check", {
      body: { name: "My Unique Skill" },
      cookie,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.slug).toBe("my-unique-skill");
    expect(json.exists).toBe(false);
    expect(json.suggestedSlug).toBe("my-unique-skill");
  });

  it("returns exists=true when the slug is already taken", async () => {
    const { cookie } = await seedUser(db);
    cookieStore.token = cookie.replace("clawplay_token=", "");

    const { skills } = await import("@/lib/db/schema");
    await db.insert(skills).values({
      id: "skill-1",
      slug: "duplicate-skill",
      name: "Duplicate Skill",
      summary: "",
      authorName: "",
      authorEmail: "",
      repoUrl: "",
      iconEmoji: "🦐",
      moderationStatus: "approved",
      moderationReason: "",
      moderationFlags: "[]",
      latestVersionId: null,
      statsStars: 0,
    });

    const req = makeRequest("POST", "/api/skills/slug-check", {
      body: { name: "Duplicate Skill" },
      cookie,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.slug).toBe("duplicate-skill");
    expect(json.exists).toBe(true);
    expect(json.suggestedSlug).toMatch(/^duplicate-skill-/);
  });
});
