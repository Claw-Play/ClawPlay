/**
 * Integration tests for auth API routes.
 * Uses a real SQLite temp DB; Redis and SMS are mocked.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tempDbPath, cleanupDb } from "../helpers/db";
import { makeRequest } from "../helpers/request";

// ── Redis mock ────────────────────────────────────────────────────────────────
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    eval: vi.fn().mockResolvedValue(990),
  })),
}));

// ── next/headers mock ─────────────────────────────────────────────────────────
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined) }),
}));

// ── Env vars ──────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

let dbPath: string;
let db: any;
let POST_register: (req: any) => Promise<Response>;
let POST_login: (req: any) => Promise<Response>;
let POST_logout: (req: any) => Promise<Response>;
let POST_smsSend: (req: any) => Promise<Response>;
let POST_smsVerify: (req: any) => Promise<Response>;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const registerMod = await import("@/app/api/auth/register/route");
  const loginMod = await import("@/app/api/auth/login/route");
  const logoutMod = await import("@/app/api/auth/logout/route");
  const smsSendMod = await import("@/app/api/auth/sms/send/route");
  const smsVerifyMod = await import("@/app/api/auth/sms/verify/route");

  POST_register = registerMod.POST;
  POST_login = loginMod.POST;
  POST_logout = logoutMod.POST;
  POST_smsSend = smsSendMod.POST;
  POST_smsVerify = smsVerifyMod.POST;
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  it("valid registration → 201 + user email + set-cookie", async () => {
    const req = makeRequest("POST", "/api/auth/register", {
      body: { email: "alice@example.com", password: "password123", name: "Alice" },
    });
    const res = await POST_register(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.user.email).toBe("alice@example.com");
    expect(res.headers.get("set-cookie")).toContain("clawplay_token=");
  });

  it("creates a user_identities record with provider=email", async () => {
    const email = "identity-check@example.com";
    await POST_register(
      makeRequest("POST", "/api/auth/register", {
        body: { email, password: "password123" },
      })
    );

    const { userIdentities } = await import("@/lib/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const identity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.provider, "email"),
        eq(userIdentities.providerAccountId, email)
      ),
    });
    expect(identity).toBeTruthy();
    expect(identity.credential).toBeTruthy(); // bcrypt hash
  });

  it("duplicate email → 409", async () => {
    const body = { email: "dup@example.com", password: "password123" };
    await POST_register(makeRequest("POST", "/api/auth/register", { body }));
    const res2 = await POST_register(makeRequest("POST", "/api/auth/register", { body }));
    const json = await res2.json();

    expect(res2.status).toBe(409);
    expect(json.error).toMatch(/already exists/i);
  });

  it("password < 8 chars → 400", async () => {
    const res = await POST_register(
      makeRequest("POST", "/api/auth/register", {
        body: { email: "short@example.com", password: "short" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("invalid email format → 400", async () => {
    const res = await POST_register(
      makeRequest("POST", "/api/auth/register", {
        body: { email: "not-an-email", password: "password123" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("name is optional — omitting name still succeeds", async () => {
    const res = await POST_register(
      makeRequest("POST", "/api/auth/register", {
        body: { email: "noname@example.com", password: "password123" },
      })
    );
    expect(res.status).toBe(201);
  });
});

describe("POST /api/auth/login", () => {
  it("correct credentials → 200 + set-cookie", async () => {
    await POST_register(
      makeRequest("POST", "/api/auth/register", {
        body: { email: "login-user@example.com", password: "password123" },
      })
    );

    const res = await POST_login(
      makeRequest("POST", "/api/auth/login", {
        body: { email: "login-user@example.com", password: "password123" },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("clawplay_token=");
  });

  it("wrong password → 401 + error message", async () => {
    await POST_register(
      makeRequest("POST", "/api/auth/register", {
        body: { email: "wrongpw@example.com", password: "password123" },
      })
    );

    const res = await POST_login(
      makeRequest("POST", "/api/auth/login", {
        body: { email: "wrongpw@example.com", password: "wrongpassword" },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/invalid/i);
  });

  it("unknown email → 401", async () => {
    const res = await POST_login(
      makeRequest("POST", "/api/auth/login", {
        body: { email: "ghost@example.com", password: "password123" },
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("logout → clears cookie (Max-Age=0) and redirects", async () => {
    const req = makeRequest("POST", "/api/auth/logout");
    const res = await POST_logout(req);

    expect(res.status).toBe(307);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("Max-Age=0");
  });
});

describe("POST /api/auth/sms/send", () => {
  it("valid phone → 200 + writes sms_codes record", async () => {
    const phone = "13800138001";
    const res = await POST_smsSend(
      makeRequest("POST", "/api/auth/sms/send", { body: { phone } })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toMatch(/验证码/);

    // Verify a code was written to DB
    const { smsCodes } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const record = await db.query.smsCodes.findFirst({
      where: eq(smsCodes.phone, phone),
    });
    expect(record).toBeTruthy();
    expect(record.code).toMatch(/^\d{6}$/);
    expect(record.usedAt).toBeNull();
    expect(record.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("invalid phone format → 400", async () => {
    const res = await POST_smsSend(
      makeRequest("POST", "/api/auth/sms/send", { body: { phone: "12345" } })
    );
    expect(res.status).toBe(400);
  });

  it("missing phone → 400", async () => {
    const res = await POST_smsSend(
      makeRequest("POST", "/api/auth/sms/send", { body: {} })
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/sms/verify", () => {
  it("valid code → 200, auto-registers new user, set-cookie", async () => {
    const phone = "13900139001";

    // Send code first (dev mode writes to DB)
    await POST_smsSend(
      makeRequest("POST", "/api/auth/sms/send", { body: { phone } })
    );

    // Read the code from DB
    const { smsCodes } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const record = await db.query.smsCodes.findFirst({
      where: eq(smsCodes.phone, phone),
    });

    const res = await POST_smsVerify(
      makeRequest("POST", "/api/auth/sms/verify", {
        body: { phone, code: record.code, name: "PhoneUser" },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user.phone).toBe(phone);
    expect(res.headers.get("set-cookie")).toContain("clawplay_token=");

    // Code marked as used
    const used = await db.query.smsCodes.findFirst({
      where: eq(smsCodes.phone, phone),
    });
    expect(used.usedAt).not.toBeNull();
  });

  it("second login with same phone → 200, same user returned", async () => {
    const phone = "13700137001";

    // First login
    await POST_smsSend(makeRequest("POST", "/api/auth/sms/send", { body: { phone } }));
    const { smsCodes } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const r1 = await db.query.smsCodes.findFirst({ where: eq(smsCodes.phone, phone) });
    const res1 = await POST_smsVerify(
      makeRequest("POST", "/api/auth/sms/verify", { body: { phone, code: r1.code } })
    );
    const user1 = (await res1.json()).user;

    // Second login
    await POST_smsSend(makeRequest("POST", "/api/auth/sms/send", { body: { phone } }));
    const records = await db.query.smsCodes.findMany({ where: eq(smsCodes.phone, phone) });
    const r2 = records.find((r: any) => !r.usedAt);
    const res2 = await POST_smsVerify(
      makeRequest("POST", "/api/auth/sms/verify", { body: { phone, code: r2.code } })
    );
    const user2 = (await res2.json()).user;

    expect(user1.id).toBe(user2.id); // same user, not duplicate
  });

  it("wrong code → 401", async () => {
    const phone = "13600136001";
    await POST_smsSend(makeRequest("POST", "/api/auth/sms/send", { body: { phone } }));

    const res = await POST_smsVerify(
      makeRequest("POST", "/api/auth/sms/verify", { body: { phone, code: "999999" } })
    );
    expect(res.status).toBe(401);
  });

  it("invalid phone → 400", async () => {
    const res = await POST_smsVerify(
      makeRequest("POST", "/api/auth/sms/verify", { body: { phone: "123", code: "123456" } })
    );
    expect(res.status).toBe(400);
  });

  it("invalid code format (non-6-digit) → 400", async () => {
    const res = await POST_smsVerify(
      makeRequest("POST", "/api/auth/sms/verify", { body: { phone: "13800138002", code: "abc" } })
    );
    expect(res.status).toBe(400);
  });
});
