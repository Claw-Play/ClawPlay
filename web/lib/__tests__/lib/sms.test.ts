/**
 * Unit tests for lib/sms.ts
 * Covers sendSmsCode (dev fallback + Aliyun path) and verifySmsCode.
 * Aliyun HTTP call is mocked via vi.stubGlobal("fetch").
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { tempDbPath, cleanupDb } from "../helpers/db";

process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);

let dbPath: string;
let sendSmsCode: (phone: string) => Promise<void>;
let verifySmsCode: (phone: string, code: string) => Promise<boolean>;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  await (await import("@/lib/db")).db;

  const mod = await import("@/lib/sms");
  sendSmsCode = mod.sendSmsCode;
  verifySmsCode = mod.verifySmsCode;
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  delete process.env.ALIYUN_SMS_ACCESS_KEY_ID;
  delete process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
  delete process.env.ALIYUN_SMS_SIGN_NAME;
  delete process.env.ALIYUN_SMS_TEMPLATE_CODE;
  vi.unstubAllGlobals();
});

describe("sendSmsCode — dev mode (no Aliyun env vars)", () => {
  it("writes code to DB and logs to console without throwing", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const phone = "13800000001";

    await expect(sendSmsCode(phone)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(phone));

    consoleSpy.mockRestore();
  });
});

describe("verifySmsCode", () => {
  it("returns true for a valid, unexpired code", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const phone = "13800000002";

    // sendSmsCode writes the code to DB; intercept the log to get the code
    let capturedCode = "";
    consoleSpy.mockImplementation((msg: string) => {
      const match = msg.match(/Code:\s+(\d{6})/);
      if (match) capturedCode = match[1];
    });

    await sendSmsCode(phone);
    consoleSpy.mockRestore();

    expect(capturedCode).toMatch(/^\d{6}$/);
    const result = await verifySmsCode(phone, capturedCode);
    expect(result).toBe(true);
  });

  it("returns false for wrong code", async () => {
    const phone = "13800000003";
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await sendSmsCode(phone);
    consoleSpy.mockRestore();

    const result = await verifySmsCode(phone, "000000");
    expect(result).toBe(false);
  });

  it("returns false when code is already used", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const phone = "13800000004";
    let capturedCode = "";
    consoleSpy.mockImplementation((msg: string) => {
      const match = msg.match(/Code:\s+(\d{6})/);
      if (match) capturedCode = match[1];
    });

    await sendSmsCode(phone);
    consoleSpy.mockRestore();

    await verifySmsCode(phone, capturedCode); // first use — true
    const second = await verifySmsCode(phone, capturedCode); // already used
    expect(second).toBe(false);
  });
});

describe("sendSmsCode — Aliyun path (all env vars set)", () => {
  beforeAll(() => {
    process.env.ALIYUN_SMS_ACCESS_KEY_ID = "test_key_id";
    process.env.ALIYUN_SMS_ACCESS_KEY_SECRET = "test_key_secret";
    process.env.ALIYUN_SMS_SIGN_NAME = "TestSign";
    process.env.ALIYUN_SMS_TEMPLATE_CODE = "SMS_123456";
  });

  it("calls Aliyun API and succeeds on Code=OK", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ Code: "OK", Message: "OK" }),
    }));

    vi.resetModules();
    const mod = await import("@/lib/sms");
    await expect(mod.sendSmsCode("13900000001")).resolves.toBeUndefined();

    const fetchMock = vi.mocked(globalThis.fetch as any);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://dysmsapi.aliyuncs.com/",
      expect.objectContaining({ method: "POST" })
    );

    vi.unstubAllGlobals();
  });

  it("throws when Aliyun returns non-OK code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ Code: "isv.BUSINESS_LIMIT_CONTROL", Message: "触发流控" }),
    }));

    vi.resetModules();
    const mod = await import("@/lib/sms");
    await expect(mod.sendSmsCode("13900000002")).rejects.toThrow(/BUSINESS_LIMIT_CONTROL/);

    vi.unstubAllGlobals();
  });
});
