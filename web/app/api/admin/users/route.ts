import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { withAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromCookies();

  return withAdmin(auth, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const limit = Math.min(parseInt(searchParams.get("limit") ?? "500"), 500);
      const offset = parseInt(searchParams.get("offset") ?? "0");

      const rows = await db
        .select({ id: users.id, name: users.name, role: users.role })
        .from(users)
        .orderBy(asc(users.id))
        .limit(limit)
        .offset(offset);

      return NextResponse.json({ users: rows });
    } catch (err) {
      console.error("[api/admin/users]", err);
      return NextResponse.json({ error: "Could not read users." }, { status: 500 });
    }
  });
}
