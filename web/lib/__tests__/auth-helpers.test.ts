import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  signJWT,
  verifyJWT,
  buildSetCookieHeader,
  buildClearCookieHeader,
  setAuthCookie,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
} from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";

describe("Auth helpers", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-32b!";
  });

  afterAll(() => {
    if (originalSecret !== undefined) {
      process.env.JWT_SECRET = originalSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  const testPayload: JWTPayload = {
    userId: 1,
    email: "test@example.com",
    role: "user",
  };

  it("signJWT produces a valid 3-part JWT string", async () => {
    const token = await signJWT(testPayload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifyJWT returns payload for a valid token", async () => {
    const token = await signJWT(testPayload);
    const payload = await verifyJWT(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(1);
    expect(payload!.email).toBe("test@example.com");
    expect(payload!.role).toBe("user");
  });

  it("verifyJWT returns null for an invalid token", async () => {
    const result = await verifyJWT("not.a.valid.jwt");
    expect(result).toBeNull();
  });

  it("verifyJWT returns null for a tampered token", async () => {
    const token = await signJWT(testPayload);
    const tampered = token.slice(0, -5) + "XXXXX";
    const result = await verifyJWT(tampered);
    expect(result).toBeNull();
  });

  it("signJWT encodes role correctly for admin", async () => {
    const adminPayload: JWTPayload = { userId: 99, email: "admin@example.com", role: "admin" };
    const token = await signJWT(adminPayload);
    const payload = await verifyJWT(token);
    expect(payload!.role).toBe("admin");
  });

  it("setAuthCookie returns the token string", () => {
    const result = setAuthCookie("mytoken");
    expect(result).toBe("mytoken");
  });

  it("buildSetCookieHeader includes all security flags", () => {
    const header = buildSetCookieHeader("mytoken");
    expect(header).toContain(`${COOKIE_NAME}=mytoken`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Strict");
    expect(header).toContain(`Max-Age=${COOKIE_MAX_AGE}`);
    expect(header).toContain("Path=/");
    // Secure flag is only set in production
    if (process.env.NODE_ENV === "production") {
      expect(header).toContain("Secure");
    }
  });

  it("buildClearCookieHeader sets Max-Age=0 to delete the cookie", () => {
    const header = buildClearCookieHeader();
    expect(header).toContain(`${COOKIE_NAME}=`);
    expect(header).toContain("Max-Age=0");
    expect(header).toContain("HttpOnly");
    // Secure flag is only set in production
    if (process.env.NODE_ENV === "production") {
      expect(header).toContain("Secure");
    }
  });
});
