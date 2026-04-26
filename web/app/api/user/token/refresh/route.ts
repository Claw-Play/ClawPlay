import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userTokens } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { encryptToken, hashToken } from "@/lib/token";
import { authenticateClawplayToken } from "@/lib/token-auth";
import { getT } from "@/lib/i18n";

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Refresh CLAWPLAY_TOKEN: decrypt old token, generate new one with fresh expiry.
 * Accepts Bearer CLAWPLAY_TOKEN (not JWT cookie) so CLI can auto-refresh silently.
 */
export async function POST(request: NextRequest) {
  const t = await getT("errors");
  const auth = await authenticateClawplayToken(request);
  if (!auth) {
    return NextResponse.json({ error: t("invalid_token") }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
  });
  if (!user) {
    return NextResponse.json({ error: t("user_not_found") }, { status: 404 });
  }

  // Revoke old token (add to blocklist)
  const oldHash = hashToken(auth.token);
  await db
    .update(userTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(userTokens.tokenHash, oldHash), isNull(userTokens.revokedAt)));

  // Build new payload (permanent — no expiry, no quota fields)
  const newPayload = { userId: auth.userId };

  const newEncrypted = encryptToken(newPayload);
  const newTokenHash = hashToken(newEncrypted);

  // Store new token
  const tokenId = genId();
  await db.insert(userTokens).values({
    id: tokenId,
    userId: auth.userId,
    tokenHash: newTokenHash,
    encryptedPayload: newEncrypted,
  });

  return NextResponse.json({
    token: newEncrypted,
    command: `export CLAWPLAY_TOKEN=${newEncrypted}`,
    refreshed: true,
  });
}
