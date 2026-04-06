import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
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

// Quota costs per ability (units)
export const ABILITY_COSTS: Record<string, number> = {
  "image.generate": 10,
  "tts.synthesize": 5,
  "voice.synthesize": 5,
  "vision.analyze": 5,
  "llm.generate": 0,    // 免费：Skill 开发辅助工具，不占用户配额
  "whoami": 0,
};

// Default free tier quota
export const DEFAULT_QUOTA_FREE = 1000;

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Get current quota for a user.
 * Returns { used, limit, remaining } or null if no quota set.
 */
export async function getQuota(userId: number): Promise<QuotaInfo | null> {
  try {
    const r = getRedis();
    if (!r) return null;
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 2000)
    );
    const data = await Promise.race([
      r.get<{ used: number; limit: number }>(`clawplay:quota:${userId}`),
      timeout,
    ]);
    if (!data) return null;
    const remaining = Math.max(0, data.limit - data.used);
    return { used: data.used, limit: data.limit, remaining };
  } catch {
    return null; // Redis not configured in dev
  }
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
 */
export async function incrementQuota(
  userId: number,
  ability: string
): Promise<{ ok: boolean; remaining?: number }> {
  const cost = ABILITY_COSTS[ability] ?? 1;

  try {
    const r = getRedis();
    if (!r) {
      console.warn("[redis/incrementQuota] Redis unavailable — skipping quota deduction", { userId, ability });
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

    const remaining = await r.eval(lua, [key], [String(cost), String(DEFAULT_QUOTA_FREE)]) as number;
    if (remaining < 0) return { ok: false };
    return { ok: true, remaining };
  } catch {
    console.warn("[redis/incrementQuota] Redis unavailable — skipping quota deduction", { userId, ability });
    // Redis unavailable — proceed optimistically (quota may be deducted on next request)
    return { ok: true, remaining: 999 };
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
  const check = await checkQuota(userId, ability);
  if (!check.allowed) return check;
  const incr = await incrementQuota(userId, ability);
  if (!incr.ok) {
    return { allowed: false, reason: "Quota exceeded (concurrent request)." };
  }
  return { allowed: true, remaining: incr.remaining };
}

/**
 * Initialize quota for a new user (called on token generation).
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
    // Redis not configured — skip silently in dev
  }
}
