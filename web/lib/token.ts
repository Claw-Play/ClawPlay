import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT = "clawplay-salt-v1"; // Static salt for PBKDF2 — not user-specific in Phase 1

// Cached derived key — scrypt is CPU-intensive; derive once per process lifetime
let _cachedKey: Buffer | null = null;
let _cachedSecret: string | null = null;

/**
 * Get the encryption key (cached per secret). Throws in production if not configured.
 */
function getKey(): Buffer {
  const secret = process.env.CLAWPLAY_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CLAWPLAY_SECRET_KEY environment variable is required.");
    }
    // Dev fallback — never used in production
    return scryptSync("clawplay-dev-secret-do-not-use-in-prod", SALT, 32);
  }
  if (_cachedKey && _cachedSecret === secret) return _cachedKey;
  _cachedSecret = secret;
  _cachedKey = scryptSync(secret, SALT, 32);
  return _cachedKey;
}

/**
 * Encrypt a JSON payload with AES-256-GCM.
 * Returns base64 string: iv (12) + authTag (16) + ciphertext
 */
export function encryptToken(payload: object): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const json = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine: iv + authTag + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt an AES-256-GCM token and return the parsed JSON payload.
 * Throws on invalid input or wrong key.
 */
export function decryptToken<T = Record<string, unknown>>(encrypted: string): T {
  const key = getKey();
  const raw = Buffer.from(encrypted, "base64");

  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(decrypted) as T;
}

/** Hash a token for storage (prevents enumeration attacks) */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Token payload shape */
export interface TokenPayload {
  userId: number;
  quotaFree: number;
  quotaUsed: number;
  exp?: number; // Deprecated: tokens are permanent, kept for backwards compat
}
