import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { withAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { analytics } from "@/lib/analytics";
import { getT } from "@/lib/i18n";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();

  return withAdmin(auth, async () => {
    const targetId = parseInt(params.id);
    const user = await db.query.users.findFirst({ where: eq(users.id, targetId) });

    if (!user) {
      return NextResponse.json({ error: t("user_not_found") }, { status: 404 });
    }

    return NextResponse.json({ id: user.id, name: user.name, role: user.role });
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();

  return withAdmin(auth, async (admin) => {
    const targetId = parseInt(params.id);

    // Prevent self-demotion
    if (targetId === admin.userId) {
      return NextResponse.json(
        { error: t("cannot_change_own_role") },
        { status: 403 }
      );
    }

    let body: { role?: string } = {};
    try {
      body = await request.json();
    } catch {
      // ignore parse errors, body stays {}
    }

    const { role } = body;

    if (!role || !["user", "reviewer", "admin"].includes(role)) {
      return NextResponse.json(
        { error: t("role_invalid") },
        { status: 400 }
      );
    }

    const existing = await db.query.users.findFirst({ where: eq(users.id, targetId) });
    if (!existing) {
      return NextResponse.json({ error: t("user_not_found") }, { status: 404 });
    }

    if (existing.role === role) {
      return NextResponse.json({ id: existing.id, name: existing.name, role: existing.role });
    }

    await db.update(users).set({ role: role as "user" | "reviewer" | "admin" }).where(eq(users.id, targetId));

    analytics.user.roleChange(targetId, admin.userId, existing.role, role);

    return NextResponse.json({ id: targetId, name: existing.name, role });
  });
}
