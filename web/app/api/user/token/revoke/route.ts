import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { userTokens } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { analytics } from "@/lib/analytics";
import { getT } from "@/lib/i18n";

export async function POST(request: NextRequest) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { tokenId } = body as { tokenId?: string };

  // If no tokenId provided, revoke the user's current active token
  let token;
  if (!tokenId) {
    token = await db.query.userTokens.findFirst({
      where: and(eq(userTokens.userId, auth.userId), isNull(userTokens.revokedAt)),
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
      { error: t("token_not_found") },
      { status: 404 }
    );
  }

  await db
    .update(userTokens)
    .set({ revokedAt: new Date() })
    .where(eq(userTokens.id, token.id));

  analytics.token.revoke(auth.userId, token.id);

  return NextResponse.json({ message: t("token_revoked") });
}
