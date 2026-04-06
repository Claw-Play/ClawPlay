import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, userIdentities, userTokens } from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { getQuota } from "@/lib/redis";
import { decryptToken, type TokenPayload } from "@/lib/token";

export async function GET(request: NextRequest) {
  // Accept either JWT cookie or Bearer CLAWPLAY_TOKEN
  let auth = await getAuthFromCookies();

  // Fallback: try Bearer token (CLAWPLAY_TOKEN = AES-256-GCM encrypted)
  if (!auth) {
    const bearer = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (bearer) {
      try {
        const payload = decryptToken<TokenPayload>(bearer);
        auth = { userId: payload.userId, role: "user" };
      } catch {
        // Token invalid — fall through to unauthorized
      }
    }
  }

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Collect all linked identities for display (email, phone)
  const identities = await db.query.userIdentities.findMany({
    where: eq(userIdentities.userId, auth.userId),
  });

  const email = identities.find((i) => i.provider === "email")?.providerAccountId ?? null;
  const phone = identities.find((i) => i.provider === "phone")?.providerAccountId ?? null;
  const wechat = identities.find((i) => i.provider === "wechat")?.providerAccountId ?? null;

  let quota = await getQuota(auth.userId);
  if (!quota) {
    quota = {
      used: user.quotaUsed,
      limit: user.quotaFree,
      remaining: user.quotaFree - user.quotaUsed,
    };
  }

  // Get current active token (not revoked, belongs to this user)
  const activeToken = await db.query.userTokens.findFirst({
    columns: { id: true, createdAt: true },
    where: (t, { and, eq, isNull }) =>
      and(eq(t.userId, auth.userId), isNull(t.revokedAt)),
  });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email,
      phone,
      wechat,
      createdAt: user.createdAt,
    },
    quota,
    token: activeToken
      ? { id: activeToken.id, createdAt: activeToken.createdAt }
      : null,
  });
}
