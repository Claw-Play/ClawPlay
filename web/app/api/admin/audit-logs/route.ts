import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { raw } from "@/lib/db";
import { getT } from "@/lib/i18n";

const SKILL_EVENTS = [
  "skill.submit",
  "skill.approve",
  "skill.reject",
  "skill.feature",
  "skill.unfeature",
];

export async function GET(request: NextRequest) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  if (auth.role !== "admin") {
    return NextResponse.json({ error: t("forbidden") }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const tab = searchParams.get("tab") ?? "skills";
  const userId = searchParams.get("userId");

  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (tab === "skills") {
      conditions.push(`event IN (${SKILL_EVENTS.map(() => "?").join(",")})`);
      params.push(...SKILL_EVENTS);
    }

    if (userId) {
      conditions.push("user_id = ?");
      params.push(parseInt(userId));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = raw(
      `SELECT COUNT(*) as count FROM event_logs ${whereClause}`,
      params
    ) as { count: number }[];
    const total = Number(countResult[0]?.count ?? 0);

    const rows = raw(
      `SELECT id, event, user_id, target_type, target_id, metadata, ip_address, user_agent, created_at
       FROM event_logs ${whereClause}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as Record<string, unknown>[];

    const entries = rows.map((r) => ({
      id: r.id,
      event: r.event,
      actorId: r.user_id,
      action: r.event,
      targetType: r.target_type,
      targetId: r.target_id,
      metadata: (() => {
        try { return JSON.parse(r.metadata as string); } catch { return {}; }
      })(),
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      timestamp: r.created_at as number | null,
    }));

    return NextResponse.json({ entries, total });
  } catch (err) {
    console.error("[api/admin/audit-logs]", err);
    return NextResponse.json(
      { error: t("could_not_read_audit_logs") },
      { status: 500 }
    );
  }
}
