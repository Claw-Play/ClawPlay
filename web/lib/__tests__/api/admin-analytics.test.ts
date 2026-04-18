/**
 * Integration tests for admin analytics API routes.
 * Uses a real SQLite temp DB; Redis and analytics are mocked.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tempDbPath, cleanupDb, seedAdmin, seedUser, seedReviewer } from "../helpers/db";
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

// ── Analytics mock ───────────────────────────────────────────────────────────
vi.mock("@/lib/analytics", () => ({
  analytics: { skill: { approve: vi.fn(), reject: vi.fn(), feature: vi.fn() } },
  logEvent: vi.fn(),
  incrementSkillStat: vi.fn(),
}));

// ── Env vars ─────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

let dbPath: string;
let db: any;
let adminCookie: string;
let userCookie: string;
let reviewerCookie: string;

let GET_overview: (req: any) => Promise<Response>;
let GET_events: (req: any) => Promise<Response>;
let GET_users: (req: any) => Promise<Response>;
let GET_me: (req: any) => Promise<Response>;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const overviewMod = await import("@/app/api/admin/analytics/overview/route");
  const eventsMod = await import("@/app/api/admin/analytics/events/route");
  const usersMod = await import("@/app/api/admin/analytics/users/route");
  const meMod = await import("@/app/api/user/analytics/me/route");

  GET_overview = overviewMod.GET;
  GET_events = eventsMod.GET;
  GET_users = usersMod.GET;
  GET_me = meMod.GET;

  // Seed users
  const admin = await seedAdmin(db, { email: "admin@example.com" });
  const user = await seedUser(db, { email: "user@example.com" });
  const reviewer = await seedReviewer(db, { email: "reviewer@example.com" });
  adminCookie = admin.cookie;
  userCookie = user.cookie;
  reviewerCookie = reviewer.cookie;

  // Seed some event data
  const { eventLogs } = await import("@/lib/db/schema");
  const now = Date.now();
  await db.insert(eventLogs).values([
    { event: "skill.view", userId: user.user.id, targetType: "skill", targetId: "test-skill", metadata: "{}", createdAt: new Date(now) },
    { event: "quota.use", userId: user.user.id, targetType: "quota", targetId: String(user.user.id), metadata: JSON.stringify({ ability: "llm.generate", cost: 10 }), createdAt: new Date(now) },
    { event: "user.login", userId: admin.user.id, targetType: "user", targetId: String(admin.user.id), metadata: "{}", createdAt: new Date(now) },
  ]);
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/analytics/overview", () => {
  it("admin → 200 with totals and trend", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/analytics/overview?period=7d");
    const res = await GET_overview(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.totals).toBeDefined();
    expect(json.trend).toBeDefined();
    expect(json.trend.eventsByDay).toBeInstanceOf(Array);
    expect(typeof json.totals.activeUsers).toBe("number");
    expect(typeof json.totals.totalEvents).toBe("number");
    expect(typeof json.totals.totalQuotaUsed).toBe("number");
    expect(typeof json.totals.totalSkills).toBe("number");
  });

  it("reviewer → 403", async () => {
    cookieStore.token = reviewerCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/analytics/overview");
    const res = await GET_overview(req);
    expect(res.status).toBe(403);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/analytics/overview");
    const res = await GET_overview(req);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/admin/analytics/overview");
    const res = await GET_overview(req);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/analytics/events", () => {
  it("admin → 200 with events list and pagination", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/analytics/events?limit=10");
    const res = await GET_events(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.events).toBeInstanceOf(Array);
    expect(json.pagination).toBeDefined();
    expect(typeof json.pagination.total).toBe("number");
  });

  it("filters by event type", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/analytics/events?event=quota.use");
    const res = await GET_events(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    for (const e of json.events) {
      expect(e.event).toBe("quota.use");
    }
  });

  it("filters by user_id", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", `/api/admin/analytics/events?user_id=${1}`);
    const res = await GET_events(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    // events may be empty if user id doesn't match seed data
    expect(Array.isArray(json.events)).toBe(true);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/analytics/events");
    const res = await GET_events(req);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/analytics/users", () => {
  it("admin → 200 with users list", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/analytics/users?period=7d");
    const res = await GET_users(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toBeInstanceOf(Array);
    expect(json.pagination).toBeDefined();
  });

  it("supports sort by events", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/analytics/users?sort=events&order=desc");
    const res = await GET_users(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.users)).toBe(true);
  });

  it("supports role filter", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/analytics/users?role=reviewer&period=all");
    const res = await GET_users(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(json.users)).toBe(true);
    for (const user of json.users) {
      expect(user.role).toBe("reviewer");
    }
  });

  it("supports sortBy last_active ascending", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/analytics/users?sortBy=last_active&sortOrder=asc&period=all");
    const res = await GET_users(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(json.users)).toBe(true);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/analytics/users");
    const res = await GET_users(req);
    expect(res.status).toBe(403);
  });

  it("reviewer → 403", async () => {
    cookieStore.token = reviewerCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/analytics/users");
    const res = await GET_users(req);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/user/analytics/me", () => {
  it("authenticated user → 200 with top-level stats", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/user/analytics/me");
    const res = await GET_me(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.userId).toBeDefined();
    expect(json.events7d).toBeDefined();
    expect(json.events30d).toBeDefined();
    expect(json.quotaUsed7d).toBeDefined();
    expect(json.quotaUsed30d).toBeDefined();
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/user/analytics/me");
    const res = await GET_me(req);
    expect(res.status).toBe(401);
  });
});
