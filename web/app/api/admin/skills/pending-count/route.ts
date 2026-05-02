import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { raw } from "@/lib/db";
import { getT } from "@/lib/i18n";

export async function GET() {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  if (auth.role !== "admin" && auth.role !== "reviewer") {
    return NextResponse.json({ error: t("forbidden") }, { status: 403 });
  }

  const rows = raw(
    "SELECT COUNT(*) as count FROM skills WHERE moderation_status = 'pending' AND deleted_at IS NULL"
  ) as { count: number }[];

  return NextResponse.json({
    count: Number(rows[0]?.count ?? 0),
  });
}
