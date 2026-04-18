import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { withAdmin } from "@/lib/auth/admin";
import { raw } from "@/lib/db";
import { toUnixSec, unixSecToDate } from "@/lib/timestamp";

function getPeriodMs(period: string): number {
  if (period === "all") return 0;
  return period === "30d" ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromCookies();

  return withAdmin(auth, async () => {
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period");
    const period = periodParam === "30d" || periodParam === "all" ? periodParam : "7d";
    const role = searchParams.get("role");
    const sortByParam = searchParams.get("sortBy") ?? searchParams.get("sort");
    const sortMap: Record<string, string> = {
      events: "total_events",
      total_events: "total_events",
      token_used: "total_quota",
      quota_used: "total_quota",
      total_quota: "total_quota",
      last_active: "last_active",
    };
    const sort = sortMap[sortByParam ?? ""] ?? "total_quota";
    const order = searchParams.get("sortOrder") === "asc" || searchParams.get("order") === "asc" ? "ASC" : "DESC";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
    const offset = parseInt(searchParams.get("offset") ?? "0");
    const search = searchParams.get("search")?.trim() ?? "";
    const since = toUnixSec(Date.now() - getPeriodMs(period));

    // Build WHERE clause for search and role filter
    const searchCondition = search
      ? `AND (u.name LIKE ? OR CAST(u.id AS TEXT) LIKE ?)`
      : "";
    const searchArgs = search ? [`%${search}%`, `%${search}%`] : [];
    const roleCondition = role === "user" || role === "reviewer" || role === "admin"
      ? "AND u.role = ?"
      : "";
    const roleArgs = roleCondition ? [role] : [];
    const eventJoinCondition = period === "all"
      ? "el.user_id = u.id"
      : "el.user_id = u.id AND el.created_at >= ?";
    const eventJoinArgs = period === "all" ? [] : [since];
    const topAbilitiesTimeCondition = period === "all" ? "" : "AND created_at >= ?";
    const topAbilitiesTimeArgs = period === "all" ? [] : [since];

    // User behavior data
    const usersResult = raw(
      `SELECT u.id as user_id, u.name, u.role,
              COUNT(el.id) as total_events,
              COALESCE(SUM(CAST(json_extract(el.metadata, '$.totalTokens') AS INTEGER)), 0) as total_quota,
              MAX(el.created_at) as last_active
       FROM users u
       LEFT JOIN event_logs el ON ${eventJoinCondition}
       WHERE 1=1 ${searchCondition} ${roleCondition}
       GROUP BY u.id
       ORDER BY ${sort} ${order}
       LIMIT ? OFFSET ?`,
      [...eventJoinArgs, ...searchArgs, ...roleArgs, limit, offset]
    ) as {
      user_id: number; name: string; role: "user" | "admin" | "reviewer";
      total_events: number; total_quota: number;
      last_active: number | null;
    }[];

    // Total count
    const totalCondition = search
      ? "AND (u.name LIKE ? OR CAST(u.id AS TEXT) LIKE ?)"
      : "";
    const totalResult = raw(
      `SELECT COUNT(DISTINCT u.id) as count
       FROM users u
       LEFT JOIN event_logs el ON ${eventJoinCondition}
       WHERE 1=1 ${totalCondition} ${roleCondition}`,
      [...eventJoinArgs, ...searchArgs, ...roleArgs]
    ) as { count: number }[];
    const total = Number(totalResult[0]?.count ?? 0);

    // Top abilities per user
    const topAbilitiesRaw = raw(
      `SELECT user_id, json_extract(metadata, '$.ability') as ability, COUNT(*) as count
       FROM event_logs
       WHERE event = 'quota.use' AND user_id IS NOT NULL ${topAbilitiesTimeCondition}
       GROUP BY user_id, ability
       ORDER BY count DESC`,
      topAbilitiesTimeArgs
    ) as { user_id: number; ability: string; count: number }[];

    const abilitiesByUser = new Map<number, { ability: string; count: number }[]>();
    for (const row of topAbilitiesRaw) {
      if (!abilitiesByUser.has(row.user_id)) abilitiesByUser.set(row.user_id, []);
      const arr = abilitiesByUser.get(row.user_id)!;
      if (arr.length < 3) {
        arr.push({ ability: (row.ability ?? "").replace(/"/g, ""), count: Number(row.count) });
      }
    }

    const usersData = usersResult.map((r) => {
      const lastActiveDate = unixSecToDate(r.last_active);
      return {
        userId: r.user_id,
        name: r.name || `User ${r.user_id}`,
        role: r.role,
        totalEvents: Number(r.total_events ?? 0),
        totalQuotaUsed: Number(r.total_quota ?? 0),
        lastActive: lastActiveDate ? lastActiveDate.getTime() : 0,
        topAbilities: abilitiesByUser.get(r.user_id) ?? [],
      };
    });

    return NextResponse.json({ users: usersData, pagination: { total, limit, offset } });
  });
}
