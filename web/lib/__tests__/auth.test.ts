import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";

describe("Auth helpers", () => {
  it("SignJWT produces a non-empty JWT string", async () => {
    const secret = new TextEncoder().encode("test-secret-for-unit-tests-32b!");
    const token = await new SignJWT({ userId: 42 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
  });

  it("JWT payload is correctly encoded and decodable", async () => {
    const secret = new TextEncoder().encode("another-test-secret-key-32b!!");
    const payload = { userId: 7, role: "user" };
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(secret);

    // Decode the payload part (middle segment)
    const [, payloadB64] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));

    expect(decoded.userId).toBe(7);
    expect(decoded.role).toBe("user");
  });
});
