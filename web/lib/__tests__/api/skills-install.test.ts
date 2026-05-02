/**
 * Integration tests for POST /api/skills/[slug]/install
 * Uses a real SQLite temp DB; Redis, auth, and analytics are mocked.
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

const jwtMock = vi.hoisted(() => ({
  payload: { userId: 42 } as { userId: number } | null,
}));

vi.mock("@/lib/auth", () => ({
  verifyJWT: vi.fn().mockImplementation(() => jwtMock.payload),
}));

vi.mock("@/lib/i18n", () => ({
  getT: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock("@/lib/analytics", () => ({
  analytics: { skill: { install: vi.fn() } },
  incrementSkillStat: vi.fn(),
}));

process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

let dbPath: string;
let db: any;
let POST_install: (req: any, ctx: any) => Promise<Response>;

const SKILL_ID = "install-skill-uuid";

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const mod = await import("@/app/api/skills/[slug]/install/route");
  POST_install = mod.POST;

  // Seed an approved skill
  const { skills } = await import("@/lib/db/schema");
  await db.insert(skills).values({
    id: SKILL_ID,
    slug: "test-skill",
    name: "Test Skill",
    summary: "A test skill",
    authorName: "Alice",
    authorEmail: "alice@example.com",
    repoUrl: "https://github.com/alice/test-skill",
    iconEmoji: "🔧",
    moderationStatus: "approved",
    moderationReason: "",
    moderationFlags: "[]",
    statsStars: 0,
  });
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
});

describe("POST /api/skills/[slug]/install", () => {
  beforeEach(() => {
    jwtMock.payload = { userId: 42 };
  });

  it("invalid slug format → 400", async () => {
    const req = makeRequest("POST", "/api/skills/bad_slug/install");
    const res = await POST_install(req, { params: { slug: "bad_slug" } });
    const json = await res.json();
    expect(res.status).toBe(400);
  });

  it("without token → 200 (userId=null, fire-and-forget)", async () => {
    jwtMock.payload = null;
    const req = makeRequest("POST", "/api/skills/test-skill/install", {
      headers: {}, // no Authorization header
    });
    const res = await POST_install(req, { params: { slug: "test-skill" } });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("with valid token → 200", async () => {
    const req = makeRequest("POST", "/api/skills/test-skill/install", {
      headers: { authorization: "Bearer valid.jwt.token" },
    });
    const res = await POST_install(req, { params: { slug: "test-skill" } });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("with invalid token → 200 (userId=null, fire-and-forget)", async () => {
    jwtMock.payload = null;
    const req = makeRequest("POST", "/api/skills/test-skill/install", {
      headers: { authorization: "Bearer invalid-token" },
    });
    const res = await POST_install(req, { params: { slug: "test-skill" } });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("non-existent slug → 404", async () => {
    const req = makeRequest("POST", "/api/skills/non-existent/install");
    const res = await POST_install(req, { params: { slug: "non-existent" } });
    const json = await res.json();
    expect(res.status).toBe(404);
  });

  it("unapproved skill → 404", async () => {
    // Seed an unapproved skill
    const { skills } = await import("@/lib/db/schema");
    await db.insert(skills).values({
      id: "unapproved-skill-uuid",
      slug: "unapproved-skill",
      name: "Unapproved",
      summary: "Pending review",
      authorName: "Bob",
      authorEmail: "bob@example.com",
      repoUrl: "https://github.com/bob/unapproved",
      iconEmoji: "⏳",
      moderationStatus: "pending",
      moderationReason: "",
      moderationFlags: "[]",
      statsStars: 0,
    });

    const req = makeRequest("POST", "/api/skills/unapproved-skill/install");
    const res = await POST_install(req, { params: { slug: "unapproved-skill" } });
    expect(res.status).toBe(404);
  });
});
