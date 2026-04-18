import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { raw } from "@/lib/db";
import { toUnixSec } from "@/lib/timestamp";

function getPeriodMs(period: string): number {
  return period === "30d" ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
}

export async function GET() {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const since7d = toUnixSec(Date.now() - getPeriodMs("7d"));
  const since30d = toUnixSec(Date.now() - getPeriodMs("30d"));

  // 7-day stats — count quota.use events (actual API calls)
  const stats7dRows = raw(
    `SELECT COUNT(*) as total_events,
            COALESCE(SUM(CAST(json_extract(metadata, '$.totalTokens') AS INTEGER)), 0) as total_quota
     FROM event_logs WHERE user_id = ? AND event = 'quota.use' AND created_at >= ?`,
    [auth.userId, since7d]
  ) as { total_events: number; total_quota: number }[];
  const stats7d = stats7dRows[0] ?? { total_events: 0, total_quota: 0 };

  // 30-day stats — count quota.use events (consistent with 7d)
  const stats30dRows = raw(
    `SELECT COUNT(*) as total_events,
            COALESCE(SUM(CAST(json_extract(metadata, '$.totalTokens') AS INTEGER)), 0) as total_quota
     FROM event_logs WHERE user_id = ? AND event = 'quota.use' AND created_at >= ?`,
    [auth.userId, since30d]
  ) as { total_events: number; total_quota: number }[];
  const stats30d = stats30dRows[0] ?? { total_events: 0, total_quota: 0 };

  // Ability breakdown (7d) — skip entries where ability field is empty/missing
  // (metadata.$.ability was never written; ability lives in targetId — skip bad rows)
  const abilityRows = raw(
    `SELECT json_extract(metadata, '$.ability') as ability, COUNT(*) as count
     FROM event_logs WHERE user_id = ? AND event = 'quota.use' AND created_at >= ?
     GROUP BY ability ORDER BY count DESC`,
    [auth.userId, since7d]
  ) as { ability: string; count: number }[];
  const abilityBreakdown7d = abilityRows
    .map((r) => ({
      ability: (r.ability ?? "").replace(/"/g, ""),
      count: Number(r.count),
    }))
    .filter((r) => r.ability && r.ability !== "ability");

  // Recent 10 events
  const recentRows = raw(
    "SELECT event, metadata, created_at FROM event_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
    [auth.userId]
  ) as Record<string, unknown>[];
  const recentEvents = recentRows.map((r) => ({
    event: r.event,
    metadata: (() => { try { return JSON.parse(r.metadata as string); } catch { return {}; } })(),
    created_at: typeof r.created_at === "object" && r.created_at !== null
      ? (r.created_at as Date).getTime()
      : r.created_at,
  }));

  return NextResponse.json({
    userId: auth.userId,
    events7d: Number(stats7d.total_events ?? 0),
    quotaUsed7d: Number(stats7d.total_quota ?? 0),
    events30d: Number(stats30d.total_events ?? 0),
    quotaUsed30d: Number(stats30d.total_quota ?? 0),
    abilityBreakdown7d,
    recentEvents,
  });
}
