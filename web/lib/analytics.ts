/**
 * analytics.ts — ClawPlay 埋点核心库
 *
 * 设计原则：
 * - 服务端埋点为主（防伪造）
 * - 异步写 DB，不阻塞主请求
 * - 关键事件同时写 JSONL 审计日志（保留不可篡改性）
 */

import { db } from "@/lib/db";
import { eventLogs, userStats, skills } from "@/lib/db/schema";
import { appendAuditLog } from "@/lib/audit";
import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";

// ─── Event Types ─────────────────────────────────────────────────────────────

export type AnalyticsEvent =
  // User lifecycle
  | "user.register"
  | "user.login"
  | "user.login_failed"
  | "user.logout"
  | "user.sms_send"
  | "user.sms_verify_fail"
  // Skill events
  | "skill.view"
  | "skill.submit"
  | "skill.approve"
  | "skill.reject"
  | "skill.feature"
  | "skill.unfeature"
  | "skill.download"
  | "skill.review"
  | "skill.search"
  // Quota & ability events
  | "quota.check"
  | "quota.use"
  | "quota.exceeded"
  | "ability.error"
  // Token events
  | "token.generate"
  | "token.revoke"
  | "token.use"
  | "token.invalid";

// Events that are also written to the append-only JSONL audit log
const AUDIT_EVENTS: AnalyticsEvent[] = [
  "skill.approve",
  "skill.reject",
  "skill.feature",
  "skill.unfeature",
  "token.generate",
  "token.revoke",
  "user.login_failed",
];

export interface EventParams {
  event: AnalyticsEvent;
  userId?: number | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

// ─── IP / User-Agent extraction ───────────────────────────────────────────────

function getClientInfo(): { ip?: string; ua?: string } {
  try {
    const h = headers();
    return {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined,
      ua: h.get("user-agent") ?? undefined,
    };
  } catch {
    // headers() is not available outside of request context (e.g. in unit tests)
    return {};
  }
}

// ─── logEvent ─────────────────────────────────────────────────────────────────

/**
 * 记录一个分析事件到 event_logs 表。
 * 异步执行，不等待完成，不阻塞主请求。
 * 关键事件同时写 JSONL 审计日志。
 */
export function logEvent(params: EventParams): void {
  // Fire-and-forget — do not await
  void doLogEvent(params);
}

async function doLogEvent(params: EventParams): Promise<void> {
  const { event, userId = null, targetType, targetId, metadata = {} } = params;
  const { ip, ua } = getClientInfo();

  try {
    await db.insert(eventLogs).values({
      event,
      userId,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      metadata: JSON.stringify(metadata),
      ipAddress: ip ?? null,
      userAgent: ua ?? null,
    });
  } catch (err) {
    // Never crash the request due to analytics failures
    console.error(`[analytics] Failed to log event "${event}":`, err);
  }

  // Dual-write to JSONL audit log for sensitive events
  if (AUDIT_EVENTS.includes(event)) {
    try {
      appendAuditLog({
        ts: new Date().toISOString(),
        actorId: userId ?? 0,
        action: event as never,
        targetType: (targetType as "skill" | "user_token" | "user") ?? "user",
        targetId: targetId ?? "",
        metadata,
      });
    } catch (err) {
      console.error(`[analytics] Failed to write audit log for "${event}":`, err);
    }
  }

  // Update userStats if applicable
  if (userId && event in USER_STATS_MAP) {
    try {
      await updateUserStats(userId, event, metadata);
    } catch (err) {
      console.error(`[analytics] Failed to update userStats for user ${userId}:`, err);
    }
  }
}

// Map analytics events to userStats field updates
const USER_STATS_MAP: Partial<Record<AnalyticsEvent, (m: Record<string, unknown>) => object>> = {
  "user.login": () => ({
    loginCount: sql`login_count + 1`,
    lastLoginAt: new Date(),
    lastActiveAt: new Date(),
  }),
  "quota.use": (m) => ({
    totalQuotaUsed: sql`total_quota_used + ${Number(m.cost ?? 0)}`,
    lastActiveAt: new Date(),
  }),
  "skill.submit": () => ({
    skillsSubmitted: sql`skills_submitted + 1`,
    lastActiveAt: new Date(),
  }),
  "skill.download": () => ({
    skillsDownloaded: sql`skills_downloaded + 1`,
    lastActiveAt: new Date(),
  }),
};

async function updateUserStats(
  userId: number,
  event: AnalyticsEvent,
  metadata: Record<string, unknown>
): Promise<void> {
  const updater = USER_STATS_MAP[event];
  if (!updater) return;

  await db
    .insert(userStats)
    .values({ userId })
    .onConflictDoUpdate({
      target: userStats.userId,
      set: {
        ...updater(metadata),
        updatedAt: new Date(),
      },
    });
}

// ─── Skill Stats Helpers ───────────────────────────────────────────────────────

/**
 * 递增技能的浏览/下载/安装计数。
 * 原子操作，不存在则初始化。
 */
export async function incrementSkillStat(
  skillId: string,
  field: "statsViews" | "statsDownloads" | "statsInstalls"
): Promise<void> {
  try {
    await db
      .update(skills)
      .set({ [field]: sql`${sql.raw(field)} + 1` })
      .where(eq(skills.id, skillId));
  } catch (err) {
    console.error(`[analytics] Failed to increment skill stat ${field} for ${skillId}:`, err);
  }
}

// ─── Typed log helpers ────────────────────────────────────────────────────────

export const analytics = {
  user: {
    register: (userId: number, method: string) =>
      logEvent({ event: "user.register", userId, targetType: "user", targetId: String(userId), metadata: { method } }),
    login: (userId: number, method: string) =>
      logEvent({ event: "user.login", userId, targetType: "user", targetId: String(userId), metadata: { method } }),
    loginFailed: (email: string, reason: string) =>
      logEvent({ event: "user.login_failed", targetType: "user", metadata: { email, reason } }),
    logout: (userId: number) =>
      logEvent({ event: "user.logout", userId, targetType: "user", targetId: String(userId) }),
    smsSend: (phone: string) =>
      logEvent({ event: "user.sms_send", metadata: { phone: maskPhone(phone) } }),
    smsVerifyFail: (phone: string, reason: string) =>
      logEvent({ event: "user.sms_verify_fail", metadata: { phone: maskPhone(phone), reason } }),
  },
  skill: {
    view: (skillId: string, slug: string) =>
      logEvent({ event: "skill.view", targetType: "skill", targetId: skillId, metadata: { slug } }),
    submit: (skillId: string, status: string) =>
      logEvent({ event: "skill.submit", targetType: "skill", targetId: skillId, metadata: { status } }),
    approve: (skillId: string, adminId: number) =>
      logEvent({ event: "skill.approve", userId: adminId, targetType: "skill", targetId: skillId }),
    reject: (skillId: string, adminId: number, reason: string) =>
      logEvent({ event: "skill.reject", userId: adminId, targetType: "skill", targetId: skillId, metadata: { reason } }),
    feature: (skillId: string, adminId: number) =>
      logEvent({ event: "skill.feature", userId: adminId, targetType: "skill", targetId: skillId }),
    unfeature: (skillId: string, adminId: number) =>
      logEvent({ event: "skill.unfeature", userId: adminId, targetType: "skill", targetId: skillId }),
    download: (skillId: string, version: string) =>
      logEvent({ event: "skill.download", targetType: "skill", targetId: skillId, metadata: { version } }),
    review: (skillId: string, userId: number, rating: number) =>
      logEvent({ event: "skill.review", userId, targetType: "skill", targetId: skillId, metadata: { rating } }),
    search: (query: string, filters: Record<string, unknown>, count: number) =>
      logEvent({ event: "skill.search", metadata: { query, filters, resultsCount: count } }),
  },
  quota: {
    check: (userId: number, current: number, limit: number) =>
      logEvent({ event: "quota.check", userId, targetType: "quota", targetId: String(userId), metadata: { current, limit } }),
    use: (
      userId: number,
      ability: string,
      cost: number,
      usage?: { inputTokens?: number; outputTokens?: number }
    ) => {
      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;
      const totalTokens = inputTokens + outputTokens;
      logEvent({
        event: "quota.use",
        userId,
        targetType: "ability",
        targetId: ability,
        metadata: { ability, cost, inputTokens, outputTokens, totalTokens },
      });
    },
    exceeded: (userId: number, ability: string, current: number, limit: number) =>
      logEvent({ event: "quota.exceeded", userId, targetType: "ability", targetId: ability, metadata: { ability, current, limit } }),
    error: (userId: number, ability: string, provider: string, code: string) =>
      logEvent({ event: "ability.error", userId, targetType: "ability", targetId: ability, metadata: { provider, code } }),
  },
  token: {
    generate: (userId: number) =>
      logEvent({ event: "token.generate", userId, targetType: "token", targetId: String(userId) }),
    revoke: (userId: number, tokenId: string) =>
      logEvent({ event: "token.revoke", userId, targetType: "token", targetId: tokenId }),
  },
};

function maskPhone(phone: string): string {
  if (phone.length < 7) return "***";
  return phone.slice(0, 3) + "****" + phone.slice(-4);
}
