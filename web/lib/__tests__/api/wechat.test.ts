/**
 * WeChat OAuth integration tests.
 * Covers lib/wechat.ts (unit) + wechat/route.ts + wechat/callback/route.ts
 * External WeChat API is mocked via vi.stubGlobal("fetch") / vi.mock.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tempDbPath, cleanupDb } from "../helpers/db";
import { makeRequest } from "../helpers/request";

// ── next/headers mock ─────────────────────────────────────────────────────────
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(() => ({ get: () => undefined })),
}));

// Stable mock functions shared across vi.mock factory calls
const checkQuotaMock = vi.hoisted(() => vi.fn());
const incrementQuotaMock = vi.hoisted(() => vi.fn());
const getQuotaMock = vi.hoisted(() => vi.fn());

// Re-export constants so auth routes can import DEFAULT_QUOTA_FREE without loading real Redis
vi.mock("@/lib/redis", () => ({
  DEFAULT_QUOTA_FREE: 100000,
  ABILITY_COSTS: {},
  checkQuota: checkQuotaMock,
  incrementQuota: incrementQuotaMock,
  getQuota: getQuotaMock,
  ensureQuota: vi.fn().mockResolvedValue(undefined),
  initQuota: vi.fn(),
  getRedis: vi.fn().mockReturnValue(null),
}));

// ── Env vars ──────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.WECHAT_APP_ID = "wx_test_appid";
process.env.WECHAT_APP_SECRET = "test_app_secret";
process.env.WECHAT_REDIRECT_BASE_URL = "https://clawplay.test";

let dbPath: string;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  await dbMod.db; // trigger auto-migration
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
});

// ─────────────────────────────────────────────────────────────────────────────
// lib/wechat.ts unit tests (fetch mocked)
// ─────────────────────────────────────────────────────────────────────────────

describe("lib/wechat — getWechatAuthUrl", () => {
  it("builds correct OAuth redirect URL with encoded state", async () => {
    const { getWechatAuthUrl } = await import("@/lib/wechat");
    const url = getWechatAuthUrl("test-state");
    expect(url).toContain("open.weixin.qq.com/connect/oauth2/authorize");
    expect(url).toContain("appid=wx_test_appid");
    expect(url).toContain("scope=snsapi_userinfo");
    expect(url).toContain(encodeURIComponent("test-state"));
    expect(url).toContain("clawplay.test");
  });

  it("throws when env vars are missing", async () => {
    const saved = process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_ID;
    vi.resetModules();
    const { getWechatAuthUrl } = await import("@/lib/wechat");
    expect(() => getWechatAuthUrl("state")).toThrow(/not configured/i);
    process.env.WECHAT_APP_ID = saved!;
  });
});

describe("lib/wechat — exchangeCode", () => {
  it("returns openid + accessToken on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        access_token: "mock_access_token",
        openid: "mock_openid_123",
        expires_in: 7200,
      }),
    }));

    vi.resetModules();
    const { exchangeCode } = await import("@/lib/wechat");
    const result = await exchangeCode("auth_code_abc");

    expect(result.openid).toBe("mock_openid_123");
    expect(result.accessToken).toBe("mock_access_token");
    expect(result.expiresIn).toBe(7200);

    vi.unstubAllGlobals();
  });

  it("throws on WeChat error response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ errcode: 40029, errmsg: "invalid code" }),
    }));

    vi.resetModules();
    const { exchangeCode } = await import("@/lib/wechat");
    await expect(exchangeCode("bad_code")).rejects.toThrow(/invalid code/);

    vi.unstubAllGlobals();
  });
});

describe("lib/wechat — getWechatUserInfo", () => {
  it("returns user profile on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        openid: "mock_openid_123",
        nickname: "Alice",
        headimgurl: "https://wx.qlogo.cn/alice.png",
      }),
    }));

    vi.resetModules();
    const { getWechatUserInfo } = await import("@/lib/wechat");
    const info = await getWechatUserInfo("tok", "mock_openid_123");

    expect(info.openid).toBe("mock_openid_123");
    expect(info.nickname).toBe("Alice");

    vi.unstubAllGlobals();
  });

  it("throws on WeChat error response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ errcode: 40001, errmsg: "invalid access_token" }),
    }));

    vi.resetModules();
    const { getWechatUserInfo } = await import("@/lib/wechat");
    await expect(getWechatUserInfo("bad_tok", "oid")).rejects.toThrow(/invalid access_token/);

    vi.unstubAllGlobals();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/wechat — redirect initiator
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/auth/wechat", () => {
  it("redirects to WeChat OAuth URL", async () => {
    vi.resetModules();
    const { GET } = await import("@/app/api/auth/wechat/route");
    const req = makeRequest("GET", "/api/auth/wechat?redirect=/dashboard");
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("open.weixin.qq.com");
    expect(location).toContain("wx_test_appid");
  });

  it("returns 503 when WeChat env vars are missing", async () => {
    const saved = process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_ID;
    vi.resetModules();
    const { GET } = await import("@/app/api/auth/wechat/route");
    const req = makeRequest("GET", "/api/auth/wechat");
    const res = await GET(req);

    expect(res.status).toBe(503);
    process.env.WECHAT_APP_ID = saved!;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/wechat/callback — OAuth callback handler
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/auth/wechat/callback", () => {
  it("new user: creates user + identity, sets cookie, redirects to /dashboard", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ access_token: "tok", openid: "oid_new_user", expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ openid: "oid_new_user", nickname: "Bob", headimgurl: "" }),
      })
    );

    vi.resetModules();
    const { GET } = await import("@/app/api/auth/wechat/callback/route");
    const state = Buffer.from("/dashboard").toString("base64url");
    const req = makeRequest("GET", `/api/auth/wechat/callback?code=wx_code_new&state=${state}`);
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard");
    // Cookie should be set
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("clawplay_token");

    vi.unstubAllGlobals();
  });

  it("existing user: finds identity, sets cookie, redirects", async () => {
    // First call creates the user
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ access_token: "tok", openid: "oid_existing", expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ openid: "oid_existing", nickname: "Carol", headimgurl: "" }),
      })
    );

    vi.resetModules();
    const { GET } = await import("@/app/api/auth/wechat/callback/route");
    const state = Buffer.from("/dashboard").toString("base64url");
    await GET(makeRequest("GET", `/api/auth/wechat/callback?code=c1&state=${state}`));

    // Second call (existing user login)
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ access_token: "tok2", openid: "oid_existing", expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ openid: "oid_existing", nickname: "Carol", headimgurl: "" }),
      })
    );

    const res = await GET(makeRequest("GET", `/api/auth/wechat/callback?code=c2&state=${state}`));

    expect(res.status).toBe(307);
    expect(res.headers.get("set-cookie")).toContain("clawplay_token");

    vi.unstubAllGlobals();
  });

  it("missing code → redirects to /login?error=wechat_denied", async () => {
    vi.resetModules();
    const { GET } = await import("@/app/api/auth/wechat/callback/route");
    const req = makeRequest("GET", "/api/auth/wechat/callback");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("wechat_denied");
  });

  it("exchangeCode failure → redirects to /login?error=wechat_failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ errcode: 40029, errmsg: "invalid code" }),
    }));

    vi.resetModules();
    const { GET } = await import("@/app/api/auth/wechat/callback/route");
    const req = makeRequest("GET", "/api/auth/wechat/callback?code=bad_code");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("wechat_failed");

    vi.unstubAllGlobals();
  });
});
