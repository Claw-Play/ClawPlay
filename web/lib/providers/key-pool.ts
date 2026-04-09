/**
 * Key Pool Management — multi-key sharding with 429 auto-failover
 *
 * Key concepts:
 * - Keys are stored encrypted in DB (AES-256-GCM, same as user_tokens)
 * - Active key list is cached in Redis (30s TTL) for fast reads
 * - Round-robin + rate-limit awareness for key selection
 * - Window-based quota tracking per key (reset by cron)
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "crypto";
import { db } from "@/lib/db";
import { providerKeys } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getRedis } from "@/lib/redis";

// Reuse the same crypto pattern as token.ts
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const CACHE_TTL = 30; // seconds
const MAX_RETRIES = 3; // max key attempts before giving up

// In-memory counter for round-robin (per-process, good enough for single instance)
const roundRobinCounters: Record<string, number> = {};

/** Encrypt an API key for DB storage */
export function encryptApiKey(plaintextKey: string): { encrypted: string; hash: string } {
  const secret = process.env.CLAWPLAY_SECRET_KEY ?? "clawplay-dev-secret-do-not-use-in-prod";
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encryptedB64 = Buffer.concat([iv, authTag, encrypted]).toString("base64");
  const hash = createHash("sha256").update(plaintextKey).digest("hex");
  return { encrypted: encryptedB64, hash };
}

/** Decrypt an API key from DB */
export function decryptApiKey(encryptedKey: string): string {
  const secret = process.env.CLAWPLAY_SECRET_KEY ?? "clawplay-dev-secret-do-not-use-in-prod";
  const key = deriveKey(secret);
  const raw = Buffer.from(encryptedKey, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "clawplay-salt-v1", 32);
}

// ---------------------------------------------------------------------------
// Core pool operations
// ---------------------------------------------------------------------------

/** Get all active (enabled, within quota) keys for a provider, cached in Redis */
export async function getActiveKeys(
  provider: string
): Promise<Array<{ id: number; hash: string; decryptedKey: string; quota: number }>> {
  const r = getRedis();
  const cacheKey = `clawplay:keys:${provider}`;

  // Try Redis cache first
  if (r) {
    try {
      const cached = await Promise.race([
        r.get<string>(cacheKey),
        new Promise<null>((res) => setTimeout(() => res(null), 500)),
      ]);
      if (cached) {
        const keys = JSON.parse(cached) as Array<{
          id: number;
          hash: string;
          decryptedKey: string;
          quota: number;
        }>;
        if (keys.length > 0) return keys;
      }
    } catch {
      // Cache miss — fall through to DB
    }
  }

  // DB query using Drizzle query builder
  const rows = await db
    .select({
      id: providerKeys.id,
      keyHash: providerKeys.keyHash,
      encryptedKey: providerKeys.encryptedKey,
      quota: providerKeys.quota,
      windowUsed: providerKeys.windowUsed,
    })
    .from(providerKeys)
    .where(and(eq(providerKeys.provider, provider), eq(providerKeys.enabled, true)));

  const result: Array<{ id: number; hash: string; decryptedKey: string; quota: number }> = [];

  for (const row of rows) {
    // Skip keys that are rate-limited in current window
    if (row.windowUsed >= row.quota) continue;

    try {
      const decryptedKey = decryptApiKey(row.encryptedKey);
      result.push({ id: row.id, hash: row.keyHash, decryptedKey, quota: row.quota });
    } catch {
      console.error(`[key-pool] Failed to decrypt key id=${row.id} for provider=${provider}`);
    }
  }

  // Cache in Redis (fire-and-forget)
  if (r) {
    r.setex(cacheKey, CACHE_TTL, JSON.stringify(result)).catch(() => {});
  }

  return result;
}

/**
 * Pick a key for a provider using round-robin.
 * Returns decrypted key string, or throws if no keys available.
 */
export async function pickKey(
  provider: string
): Promise<{ id: number; key: string; hash: string; quota: number }> {
  const keys = await getActiveKeys(provider);
  if (keys.length > 0) {
    // Round-robin
    const idx = (roundRobinCounters[provider] ?? 0) % keys.length;
    roundRobinCounters[provider] = idx + 1;
    const selected = keys[idx];
    return { id: selected.id, key: selected.decryptedKey, hash: selected.hash, quota: selected.quota };
  }

  // Fallback: use ARK_API_KEY env var directly (shared key for dev/self-hosted)
  if (provider === "ark_vision" || provider === "ark_image" || provider === "ark_llm") {
    const envKey = process.env.ARK_API_KEY;
    if (envKey) {
      return { id: 0, key: envKey, hash: "", quota: 999999 };
    }
  }

  throw new Error(`No active keys for provider: ${provider}`);
}

/**
 * Pick a key with 429 auto-failover.
 * Retries up to MAX_RETRIES times, skipping keys that are rate-limited.
 */
export async function pickKeyWithRetry(
  provider: string
): Promise<{ id: number; key: string; hash: string; quota: number }> {
  const attemptedIds = new Set<number>();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const picked = await pickKey(provider);

    // Avoid picking the same exhausted key again in the retry loop
    if (attemptedIds.has(picked.id)) continue;
    attemptedIds.add(picked.id);

    return picked;
  }

  throw new Error(`All keys for provider ${provider} are rate-limited. Please retry shortly.`);
}

/**
 * Record usage for a key after a successful API call.
 * Updates windowUsed in DB and invalidates Redis cache.
 */
export async function recordKeyUsage(provider: string, keyId: number): Promise<void> {
  try {
    await db
      .update(providerKeys)
      .set({ windowUsed: sql`${providerKeys.windowUsed} + 1` })
      .where(and(eq(providerKeys.id, keyId), eq(providerKeys.provider, provider)));

    // Invalidate cache so next pickKey() sees updated windowUsed
    const r = getRedis();
    if (r) {
      r.del(`clawplay:keys:${provider}`).catch(() => {});
    }
  } catch (err) {
    console.error(`[key-pool] Failed to record usage for key id=${keyId}`, err);
  }
}

// ---------------------------------------------------------------------------
// Admin CRUD (no decryption — for listing only)
// ---------------------------------------------------------------------------

/** Add a new key (plaintext input, stored encrypted). Throws if key hash already exists. */
export async function addProviderKey(
  provider: string,
  plaintextKey: string,
  quota: number
): Promise<number> {
  const { encrypted, hash } = encryptApiKey(plaintextKey);

  // Pre-check: reject duplicates explicitly rather than relying on DB constraint
  const existing = await db
    .select({ id: providerKeys.id })
    .from(providerKeys)
    .where(eq(providerKeys.keyHash, hash))
    .limit(1);

  if (existing.length > 0) {
    const err = new Error("Duplicate key hash");
    (err as NodeJS.ErrnoException).code = "DUPLICATE_KEY";
    throw err;
  }

  const now = Math.floor(Date.now() / 60000) * 60;

  const result = await db.insert(providerKeys).values({
    provider,
    encryptedKey: encrypted,
    keyHash: hash,
    quota,
    windowUsed: 0,
    windowStart: now,
    enabled: true,
  });

  // Invalidate cache
  const r = getRedis();
  if (r) {
    r.del(`clawplay:keys:${provider}`).catch(() => {});
  }

  return result.lastInsertRowid as number;
}

/** Revoke a key by hash */
export async function removeProviderKey(provider: string, keyHash: string): Promise<void> {
  await db
    .update(providerKeys)
    .set({ enabled: false })
    .where(and(eq(providerKeys.provider, provider), eq(providerKeys.keyHash, keyHash)));

  const r = getRedis();
  if (r) {
    r.del(`clawplay:keys:${provider}`).catch(() => {});
  }
}

/** List all keys for a provider (no plaintext, no auth tag) */
export async function listProviderKeys(
  provider: string
): Promise<
  Array<{
    id: number;
    keyHash: string;
    quota: number;
    windowUsed: number;
    windowStart: number;
    enabled: boolean;
    createdAt: Date;
  }>
> {
  const rows = await db
    .select({
      id: providerKeys.id,
      keyHash: providerKeys.keyHash,
      quota: providerKeys.quota,
      windowUsed: providerKeys.windowUsed,
      windowStart: providerKeys.windowStart,
      enabled: providerKeys.enabled,
      createdAt: providerKeys.createdAt,
    })
    .from(providerKeys)
    .where(eq(providerKeys.provider, provider))
    .orderBy(providerKeys.createdAt);

  return rows.map((row) => ({
    id: row.id,
    keyHash: row.keyHash,
    quota: row.quota,
    windowUsed: row.windowUsed,
    windowStart: row.windowStart,
    enabled: Boolean(row.enabled),
    createdAt: row.createdAt,
  }));
}

/** Reset all window counters for a provider (called by cron every minute) */
export async function resetKeyWindow(provider?: string): Promise<void> {
  const now = Math.floor(Date.now() / 60000) * 60;

  if (provider) {
    await db
      .update(providerKeys)
      .set({ windowUsed: 0, windowStart: now })
      .where(eq(providerKeys.provider, provider));
  } else {
    await db.update(providerKeys).set({ windowUsed: 0, windowStart: now });
  }

  // Flush all key caches
  const r = getRedis();
  if (r) {
    const keys = await r.keys("clawplay:keys:*");
    if (keys.length > 0) {
      r.del(...keys).catch(() => {});
    }
  }
}

/** Initialize keys from environment variable (comma-separated) */
export async function initKeysFromEnv(): Promise<void> {
  const envKey = process.env.ARK_API_KEY ?? process.env.ARK_IMAGE_KEYS;
  if (!envKey) return;

  const keys = envKey.split(",").map((k) => k.trim()).filter(Boolean);
  const quota = parseInt(process.env.ARK_KEY_QUOTA ?? "500", 10);

  for (const key of keys) {
    try {
      await addProviderKey("ark_image", key, quota);
      console.log(`[key-pool] Initialized Ark image key from env`);
    } catch (err: unknown) {
      // Ignore duplicate hash errors
      if ((err as NodeJS.ErrnoException)?.message?.includes("UNIQUE")) continue;
      console.error(`[key-pool] Failed to init key from env:`, err);
    }
  }
}
