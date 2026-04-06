import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { userTokens } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { tokenId } = body as { tokenId?: string };

  // If no tokenId provided, revoke the user's current active token
  let token;
  if (!tokenId) {
    token = await db.query.userTokens.findFirst({
      where: (t, { and, eq, isNull }) =>
        and(eq(t.userId, auth.userId), isNull(t.revokedAt)),
    });
  } else {
    token = await db.query.userTokens.findFirst({
      where: and(
        eq(userTokens.id, tokenId),
        eq(userTokens.userId, auth.userId),
        isNull(userTokens.revokedAt)
      ),
    });
  }

  if (!token) {
    return NextResponse.json(
      { error: "Token not found or already revoked." },
      { status: 404 }
    );
  }

  await db
    .update(userTokens)
    .set({ revokedAt: new Date() })
    .where(eq(userTokens.id, token.id));

  return NextResponse.json({ message: "Token revoked." });
}
