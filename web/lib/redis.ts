import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    redis = new Redis({ url, token });
    return redis;
  } catch {
    return null;
  }
}

// In-memory cache for getQuota — reduces Redis round-trips per SSR page load
// TTL of 5s is safe: quota changes only from incrementQuota (post-call)
const quotaCache = new Map<number, { data: QuotaInfo; expires: number }>();
const QUOTA_CACHE_TTL_MS = 5000;

// Quota costs per ability (used only for pre-check estimates)
// Actual quota deduction uses real token counts from provider responses.
export const ABILITY_COSTS: Record<string, number> = {
  "image.generate": 10,
  "tts.synthesize": 5,
  "voice.synthesize": 5,
  "vision.analyze": 5,
  "llm.generate": 5,
  "whoami": 0,
};

// Default free tier quota
export const DEFAULT_QUOTA_FREE = 100000;

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Get current quota for a user.
 * Cached in-memory for 5s to avoid repeated Redis round-trips per SSR page load.
 */
export async function getQuota(userId: number): Promise<QuotaInfo | null> {
  const now = Date.now();
  const cached = quotaCache.get(userId);
  if (cached && cached.expires > now) return cached.data;

  try {
    const r = getRedis();
    if (!r) return null;
    const data = await Promise.race([
      r.get<{ used: number; limit: number }>(`clawplay:quota:${userId}`),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    if (!data) return null;
    const result: QuotaInfo = { used: data.used, limit: data.limit, remaining: Math.max(0, data.limit - data.used) };
    quotaCache.set(userId, { data: result, expires: now + QUOTA_CACHE_TTL_MS });
    return result;
  } catch {
    return null;
  }
}

/** Invalidate cache entry after quota increment */
export function invalidateQuotaCache(userId: number): void {
  quotaCache.delete(userId);
}

/**
 * Check quota without incrementing. Used before calling the provider.
 * Returns { allowed: true, remaining } or { allowed: false, reason: string }
 */
export async function checkQuota(
  userId: number,
  ability: string
): Promise<{ allowed: boolean; remaining?: number; reason?: string }> {
  const cost = ABILITY_COSTS[ability] ?? 1;

  try {
    const r = getRedis();
    if (!r) {
      if (process.env.NODE_ENV === "production") {
        return { allowed: false, reason: "Quota service unavailable. Please try again later." };
      }
      return { allowed: true, remaining: 999 };
    }
    const key = `clawplay:quota:${userId}`;
    const data = await r.get<{ used: number; limit: number }>(key);
    const used = data?.used ?? 0;
    const limit = data?.limit ?? DEFAULT_QUOTA_FREE;

    if (used + cost > limit) {
      return {
        allowed: false,
        remaining: Math.max(0, limit - used),
        reason: `Quota exceeded. Used ${used}/${limit}. Try again tomorrow.`,
      };
    }
    return { allowed: true, remaining: limit - used };
  } catch {
    if (process.env.NODE_ENV === "production") {
      return { allowed: false, reason: "Quota service unavailable. Please try again later." };
    }
    return { allowed: true, remaining: 999 };
  }
}

/**
 * Atomically increment quota using a Lua script.
 * Returns { ok: true, remaining } or { ok: false } if quota would be exceeded.
 * Call this AFTER the provider succeeds (post-deduct strategy).
 * @param actualTokens — actual token count deducted from provider response.
 */
export async function incrementQuota(
  userId: number,
  actualTokens: number
): Promise<{ ok: boolean; remaining?: number }> {
  try {
    const r = getRedis();
    if (!r) {
      console.warn("[redis/incrementQuota] Redis unavailable — skipping quota deduction", { userId, actualTokens });
      return { ok: true, remaining: 999 };
    }
    const key = `clawplay:quota:${userId}`;

    // Lua script: atomic read-check-write; returns remaining or -1 if exceeded
    const lua = `
      local raw = redis.call('GET', KEYS[1])
      if not raw then
        local limit = tonumber(ARGV[2])
        local cost = tonumber(ARGV[1])
        redis.call('SET', KEYS[1], cjson.encode({used=cost, limit=limit}), 'EX', 86400)
        return limit - cost
      end
      local data = cjson.decode(raw)
      local used = data.used or 0
      local limit = data.limit or tonumber(ARGV[2])
      local cost = tonumber(ARGV[1])
      if used + cost > limit then return -1 end
      data.used = used + cost
      redis.call('SET', KEYS[1], cjson.encode(data), 'EX', 86400)
      return limit - data.used
    `;

    const remaining = await r.eval(lua, [key], [String(actualTokens), String(DEFAULT_QUOTA_FREE)]) as number;
    if (remaining < 0) return { ok: false };
    invalidateQuotaCache(userId); // stale cache no longer valid
    return { ok: true, remaining };
  } catch {
    console.warn("[redis/incrementQuota] Redis unavailable — rejecting request", { userId, actualTokens });
    return { ok: false };
  }
}

/**
 * @deprecated Use checkQuota + incrementQuota (post-deduct) instead.
 * Kept for backwards compat with check endpoint.
 */
export async function checkAndIncrementQuota(
  userId: number,
  ability: string
): Promise<{ allowed: boolean; remaining?: number; reason?: string }> {
  const cost = ABILITY_COSTS[ability] ?? 1;
  const check = await checkQuota(userId, ability);
  if (!check.allowed) return check;
  const incr = await incrementQuota(userId, cost);
  if (!incr.ok) {
    return { allowed: false, reason: "Quota exceeded (concurrent request)." };
  }
  return { allowed: true, remaining: incr.remaining };
}

/**
 * Initialize quota for a new user (called on token generation).
 * Fire-and-forget — errors are silently ignored; quota can be set on first use.
 */
export async function initQuota(
  userId: number,
  limit: number = DEFAULT_QUOTA_FREE
): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    await r.set(`clawplay:quota:${userId}`, { used: 0, limit }, { ex: 86400 });
  } catch {
    // Redis not configured or unreachable — skip silently
  }
}
