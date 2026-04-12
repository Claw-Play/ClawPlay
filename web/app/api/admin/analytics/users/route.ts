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
    const sort = searchParams.get("sort") === "events" ? "total_events" : "total_quota";
    const order = searchParams.get("order") === "asc" ? "ASC" : "DESC";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
    const offset = parseInt(searchParams.get("offset") ?? "0");
    const since = Date.now() - getPeriodMs(period);

    // User behavior data
    const usersResult = raw(
      `SELECT u.id as user_id, u.name,
              COUNT(el.id) as total_events,
              COALESCE(SUM(CAST(json_extract(el.metadata, '$.totalTokens') AS INTEGER)), 0) as total_quota,
              MAX(el.created_at) as last_active
       FROM users u
       LEFT JOIN event_logs el ON el.user_id = u.id AND el.created_at >= ?
       GROUP BY u.id
       ORDER BY ${sort} ${order}
       LIMIT ? OFFSET ?`,
      [since, limit, offset]
    ) as {
      user_id: number; name: string;
      total_events: number; total_quota: number;
      last_active: number | null;
    }[];

    // Total count
    const totalResult = raw(
      "SELECT COUNT(DISTINCT user_id) as count FROM event_logs WHERE user_id IS NOT NULL AND created_at >= ?",
      [since]
    ) as { count: number }[];
    const total = Number(totalResult[0]?.count ?? 0);

    // Top abilities per user
    const topAbilitiesRaw = raw(
      `SELECT user_id, json_extract(metadata, '$.ability') as ability, COUNT(*) as count
       FROM event_logs
       WHERE event = 'quota.use' AND user_id IS NOT NULL AND created_at >= ?
       GROUP BY user_id, ability
       ORDER BY count DESC`,
      [since]
    ) as { user_id: number; ability: string; count: number }[];

    const abilitiesByUser = new Map<number, { ability: string; count: number }[]>();
    for (const row of topAbilitiesRaw) {
      if (!abilitiesByUser.has(row.user_id)) abilitiesByUser.set(row.user_id, []);
      const arr = abilitiesByUser.get(row.user_id)!;
      if (arr.length < 3) {
        arr.push({ ability: (row.ability ?? "").replace(/"/g, ""), count: Number(row.count) });
      }
    }

    const usersData = usersResult.map((r) => ({
      userId: r.user_id,
      name: r.name || `User ${r.user_id}`,
      totalEvents: Number(r.total_events ?? 0),
      totalQuotaUsed: Number(r.total_quota ?? 0),
      lastActive: typeof r.last_active === "object" && r.last_active !== null
        ? (r.last_active as Date).getTime()
        : (r.last_active ?? 0),
      topAbilities: abilitiesByUser.get(r.user_id) ?? [],
    }));

    return NextResponse.json({ users: usersData, pagination: { total, limit, offset } });
  });
}
