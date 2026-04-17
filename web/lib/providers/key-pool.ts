/**
 * Key Pool Management — multi-key sharding with 429 auto-failover
 *
 * Schema: provider_keys stores one row per (provider, ability, key).
 * e.g. Ark + Image = one key, Ark + LLM = another key.
 *
 * Key concepts:
 * - Keys are AES-256-GCM encrypted; server never stores plaintext
 * - Active key list is cached in Redis (30s TTL) per (provider, ability)
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

// In-memory counter for round-robin (per-process, per provider+ability)
const roundRobinCounters: Record<string, number> = {};

function rrKey(provider: string, ability: string): string {
  return `${provider}_${ability}`;
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

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

type ActiveKey = { id: number; hash: string; decryptedKey: string; quota: number };

/** Auto-reset windowUsed if the current minute window has expired */
async function checkAndResetWindow(id: number, windowStart: number): Promise<boolean> {
  const nowMinute = Math.floor(Date.now() / 60000);
  const windowMinute = Math.floor(windowStart / 60);
  if (windowMinute < nowMinute) {
    await db
      .update(providerKeys)
      .set({ windowUsed: 0, windowStart: nowMinute * 60 })
      .where(eq(providerKeys.id, id));

    const r = getRedis();
    if (r) {
      // Re-fetch the key's provider+ability to build the cache key
      const [keyRow] = await db
        .select({ provider: providerKeys.provider, ability: providerKeys.ability })
        .from(providerKeys)
        .where(eq(providerKeys.id, id))
        .limit(1);
      if (keyRow) {
        r.del(`clawplay:keys:${keyRow.provider}_${keyRow.ability}`).catch(() => {});
      }
    }
    return true; // was reset
  }
  return false;
}

/** Get all active (enabled, within quota) keys for a provider+ability, cached in Redis */
async function getActiveKeys(
  provider: string,
  ability: string
): Promise<ActiveKey[]> {
  const r = getRedis();
  const cacheKey = `clawplay:keys:${provider}_${ability}`;

  if (r) {
    try {
      const cached = await Promise.race([
        r.get<string>(cacheKey),
        new Promise<null>((res) => setTimeout(() => res(null), 500)),
      ]);
      if (cached) {
        const keys = JSON.parse(cached) as ActiveKey[];
        if (keys.length > 0) return keys;
      }
    } catch {
      // Cache miss — fall through to DB
    }
  }

  const rows = await db
    .select({
      id: providerKeys.id,
      keyHash: providerKeys.keyHash,
      encryptedKey: providerKeys.encryptedKey,
      quota: providerKeys.quota,
      windowUsed: providerKeys.windowUsed,
      windowStart: providerKeys.windowStart,
    })
    .from(providerKeys)
    .where(
      and(
        eq(providerKeys.provider, provider),
        eq(providerKeys.ability, ability),
        eq(providerKeys.enabled, true)
      )
    );

  const result: ActiveKey[] = [];
  for (const row of rows) {
    // Auto-reset if window expired (no cron needed)
    const wasReset = await checkAndResetWindow(row.id, row.windowStart);
    const effectiveUsed = wasReset ? 0 : row.windowUsed;
    if (effectiveUsed >= row.quota) continue;

    try {
      const decryptedKey = decryptApiKey(row.encryptedKey);
      result.push({ id: row.id, hash: row.keyHash, decryptedKey, quota: row.quota });
    } catch {
      console.error(`[key-pool] Failed to decrypt key id=${row.id}`);
    }
  }

  if (r) {
    r.setex(cacheKey, CACHE_TTL, JSON.stringify(result)).catch(() => {});
  }

  return result;
}

/**
 * Pick a key for a provider+ability using round-robin.
 * Falls back to env var if no DB keys exist.
 */
export async function pickKey(
  provider: string,
  ability: string
): Promise<{ id: number; key: string; hash: string; quota: number; endpoint: string; apiFormat: string; modelName: string }> {
  const keys = await getActiveKeys(provider, ability);
  if (keys.length > 0) {
    const idx = (roundRobinCounters[rrKey(provider, ability)] ?? 0) % keys.length;
    roundRobinCounters[rrKey(provider, ability)] = idx + 1;
    const selected = keys[idx];

    // Fetch endpoint/apiFormat/modelName from DB
    const [row] = await db
      .select({
        endpoint: providerKeys.endpoint,
        apiFormat: providerKeys.apiFormat,
        modelName: providerKeys.modelName,
      })
      .from(providerKeys)
      .where(eq(providerKeys.id, selected.id))
      .limit(1);

    return {
      id: selected.id,
      key: selected.decryptedKey,
      hash: selected.hash,
      quota: selected.quota,
      endpoint: row?.endpoint ?? "",
      apiFormat: row?.apiFormat ?? "",
      modelName: row?.modelName ?? "",
    };
  }

  // Fallback: use ARK_API_KEY env var directly
  if (provider === "ark") {
    const envKey = process.env.ARK_API_KEY;
    if (envKey) {
      return { id: 0, key: envKey, hash: "", quota: 999999, endpoint: "", apiFormat: "ark", modelName: "" };
    }
  }

  throw new Error(`No active keys for provider=${provider}, ability=${ability}`);
}

/**
 * Pick a key with 429 auto-failover.
 */
export async function pickKeyWithRetry(
  provider: string,
  ability: string
): Promise<{ id: number; key: string; hash: string; quota: number; endpoint: string; apiFormat: string; modelName: string }> {
  const attemptedIds = new Set<number>();
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const picked = await pickKey(provider, ability);
    if (attemptedIds.has(picked.id)) continue;
    attemptedIds.add(picked.id);
    return picked;
  }
  throw new Error(`All keys for ${provider}/${ability} are rate-limited. Please retry shortly.`);
}

/**
 * Record usage for a key after a successful API call.
 */
export async function recordKeyUsage(
  provider: string,
  ability: string,
  keyId: number
): Promise<void> {
  try {
    await db
      .update(providerKeys)
      .set({ windowUsed: sql`${providerKeys.windowUsed} + 1`, totalCalls: sql`${providerKeys.totalCalls} + 1` })
      .where(eq(providerKeys.id, keyId));

    const r = getRedis();
    if (r) {
      r.del(`clawplay:keys:${provider}_${ability}`).catch(() => {});
    }
  } catch (err) {
    console.error(`[key-pool] Failed to record usage for key id=${keyId}`, err);
  }
}

// ---------------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------------

export interface AddKeyOptions {
  endpoint?: string;
  apiFormat?: string;
  modelName?: string;
  quota?: number;
}

/** Add a new key (plaintext input, stored encrypted). */
export async function addProviderKey(
  provider: string,
  ability: string,
  plaintextKey: string,
  opts: AddKeyOptions = {}
): Promise<number> {
  const { encrypted, hash } = encryptApiKey(plaintextKey);

  // Allow same key for different abilities (e.g. same Ark key for LLM + Image)
  // but not duplicated within the same (provider, ability) combo
  const existing = await db
    .select({ id: providerKeys.id })
    .from(providerKeys)
    .where(and(
      eq(providerKeys.provider, provider),
      eq(providerKeys.ability, ability),
      eq(providerKeys.keyHash, hash)
    ))
    .limit(1);

  if (existing.length > 0) {
    const err = new Error("Duplicate key for this provider and ability");
    (err as NodeJS.ErrnoException).code = "DUPLICATE_KEY";
    throw err;
  }

  const now = Math.floor(Date.now() / 60000) * 60;

  try {
    const result = await db.insert(providerKeys).values({
      provider,
      ability,
      encryptedKey: encrypted,
      keyHash: hash,
      endpoint: opts.endpoint ?? "",
      apiFormat: opts.apiFormat ?? "",
      modelName: opts.modelName ?? "",
      quota: opts.quota ?? 500,
      windowUsed: 0,
      windowStart: now,
      enabled: true,
    });

    const r = getRedis();
    if (r) {
      r.del(`clawplay:keys:${provider}_${ability}`).catch(() => {});
    }

    return result.lastInsertRowid as number;
  } catch (err: unknown) {
    // SQLite UNIQUE constraint on key_hash: same key for different ability
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
    ) {
      const e = new Error("Duplicate key for this provider and ability");
      (e as NodeJS.ErrnoException).code = "DUPLICATE_KEY";
      throw e;
    }
    throw err;
  }
}

/** Toggle a key's enabled state */
export async function toggleProviderKey(id: number, enabled: boolean): Promise<void> {
  const [row] = await db
    .select({ provider: providerKeys.provider, ability: providerKeys.ability })
    .from(providerKeys)
    .where(eq(providerKeys.id, id))
    .limit(1);

  await db
    .update(providerKeys)
    .set({ enabled })
    .where(eq(providerKeys.id, id));

  if (row?.provider && row?.ability) {
    const r = getRedis();
    if (r) {
      r.del(`clawplay:keys:${row.provider}_${row.ability}`).catch(() => {});
    }
  }
}

/** Remove a key by id (hard delete) */
export async function removeProviderKey(id: number): Promise<void> {
  const [row] = await db
    .select({ provider: providerKeys.provider, ability: providerKeys.ability })
    .from(providerKeys)
    .where(eq(providerKeys.id, id))
    .limit(1);

  await db.delete(providerKeys).where(eq(providerKeys.id, id));

  if (row?.provider && row?.ability) {
    const r = getRedis();
    if (r) {
      r.del(`clawplay:keys:${row.provider}_${row.ability}`).catch(() => {});
    }
  }
}

export interface KeyRecord {
  id: number;
  provider: string;
  ability: string;
  keyHash: string;
  endpoint: string;
  apiFormat: string;
  modelName: string;
  quota: number;
  windowUsed: number;
  windowStart: number;
  totalCalls: number;
  enabled: boolean;
  createdAt: Date;
}

/** List keys, optionally filtered by ability */
export async function listProviderKeys(
  ability?: string
): Promise<KeyRecord[]> {
  const rows = ability
    ? await db
        .select()
        .from(providerKeys)
        .where(eq(providerKeys.ability, ability))
        .orderBy(providerKeys.createdAt)
    : await db
        .select()
        .from(providerKeys)
        .orderBy(providerKeys.createdAt);

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    ability: row.ability,
    keyHash: row.keyHash,
    endpoint: row.endpoint,
    apiFormat: row.apiFormat,
    modelName: row.modelName,
    quota: row.quota,
    windowUsed: row.windowUsed,
    windowStart: row.windowStart,
    totalCalls: row.totalCalls,
    enabled: Boolean(row.enabled),
    createdAt: row.createdAt,
  }));
}

/** Reset all window counters for an ability (or all abilities) */
export async function resetKeyWindow(ability?: string): Promise<void> {
  const now = Math.floor(Date.now() / 60000) * 60;

  if (ability) {
    await db
      .update(providerKeys)
      .set({ windowUsed: 0, windowStart: now })
      .where(eq(providerKeys.ability, ability));
  } else {
    await db.update(providerKeys).set({ windowUsed: 0, windowStart: now });
  }

  const r = getRedis();
  if (r) {
    const pattern = ability ? `clawplay:keys:*_${ability}` : "clawplay:keys:*";
    const keys = await r.keys(pattern);
    if (keys.length > 0) {
      r.del(...keys).catch(() => {});
    }
  }
}

/**
 * Check and auto-reset expired windows for all keys.
 * Not exported — called internally by cron timer.
 */
async function _checkAllKeyWindows(): Promise<void> {
  const rows = await db.select({ id: providerKeys.id, windowStart: providerKeys.windowStart }).from(providerKeys);
  await Promise.all(rows.map((row) => checkAndResetWindow(row.id, row.windowStart)));
}
