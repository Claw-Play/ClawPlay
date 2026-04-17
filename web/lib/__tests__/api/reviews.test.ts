/**
 * Integration tests for /api/skills/[slug]/reviews
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tempDbPath, cleanupDb, seedUser } from "../helpers/db";
import { makeRequest } from "../helpers/request";

// ── Analytics mock (prevents analytics → db chain from early-init during preload) ───
vi.mock("@/lib/analytics", () => ({
  analytics: {
    skill: { review: vi.fn() },
  },
  logEvent: vi.fn(),
  incrementSkillStat: vi.fn(),
}));

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
let GET_reviews: (req: any, ctx: any) => Promise<Response>;
let POST_review: (req: any, ctx: any) => Promise<Response>;

// Shared test user for review tests
let reviewer1Cookie: string;
let reviewer2Cookie: string;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const mod = await import("@/app/api/skills/[slug]/reviews/route");
  GET_reviews = mod.GET;
  POST_review = mod.POST;

  // Create a test skill directly in DB
  const { skills, skillVersions } = await import("@/lib/db/schema");
  await db.insert(skills).values({
    id: "review-skill-1",
    slug: "review-test-skill",
    name: "Review Test Skill",
    summary: "For testing reviews",
    authorName: "tester",
    authorEmail: "tester@example.com",
    repoUrl: "",
    iconEmoji: "🎨",
    moderationStatus: "approved",
    moderationReason: "",
    moderationFlags: "[]",
    latestVersionId: "rv-v1",
    statsStars: 0,
    statsRatingsCount: 0,
    isFeatured: 0,
  });
  await db.insert(skillVersions).values({
    id: "rv-v1",
    skillId: "review-skill-1",
    version: "1.0.0",
    changelog: "Initial",
    content: "# Review Test Skill",
    parsedMetadata: "{}",
    moderationStatus: "approved",
    moderationFlags: "[]",
  });

  // Create two persistent test users
  const r1 = await seedUser(db, { email: "reviewer-1@test.example" });
  const r2 = await seedUser(db, { email: "reviewer-2@test.example" });
  reviewer1Cookie = r1.cookie.replace("clawplay_token=", "");
  reviewer2Cookie = r2.cookie.replace("clawplay_token=", "");
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

function makeReq(method: string, slug: string, body?: unknown, cookie?: string) {
  const req = makeRequest(method, `/api/skills/${slug}/reviews`, { body, cookie } as any);
  return { req, ctx: { params: { slug } } };
}

describe("GET /api/skills/[slug]/reviews", () => {
  it("returns 200 with empty reviews for new skill", async () => {
    const { req, ctx } = makeReq("GET", "review-test-skill");
    const res = await GET_reviews(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reviews).toEqual([]);
    expect(json.statsRatingsCount).toBe(0);
    expect(json.averageRating).toBeNull();
  });

  it("non-existent slug → 404", async () => {
    const { req, ctx } = makeReq("GET", "no-such-skill");
    const res = await GET_reviews(req, ctx);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/skills/[slug]/reviews", () => {
  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const { req, ctx } = makeReq("POST", "review-test-skill", { rating: 5 });
    const res = await POST_review(req, ctx);
    expect(res.status).toBe(401);
  });

  it("rating out of range → 400", async () => {
    cookieStore.token = reviewer1Cookie;
    const { req, ctx } = makeReq("POST", "review-test-skill", { rating: 6 });
    const res = await POST_review(req, ctx);
    expect(res.status).toBe(400);
  });

  it("valid rating → 201, aggregates updated", async () => {
    cookieStore.token = reviewer1Cookie;
    const { req, ctx } = makeReq("POST", "review-test-skill", { rating: 5, comment: "Great!" });
    const res = await POST_review(req, ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.averageRating).toBe(5);
    expect(json.count).toBe(1);
  });

  it("second review by same user → upserts, count stays 1", async () => {
    // reviewer1 already rated 5 — update to 3
    cookieStore.token = reviewer1Cookie;
    const { req, ctx } = makeReq("POST", "review-test-skill", { rating: 3 });
    const res = await POST_review(req, ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.count).toBe(1);
    expect(json.averageRating).toBe(3);
  });

  it("second user rates → count increases to 2", async () => {
    cookieStore.token = reviewer2Cookie;
    const { req, ctx } = makeReq("POST", "review-test-skill", { rating: 4 });
    const res = await POST_review(req, ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    // reviewer1: 3, reviewer2: 4 → avg 3.5, count 2
    expect(json.count).toBe(2);
    expect(json.averageRating).toBe(3.5);
  });
});
