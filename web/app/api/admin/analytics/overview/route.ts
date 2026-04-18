import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { withAdmin } from "@/lib/auth/admin";
import { toUnixSec } from "@/lib/timestamp";
import { raw } from "@/lib/db";

function getPeriodMs(period: string): number {
  if (period === "1y") return 365 * 24 * 60 * 60 * 1000;
  if (period === "3m") return 90 * 24 * 60 * 60 * 1000;
  return period === "30d" ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromCookies();

  return withAdmin(auth, async () => {
    const { searchParams } = new URL(request.url);
    const period = ["7d", "30d", "3m", "1y"].includes(searchParams.get("period") ?? "") ? (searchParams.get("period") as "7d" | "30d" | "3m" | "1y") : "7d";
    const eventType = searchParams.get("event") ?? "all";
    const since = Date.now() - getPeriodMs(period);

    const sinceSec = toUnixSec(since);

    // Build event filter clause
    const eventWhere = eventType !== "all" ? `AND event = '${eventType}'` : "";

    // 1. Active users
    const activeUsersRows = raw(
      "SELECT COUNT(DISTINCT user_id) as count FROM event_logs WHERE user_id IS NOT NULL AND created_at >= ?",
      [sinceSec]
    ) as { count: number }[];
    const activeUsers = Number(activeUsersRows[0]?.count ?? 0);

    // 2. Total events (filtered)
    const totalEventsRows = raw(
      `SELECT COUNT(*) as count FROM event_logs WHERE created_at >= ? ${eventWhere}`,
      [sinceSec]
    ) as { count: number }[];
    const totalEvents = Number(totalEventsRows[0]?.count ?? 0);

    // 3. Total quota used (sum of totalTokens from quota.use events)
    const quotaUsedRows = raw(
      "SELECT COALESCE(SUM(CAST(json_extract(metadata, '$.totalTokens') AS INTEGER)), 0) as total FROM event_logs WHERE event = 'quota.use' AND created_at >= ?",
      [sinceSec]
    ) as { total: number }[];
    const totalQuotaUsed = Number(quotaUsedRows[0]?.total ?? 0);

    // 4. Total approved skills
    const skillsRows = raw(
      "SELECT COUNT(*) as count FROM skills WHERE moderation_status = 'approved' AND deleted_at IS NULL"
    ) as { count: number }[];
    const totalSkills = Number(skillsRows[0]?.count ?? 0);

    // 5. Events by period (daily for short, weekly/monthly for long)
    const eventsByDayRows = period === "1y"
      ? (raw(
          `SELECT strftime('%Y-%m', created_at, 'unixepoch') as day, COUNT(*) as count FROM event_logs WHERE created_at >= ? ${eventWhere} GROUP BY day ORDER BY day ASC`,
          [sinceSec]
        ) as { day: string; count: number }[])
      : period === "3m"
      ? (raw(
          `SELECT strftime('%Y-W%W', created_at, 'unixepoch') as day, COUNT(*) as count FROM event_logs WHERE created_at >= ? ${eventWhere} GROUP BY day ORDER BY day ASC`,
          [sinceSec]
        ) as { day: string; count: number }[])
      : (raw(
          `SELECT date(created_at, 'unixepoch') as day, COUNT(*) as count FROM event_logs WHERE created_at >= ? ${eventWhere} GROUP BY day ORDER BY day ASC`,
          [sinceSec]
        ) as { day: string; count: number }[]);

    const existingDays = new Set(eventsByDayRows.map((r) => r.day));

    // Normalize to midnight UTC
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const filledDays: { date: string; count: number }[] = [];

    if (period === "1y") {
      // 12 months: start from 11 months ago (UTC)
      const sinceMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
      for (let d = new Date(sinceMonth); d < today; d.setUTCMonth(d.getUTCMonth() + 1)) {
        const monthStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        if (existingDays.has(monthStr)) {
          const row = eventsByDayRows.find((r) => r.day === monthStr)!;
          filledDays.push({ date: monthStr, count: Number(row.count) });
        } else {
          filledDays.push({ date: monthStr, count: 0 });
        }
      }
    } else if (period === "3m") {
      // Week numbers matching SQLite strftime('%Y-W%W') using UTC
      const weekNum = (d: Date) => {
        const year = d.getUTCFullYear();
        const jan4 = Date.UTC(year, 0, 4);
        const monOfW01 = new Date(jan4);
        monOfW01.setUTCDate(4 - (monOfW01.getUTCDay() || 7) + 1);
        const daysSinceMonW01 = Math.floor((d.getTime() - monOfW01.getTime()) / 86400000);
        const week = Math.floor(daysSinceMonW01 / 7) + 1;
        return `${year}-W${String(week).padStart(2, "0")}`;
      };
      const sinceDayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 12 * 7));
      for (let d = new Date(sinceDayStart); d < today; d.setUTCDate(d.getUTCDate() + 7)) {
        const weekStr = weekNum(d);
        if (existingDays.has(weekStr)) {
          const row = eventsByDayRows.find((r) => r.day === weekStr)!;
          filledDays.push({ date: weekStr, count: Number(row.count) });
        } else {
          filledDays.push({ date: weekStr, count: 0 });
        }
      }
    } else if (period === "30d") {
      // Weekly: aggregate daily data into weekly buckets (Mon-based weeks)
      const weekNum = (d: Date) => {
        const year = d.getUTCFullYear();
        const jan4 = Date.UTC(year, 0, 4);
        const monOfW01 = new Date(jan4);
        monOfW01.setUTCDate(4 - (monOfW01.getUTCDay() || 7) + 1);
        const daysSinceMonW01 = Math.floor((d.getTime() - monOfW01.getTime()) / 86400000);
        const week = Math.floor(daysSinceMonW01 / 7) + 1;
        return `${year}-W${String(week).padStart(2, "0")}`;
      };
      // 30 days = max 5 weeks; iterate weekly
      const sinceDayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 29));
      for (let d = new Date(sinceDayStart); d <= today; d.setUTCDate(d.getUTCDate() + 7)) {
        const endOfWeek = new Date(d);
        endOfWeek.setUTCDate(d.getUTCDate() + 6);
        // Sum counts for all days in this week that fall within range
        let count = 0;
        for (let day = new Date(d); day <= today && day <= endOfWeek; day.setUTCDate(day.getUTCDate() + 1)) {
          const dayStr = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`;
          const row = eventsByDayRows.find((r) => r.day === dayStr);
          if (row) count += Number(row.count);
        }
        const weekLabel = weekNum(d);
        filledDays.push({ date: weekLabel, count });
      }
    } else {
      // 7d: daily
      const sinceDayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 6));
      for (let d = new Date(sinceDayStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
        const dayStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        if (existingDays.has(dayStr)) {
          const row = eventsByDayRows.find((r) => r.day === dayStr)!;
          filledDays.push({ date: dayStr, count: Number(row.count) });
        } else {
          filledDays.push({ date: dayStr, count: 0 });
        }
      }
    }
    const eventsByDay = filledDays;

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
      [sinceSec]
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
      [sinceSec]
    ) as { ability: string; count: number }[];
    const abilityBreakdown = abilityRows.map((r) => ({
      ability: r.ability || "unknown",
      count: Number(r.count),
    }));

    // 8. Provider breakdown (from quota.use events — provider in metadata)
    const providerRows = raw(
      "SELECT json_extract(metadata, '$.provider') as provider, COUNT(*) as count FROM event_logs WHERE event = 'quota.use' AND created_at >= ? AND json_extract(metadata, '$.provider') IS NOT NULL GROUP BY json_extract(metadata, '$.provider') ORDER BY count DESC",
      [sinceSec]
    ) as { provider: string; count: number }[];
    const providerBreakdown = providerRows.map((r) => ({
      provider: (r.provider ?? "").replace(/"/g, "") || "unknown",
      count: Number(r.count),
    }));

    // 9. Error tracking
    const errorRows = raw(
      "SELECT json_extract(metadata, '$.provider') as provider, COUNT(*) as count FROM event_logs WHERE event = 'quota.error' AND created_at >= ? GROUP BY provider ORDER BY count DESC",
      [sinceSec]
    ) as { provider: string; count: number }[];
    const errorsByProvider = errorRows.map((r) => ({
      provider: (r.provider ?? "").replace(/"/g, "") || "unknown",
      count: Number(r.count),
    }));
    const totalErrors = errorsByProvider.reduce((sum, e) => sum + e.count, 0);

    return NextResponse.json({
      period,
      eventType,
      totals: { activeUsers, totalEvents, totalQuotaUsed, totalSkills },
      trend: { eventsByDay, topSkills, abilityBreakdown, providerBreakdown },
      errors: { total: totalErrors, byProvider: errorsByProvider },
    });
  });
}
