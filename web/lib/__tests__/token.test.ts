import { describe, it, expect, beforeAll } from "vitest";
import { encryptToken, decryptToken, hashToken, type TokenPayload } from "@/lib/token";

describe("Token encryption (AES-256-GCM)", () => {
  // Use test key (bypasses CLAWPLAY_SECRET_KEY requirement)
  const originalEnv = process.env.CLAWPLAY_SECRET_KEY;
  beforeAll(() => {
    process.env.CLAWPLAY_SECRET_KEY = "test-secret-key-for-unit-tests-32b";
    process.env.NODE_ENV = "test";
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.CLAWPLAY_SECRET_KEY = originalEnv;
    } else {
      delete process.env.CLAWPLAY_SECRET_KEY;
    }
  });

  it("encrypts and decrypts a payload correctly", () => {
    const payload: TokenPayload = { userId: 42 };

    const encrypted = encryptToken(payload);
    expect(typeof encrypted).toBe("string");
    expect(encrypted.length).toBeGreaterThan(0);

    // Encrypted text should not contain plaintext JSON keys
    expect(encrypted).not.toContain("userId");

    // Decrypt
    const decrypted = decryptToken<TokenPayload>(encrypted);
    expect(decrypted.userId).toBe(42);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const payload: TokenPayload = { userId: 1 };

    const enc1 = encryptToken(payload);
    const enc2 = encryptToken(payload);

    // Different IVs → different ciphertext
    expect(enc1).not.toBe(enc2);

    // Both should still decrypt to the same payload
    expect(decryptToken<TokenPayload>(enc1).userId).toBe(1);
    expect(decryptToken<TokenPayload>(enc2).userId).toBe(1);
  });

  it("throws on tampered ciphertext", () => {
    const payload: TokenPayload = { userId: 99 };

    const encrypted = encryptToken(payload);
    const tampered = encrypted.slice(0, -4) + "XXXX";

    expect(() => decryptToken(tampered)).toThrow();
  });

  it("hashToken produces consistent sha256 hex", () => {
    const token = "abc123";
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex = 64 chars
  });

  it("hashToken is different for different tokens", () => {
    const hash1 = hashToken("token-a");
    const hash2 = hashToken("token-b");

    expect(hash1).not.toBe(hash2);
  });

  it("uses dev fallback key when CLAWPLAY_SECRET_KEY is not set (non-production)", () => {
    const saved = process.env.CLAWPLAY_SECRET_KEY;
    delete process.env.CLAWPLAY_SECRET_KEY;
    // NODE_ENV is "test", not "production" — should use dev fallback key silently
    const payload: TokenPayload = { userId: 7 };
    const enc = encryptToken(payload);
    const dec = decryptToken<TokenPayload>(enc);
    expect(dec.userId).toBe(7);
    // Restore
    if (saved !== undefined) process.env.CLAWPLAY_SECRET_KEY = saved;
  });
});
