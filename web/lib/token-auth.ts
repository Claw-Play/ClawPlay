import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, userTokens } from "@/lib/db/schema";
import { decryptToken, hashToken, type TokenPayload } from "@/lib/token";

export interface ClawplayTokenAuth {
  userId: number;
  userRole: "user" | "admin" | "reviewer";
  token: string;
  tokenId: string;
}

function extractBearerToken(request: Pick<NextRequest, "headers">): string | null {
  const raw = request.headers.get("Authorization");
  if (!raw) return null;
  const token = raw.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 ? token : null;
}

/**
 * Authenticate a CLAWPLAY_TOKEN bearer token against the DB.
 * Returns null if the token is missing, invalid, revoked, or the user no longer exists.
 */
export async function authenticateClawplayToken(
  request: Pick<NextRequest, "headers">
): Promise<ClawplayTokenAuth | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  let payload: TokenPayload;
  try {
    payload = decryptToken<TokenPayload>(token);
  } catch {
    return null;
  }

  const tokenHash = hashToken(token);
  const tokenRecord = await db.query.userTokens.findFirst({
    where: and(eq(userTokens.tokenHash, tokenHash), isNull(userTokens.revokedAt)),
  });
  if (!tokenRecord || tokenRecord.userId !== payload.userId) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId),
  });
  if (!user) return null;

  return {
    userId: user.id,
    userRole: user.role as "user" | "admin" | "reviewer",
    token,
    tokenId: tokenRecord.id,
  };
}
