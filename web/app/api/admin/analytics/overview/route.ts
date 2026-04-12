import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { withAdmin } from "@/lib/auth/admin";
import { raw } from "@/lib/db";

function getPeriodMs(period: string): number {
  return period === "30d" ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromCookies();

  return withAdmin(auth, async () => {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") === "30d" ? "30d" : "7d";
    const since = Date.now() - getPeriodMs(period);

    // 1. Active users
    const activeUsersRows = raw(
      "SELECT COUNT(DISTINCT user_id) as count FROM event_logs WHERE user_id IS NOT NULL AND created_at >= ?",
      [since]
    ) as { count: number }[];
    const activeUsers = Number(activeUsersRows[0]?.count ?? 0);

    // 2. Total events
    const totalEventsRows = raw(
      "SELECT COUNT(*) as count FROM event_logs WHERE created_at >= ?",
      [since]
    ) as { count: number }[];
    const totalEvents = Number(totalEventsRows[0]?.count ?? 0);

    // 3. Total quota used (sum of totalTokens from quota.use events)
    const quotaUsedRows = raw(
      "SELECT COALESCE(SUM(CAST(json_extract(metadata, '$.totalTokens') AS INTEGER)), 0) as total FROM event_logs WHERE event = 'quota.use' AND created_at >= ?",
      [since]
    ) as { total: number }[];
    const totalQuotaUsed = Number(quotaUsedRows[0]?.total ?? 0);

    // 4. Total approved skills
    const skillsRows = raw(
      "SELECT COUNT(*) as count FROM skills WHERE moderation_status = 'approved' AND deleted_at IS NULL"
    ) as { count: number }[];
    const totalSkills = Number(skillsRows[0]?.count ?? 0);

    // 5. Events by day
    const eventsByDayRows = raw(
      "SELECT date(created_at/1000, 'unixepoch') as day, COUNT(*) as count FROM event_logs WHERE created_at >= ? GROUP BY day ORDER BY day ASC",
      [since]
    ) as { day: string; count: number }[];
    const eventsByDay = eventsByDayRows.map((r) => ({
      date: r.day,
      count: Number(r.count),
    }));

    // 6. Top skills
    const topSkillsRows = raw(
      `SELECT s.slug, s.name,
            COALESCE(SUM(CASE WHEN el.event = 'skill.view' THEN 1 ELSE 0 END), 0) as views,
            COALESCE(SUM(CASE WHEN el.event = 'skill.download' THEN 1 ELSE 0 END), 0) as downloads
         FROM skills s
         LEFT JOIN event_logs el ON el.target_type = 'skill' AND el.target_id = s.slug AND el.created_at >= ?
         WHERE s.moderation_status = 'approved' AND s.deleted_at IS NULL
         GROUP BY s.id
         ORDER BY views DESC, downloads DESC
         LIMIT 10`,
      [since]
    ) as { slug: string; name: string; views: number; downloads: number }[];
    const topSkills = topSkillsRows.map((r) => ({
      slug: r.slug,
      name: r.name,
      views: Number(r.views),
      downloads: Number(r.downloads),
    }));

    // 7. Ability breakdown (from quota.use events — ability in metadata)
    const abilityRows = raw(
      "SELECT COALESCE(NULLIF(json_extract(metadata, '$.ability'), ''), target_id) as ability, COUNT(*) as count FROM event_logs WHERE event = 'quota.use' AND created_at >= ? GROUP BY ability ORDER BY count DESC",
      [since]
    ) as { ability: string; count: number }[];
    const abilityBreakdown = abilityRows.map((r) => ({
      ability: r.ability || "unknown",
      count: Number(r.count),
    }));

    // 8. Provider breakdown (from quota.use events — provider in metadata)
    const providerRows = raw(
      "SELECT json_extract(metadata, '$.provider') as provider, COUNT(*) as count FROM event_logs WHERE event = 'quota.use' AND created_at >= ? AND json_extract(metadata, '$.provider') IS NOT NULL GROUP BY json_extract(metadata, '$.provider') ORDER BY count DESC",
      [since]
    ) as { provider: string; count: number }[];
    const providerBreakdown = providerRows.map((r) => ({
      provider: (r.provider ?? "").replace(/"/g, "") || "unknown",
      count: Number(r.count),
    }));

    // 9. Error tracking
    const errorRows = raw(
      "SELECT json_extract(metadata, '$.provider') as provider, COUNT(*) as count FROM event_logs WHERE event = 'quota.error' AND created_at >= ? GROUP BY provider ORDER BY count DESC",
      [since]
    ) as { provider: string; count: number }[];
    const errorsByProvider = errorRows.map((r) => ({
      provider: (r.provider ?? "").replace(/"/g, "") || "unknown",
      count: Number(r.count),
    }));
    const totalErrors = errorsByProvider.reduce((sum, e) => sum + e.count, 0);

    return NextResponse.json({
      period,
      totals: { activeUsers, totalEvents, totalQuotaUsed, totalSkills },
      trend: { eventsByDay, topSkills, abilityBreakdown, providerBreakdown },
      errors: { total: totalErrors, byProvider: errorsByProvider },
    });
  });
}
