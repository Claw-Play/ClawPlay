/**
 * Integration tests for GET /api/admin/audit-logs
 * Uses real SQLite temp DB; mocks next/headers and fs module.
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
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  delete process.env.AUDIT_LOG_PATH;
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

  it("admin, no audit file → 200 with empty entries", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");
    // Point to a path that doesn't exist
    process.env.AUDIT_LOG_PATH = "/tmp/nonexistent-audit-log-clawplay.jsonl";

    const req = makeRequest("GET", "/api/admin/audit-logs", { cookie: adminCookie });
    const res = await GET_auditLogs(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.entries).toEqual([]);
    expect(json.total).toBe(0);
  });

  it("admin, existing audit file → 200 with parsed entries", async () => {
    cookieStore.token = adminCookie.replace("clawplay_token=", "");

    // Write a temp audit log file
    const { writeFileSync } = await import("fs");
    const tmpLog = `/tmp/clawplay-audit-test-${Date.now()}.jsonl`;
    const entries = [
      { action: "approve_skill", targetId: "s1", ts: "2026-04-01T00:00:00Z" },
      { action: "reject_skill", targetId: "s2", ts: "2026-04-02T00:00:00Z" },
    ];
    writeFileSync(tmpLog, entries.map((e) => JSON.stringify(e)).join("\n"), "utf8");
    process.env.AUDIT_LOG_PATH = tmpLog;

    const req = makeRequest("GET", "/api/admin/audit-logs?limit=10&offset=0", {
      cookie: adminCookie,
    });
    const res = await GET_auditLogs(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.total).toBe(2);
    expect(json.entries.length).toBeGreaterThan(0);
    expect(json.entries[0]).toHaveProperty("action");

    // Cleanup temp file
    const { unlinkSync } = await import("fs");
    try { unlinkSync(tmpLog); } catch { /* ok */ }
  });
});
