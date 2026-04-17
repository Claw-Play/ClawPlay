/**
 * Integration tests for admin users API routes (GET /api/admin/users and PATCH /api/admin/users/[id]).
 * Uses a real SQLite temp DB; Redis and analytics are mocked.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
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
const mockRoleChange = vi.fn();
vi.mock("@/lib/analytics", () => ({
  analytics: {
    skill: { approve: vi.fn(), reject: vi.fn(), feature: vi.fn(), unfeature: vi.fn() },
    user: { roleChange: mockRoleChange },
  },
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
let adminId: number;
let targetUserId: number;

let GET_list: (req: any) => Promise<Response>;
let GET_detail: (req: any, ctx: any) => Promise<Response>;
let PATCH: (req: any, ctx: any) => Promise<Response>;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const listMod = await import("@/app/api/admin/users/route");
  const detailMod = await import("@/app/api/admin/users/[id]/route");

  GET_list = listMod.GET;
  // Pattern from skills-slug.test.ts: pass { params: { id } } as ctx
  GET_detail = (req, ctx) => detailMod.GET(req, ctx as any);
  PATCH = (req, ctx) => detailMod.PATCH(req, ctx as any);

  // Seed users
  const admin = await seedAdmin(db, { email: "admin@example.com" });
  const user = await seedUser(db, { email: "target@example.com" });
  const reviewer = await seedReviewer(db, { email: "reviewer@example.com" });
  adminId = admin.user.id;
  targetUserId = user.user.id;
  adminCookie = admin.cookie;
  userCookie = user.cookie;
  reviewerCookie = reviewer.cookie;
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/users", () => {
  it("admin → 200 with users list containing id, name, role", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/users");
    const res = await GET_list(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(json.users)).toBe(true);
    expect(json.users.length).toBeGreaterThan(0);

    // Every user row must have id, name, role
    for (const u of json.users) {
      expect(typeof u.id).toBe("number");
      expect(typeof u.name).toBe("string");
      expect(["user", "admin", "reviewer"]).toContain(u.role);
    }
  });

  it("supports limit and offset params", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/users?limit=1&offset=0");
    const res = await GET_list(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.users.length).toBeLessThanOrEqual(1);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/users");
    const res = await GET_list(req);
    expect(res.status).toBe(403);
  });

  it("reviewer → 403 (reviewers cannot manage users)", async () => {
    cookieStore.token = reviewerCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/users");
    const res = await GET_list(req);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/admin/users");
    const res = await GET_list(req);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/users/[id]", () => {
  it("admin → 200 with correct user data", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", `/api/admin/users/${targetUserId}`);
    const res = await GET_detail(req, { params: { id: String(targetUserId) } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe(targetUserId);
    expect(typeof json.name).toBe("string");
    expect(["user", "admin", "reviewer"]).toContain(json.role);
  });

  it("admin → 404 for non-existent user", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/users/99999");
    const res = await GET_detail(req, { params: { id: "99999" } });
    expect(res.status).toBe(404);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", `/api/admin/users/${targetUserId}`);
    const res = await GET_detail(req, { params: { id: String(targetUserId) } });
    expect(res.status).toBe(403);
  });

  it("reviewer → 403", async () => {
    cookieStore.token = reviewerCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", `/api/admin/users/${targetUserId}`);
    const res = await GET_detail(req, { params: { id: String(targetUserId) } });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/admin/users/[id]", () => {
  it("admin promotes user from user → reviewer → 200", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/users/${targetUserId}`, {
      body: { role: "reviewer" },
    });
    const res = await PATCH(req, { params: { id: String(targetUserId) } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.role).toBe("reviewer");
    expect(json.id).toBe(targetUserId);

    // Verify DB was updated
    const { users } = await import("@/lib/db/schema");
    const updated = await db.query.users.findFirst({ where: eq(users.id, targetUserId) } as any);
    expect(updated.role).toBe("reviewer");

    // Verify analytics was called
    expect(mockRoleChange).toHaveBeenCalledWith(targetUserId, adminId, "user", "reviewer");

    // Reset to user for next test
    await (db as any).update(users).set({ role: "user" }).where(eq(users.id, targetUserId) as any);
    mockRoleChange.mockClear();
  });

  it("admin promotes reviewer → admin → 200", async () => {
    const { users } = await import("@/lib/db/schema");
    await (db as any).update(users).set({ role: "reviewer" }).where(eq(users.id, targetUserId) as any);

    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/users/${targetUserId}`, {
      body: { role: "admin" },
    });
    const res = await PATCH(req, { params: { id: String(targetUserId) } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.role).toBe("admin");
    expect(mockRoleChange).toHaveBeenCalledWith(targetUserId, adminId, "reviewer", "admin");

    // Reset to user for next test
    await (db as any).update(users).set({ role: "user" }).where(eq(users.id, targetUserId) as any);
    mockRoleChange.mockClear();
  });

  it("admin demotes admin → user → 200", async () => {
    const { users } = await import("@/lib/db/schema");
    await (db as any).update(users).set({ role: "admin" }).where(eq(users.id, targetUserId) as any);

    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/users/${targetUserId}`, {
      body: { role: "user" },
    });
    const res = await PATCH(req, { params: { id: String(targetUserId) } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.role).toBe("user");
    expect(mockRoleChange).toHaveBeenCalledWith(targetUserId, adminId, "admin", "user");

    // Reset
    await (db as any).update(users).set({ role: "user" }).where(eq(users.id, targetUserId) as any);
    mockRoleChange.mockClear();
  });

  it("admin self-demotion → 403", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/users/${adminId}`, {
      body: { role: "user" },
    });
    const res = await PATCH(req, { params: { id: String(adminId) } });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/You cannot change your own role|无法修改自己的角色/);

    // DB must not have changed
    const { users } = await import("@/lib/db/schema");
    const adminUser = await db.query.users.findFirst({ where: eq(users.id, adminId) } as any);
    expect(adminUser.role).toBe("admin");
  });

  it("role unchanged → 200, no DB write, no analytics call", async () => {
    const { users } = await import("@/lib/db/schema");
    // Ensure role is user
    await (db as any).update(users).set({ role: "user" }).where(eq(users.id, targetUserId) as any);

    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/users/${targetUserId}`, {
      body: { role: "user" },
    });
    const res = await PATCH(req, { params: { id: String(targetUserId) } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.role).toBe("user");
    // No analytics call for no-op changes
    expect(mockRoleChange).not.toHaveBeenCalled();
  });

  it("invalid role value → 400", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/users/${targetUserId}`, {
      body: { role: "superadmin" },
    });
    const res = await PATCH(req, { params: { id: String(targetUserId) } });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/role must be one of: user, reviewer, admin|role 必须为以下之一/);
  });

  it("missing role field → 400", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/users/${targetUserId}`, {
      body: {},
    });
    const res = await PATCH(req, { params: { id: String(targetUserId) } });
    expect(res.status).toBe(400);
  });

  it("non-existent user → 404", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", "/api/admin/users/99999", {
      body: { role: "admin" },
    });
    const res = await PATCH(req, { params: { id: "99999" } });
    expect(res.status).toBe(404);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/users/${targetUserId}`, {
      body: { role: "admin" },
    });
    const res = await PATCH(req, { params: { id: String(targetUserId) } });
    expect(res.status).toBe(403);
  });

  it("reviewer → 403 (reviewers cannot manage user roles)", async () => {
    cookieStore.token = reviewerCookie.replace("clawplay_token=", "");
    const req = makeRequest("PATCH", `/api/admin/users/${targetUserId}`, {
      body: { role: "admin" },
    });
    const res = await PATCH(req, { params: { id: String(targetUserId) } });
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("PATCH", `/api/admin/users/${targetUserId}`, {
      body: { role: "admin" },
    });
    const res = await PATCH(req, { params: { id: String(targetUserId) } });
    expect(res.status).toBe(401);
  });
});
