/**
 * Unit tests for auth.ts helpers: signJWT, verifyJWT, buildSetCookieHeader, buildClearCookieHeader
 */
import { describe, it, expect, afterAll } from "vitest";
import { SignJWT } from "jose";

// Set env before module load
process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";

const { signJWT, verifyJWT, buildSetCookieHeader, buildClearCookieHeader } = await import("@/lib/auth");

describe("signJWT", () => {
  it("produces a valid JWT string", async () => {
    const token = await signJWT({ userId: 42, role: "user" });
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("contains the correct userId in payload", async () => {
    const token = await signJWT({ userId: 99, role: "admin" });
    const payload = await verifyJWT(token);
    expect(payload?.userId).toBe(99);
    expect(payload?.role).toBe("admin");
  });
});

describe("verifyJWT", () => {
  it("returns payload for a valid token", async () => {
    const token = await signJWT({ userId: 1, role: "user" });
    const result = await verifyJWT(token);
    expect(result?.userId).toBe(1);
    expect(result?.role).toBe("user");
  });

  it("returns null for an invalid (malformed) token", async () => {
    const result = await verifyJWT("not.a.valid.token");
    expect(result).toBeNull();
  });

  it("returns null for a completely random string", async () => {
    const result = await verifyJWT("this-is-not-a-jwt-at-all");
    expect(result).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    const wrongSecret = new TextEncoder().encode("completely-different-secret-32b!!");
    const badToken = await new SignJWT({ userId: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(wrongSecret);
    const result = await verifyJWT(badToken);
    expect(result).toBeNull();
  });
});

describe("buildSetCookieHeader", () => {
  it("includes required cookie attributes", () => {
    const header = buildSetCookieHeader("abc123token");
    expect(header).toContain("clawplay_token=abc123token");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Max-Age=");
    expect(header).toContain("Path=/");
    // In vitest NODE_ENV=test, Secure should NOT be present
    expect(header).not.toContain("Secure");
  });

  it("sets 7-day Max-Age (604800 seconds)", () => {
    const header = buildSetCookieHeader("tok");
    expect(header).toContain("Max-Age=604800");
  });
});

describe("buildClearCookieHeader", () => {
  it("sets Max-Age=0 to delete the cookie", () => {
    const header = buildClearCookieHeader();
    expect(header).toContain("clawplay_token=");
    expect(header).toContain("Max-Age=0");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    // In vitest NODE_ENV=test, Secure should NOT be present
    expect(header).not.toContain("Secure");
  });
});
