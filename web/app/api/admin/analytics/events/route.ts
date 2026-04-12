import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { withAdmin } from "@/lib/auth/admin";
import { raw } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromCookies();

  return withAdmin(auth, async () => {
    const { searchParams } = new URL(request.url);
    const eventFilter = searchParams.get("event");
    const userIdFilter = searchParams.get("user_id");
    const targetTypeFilter = searchParams.get("target_type");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (eventFilter) { conditions.push(`event = ?`); params.push(eventFilter); }
    if (userIdFilter) { conditions.push(`user_id = ?`); params.push(parseInt(userIdFilter)); }
    if (targetTypeFilter) { conditions.push(`target_type = ?`); params.push(targetTypeFilter); }
    if (from) { conditions.push(`created_at >= ?`); params.push(parseInt(from)); }
    if (to) { conditions.push(`created_at <= ?`); params.push(parseInt(to)); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Total count
    const countResult = raw(
      `SELECT COUNT(*) as count FROM event_logs ${whereClause}`,
      params
    ) as { count: number }[];
    const total = Number(countResult[0]?.count ?? 0);

    // Events list
    const eventsResult = raw(
      `SELECT id, event, user_id, target_type, target_id, metadata, ip_address, user_agent, created_at FROM event_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as Record<string, unknown>[];

    const events = eventsResult.map((r) => ({
      id: r.id,
      event: r.event,
      user_id: r.user_id,
      target_type: r.target_type,
      target_id: r.target_id,
      metadata: (() => { try { return JSON.parse(r.metadata as string); } catch { return {}; } })(),
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      created_at: typeof r.created_at === "object" && r.created_at !== null
        ? (r.created_at as Date).getTime()
        : r.created_at,
    }));

    return NextResponse.json({ events, pagination: { total, limit, offset } });
  });
}
