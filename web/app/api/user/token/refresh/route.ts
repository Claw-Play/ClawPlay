import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userTokens } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { encryptToken, hashToken, decryptToken, type TokenPayload } from "@/lib/token";

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Refresh CLAWPLAY_TOKEN: decrypt old token, generate new one with fresh expiry.
 * Accepts Bearer CLAWPLAY_TOKEN (not JWT cookie) so CLI can auto-refresh silently.
 */
export async function POST(request: NextRequest) {
  const token =
    request.headers.get("Authorization")?.replace("Bearer ", "") ??
    request.cookies.get("clawplay_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Token required." }, { status: 401 });
  }

  // Decrypt and validate
  let payload: TokenPayload;
  try {
    payload = decryptToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }


  // Verify user still exists
  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId),
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Revoke old token (add to blocklist)
  const oldHash = hashToken(token);
  await db
    .update(userTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(userTokens.tokenHash, oldHash), isNull(userTokens.revokedAt)));

  // Build new payload (permanent — no expiry, no quota fields)
  const newPayload: TokenPayload = { userId: payload.userId };

  const newEncrypted = encryptToken(newPayload);
  const newTokenHash = hashToken(newEncrypted);

  // Store new token
  const tokenId = genId();
  await db.insert(userTokens).values({
    id: tokenId,
    userId: payload.userId,
    tokenHash: newTokenHash,
    encryptedPayload: newEncrypted,
  });

  return NextResponse.json({
    token: newEncrypted,
    command: `export CLAWPLAY_TOKEN=${newEncrypted}`,
    refreshed: true,
  });
}
