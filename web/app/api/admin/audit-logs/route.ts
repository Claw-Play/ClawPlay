import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventLogs } from "@/lib/db/schema";
import { desc, sql, eq, and, inArray } from "drizzle-orm";

// Skill-related events shown in audit log
const SKILL_EVENTS = [
  "skill.submit",
  "skill.approve",
  "skill.reject",
  "skill.feature",
  "skill.unfeature",
];

export async function GET(request: NextRequest) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const tab = searchParams.get("tab") ?? "skills";
  const userId = searchParams.get("userId");

  try {
    // Build WHERE conditions
    const conditions: ReturnType<typeof eq>[] = [];

    if (tab === "skills") {
      // Only skill-related audit events
      conditions.push(
        inArray(eventLogs.event, SKILL_EVENTS) as ReturnType<typeof eq>
      );
    }

    if (userId) {
      conditions.push(
        eq(eventLogs.userId, parseInt(userId)) as ReturnType<typeof eq>
      );
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(eventLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0]?.count ?? 0);

    // Get paginated rows (most recent first)
    const rows = await db
      .select({
        id: eventLogs.id,
        event: eventLogs.event,
        userId: eventLogs.userId,
        targetType: eventLogs.targetType,
        targetId: eventLogs.targetId,
        metadata: eventLogs.metadata,
        ipAddress: eventLogs.ipAddress,
        userAgent: eventLogs.userAgent,
        createdAt: eventLogs.createdAt,
      })
      .from(eventLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(eventLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Format entries to match the existing page interface
    const entries = rows.map((row) => ({
      id: row.id,
      event: row.event,
      actorId: row.userId,
      action: row.event,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
      ip_address: row.ipAddress,
      user_agent: row.userAgent,
      timestamp: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      ts: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    }));

    return NextResponse.json({ entries, total });
  } catch (err) {
    console.error("[api/admin/audit-logs]", err);
    return NextResponse.json(
      { error: "Could not read audit logs." },
      { status: 500 }
    );
  }
}
