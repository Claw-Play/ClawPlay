/**
 * Integration tests for GET /api/admin/audit-logs
 * Reads from event_logs table (no longer reads audit.jsonl).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tempDbPath, cleanupDb, seedAdmin, seedUser } from "../helpers/db";
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
let GET_auditLogs: (req: any) => Promise<Response>;
let adminCookie: string;
let userCookie: string;
let adminId: number;
let userId: number;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const mod = await import("@/app/api/admin/audit-logs/route");
  GET_auditLogs = mod.GET;

  const admin = await seedAdmin(db);
  const user = await seedUser(db);
  adminCookie = admin.cookie;
  userCookie = user.cookie;
  adminId = admin.id;
  userId = user.id;

  // Seed some event_logs records
  const { eventLogs: events } = await import("@/lib/db/schema");
  const now = new Date();
  const ago60 = new Date(now.getTime() - 60_000);
  const ago120 = new Date(now.getTime() - 120_000);
  const ago180 = new Date(now.getTime() - 180_000);
  await (db as any).insert(events).values([
    { event: "skill.submit", userId, targetType: "skill", targetId: "skill-submit-1", metadata: "{}", createdAt: now },
    { event: "skill.approve", userId: adminId, targetType: "skill", targetId: "skill-approve-1", metadata: "{}", createdAt: now },
    { event: "skill.reject", userId: adminId, targetType: "skill", targetId: "skill-reject-1", metadata: "{}", createdAt: ago60 },
    { event: "skill.feature", userId: adminId, targetType: "skill", targetId: "skill-feature-1", metadata: "{}", createdAt: ago120 },
    { event: "user.login", userId, targetType: "user", targetId: String(userId), metadata: "{}", createdAt: ago180 },
  ]);
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

describe("GET /api/admin/audit-logs", () => {
  it("unauthenticated → 401", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("GET", "/api/admin/audit-logs");
    const res = await GET_auditLogs(req);
    expect(res.status).toBe(401);
  });

  it("regular user → 403", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/audit-logs", { cookie: userCookie });
    const res = await GET_auditLogs(req);
    expect(res.status).toBe(403);
  });

  it("admin, tab=skills → only skill events returned", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/audit-logs?tab=skills", { cookie: adminCookie });
    const res = await GET_auditLogs(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(4); // submit, approve, reject, feature
    for (const entry of json.entries) {
      expect(["skill.submit", "skill.approve", "skill.reject", "skill.feature"]).toContain(entry.event);
    }
  });

  it("admin, tab=all → all events returned", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/audit-logs?tab=all", { cookie: adminCookie });
    const res = await GET_auditLogs(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(5); // all seeded events
  });

  it("admin, pagination → returns correct page", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    const req = makeRequest("GET", "/api/admin/audit-logs?tab=all&limit=2&offset=0", { cookie: adminCookie });
    const res = await GET_auditLogs(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(5);
    expect(json.entries.length).toBeLessThanOrEqual(2);
  });
});
