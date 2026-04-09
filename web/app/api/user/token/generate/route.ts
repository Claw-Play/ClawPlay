import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, userTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encryptToken, hashToken, type TokenPayload } from "@/lib/token";
import { initQuota } from "@/lib/redis";
import { analytics } from "@/lib/analytics";
// Simple uuid-like generator (no external dep needed)
function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function POST() {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Build payload (permanent — no expiry)
  const payload: TokenPayload = {
    userId: user.id,
    quotaFree: user.quotaFree,
    quotaUsed: user.quotaUsed,
  };

  // Encrypt — throws if CLAWPLAY_SECRET_KEY missing in production
  const encrypted = encryptToken(payload);
  const tokenHash = hashToken(encrypted);

  // Store in DB
  const tokenId = genId();
  await db.insert(userTokens).values({
    id: tokenId,
    userId: user.id,
    tokenHash,
    encryptedPayload: encrypted,
  });

  // Initialize Redis quota — fire-and-forget, never blocks token generation
  initQuota(user.id, user.quotaFree).catch(() => {});
  analytics.token.generate(user.id);

  return NextResponse.json({
    token: encrypted,
    tokenId,
    command: `export CLAWPLAY_TOKEN=${encrypted}`,
    createdAt: new Date().toISOString(),
  });
}
