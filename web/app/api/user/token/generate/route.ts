import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, userTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encryptToken, hashToken, type TokenPayload } from "@/lib/token";
import { ensureQuota } from "@/lib/redis";
import { analytics } from "@/lib/analytics";
import { getT } from "@/lib/i18n";
// Simple uuid-like generator (no external dep needed)
function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function POST() {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
  });
  if (!user) {
    return NextResponse.json({ error: t("user_not_found") }, { status: 404 });
  }

  // Build payload (permanent — no expiry, no quota fields)
  const payload: TokenPayload = { userId: user.id };

  // Encrypt — throws if CLAWPLAY_SECRET_KEY missing in production
  let encrypted: string;
  try {
    encrypted = encryptToken(payload);
  } catch {
    return NextResponse.json({ error: t("failed_to_generate_token") }, { status: 500 });
  }
  const tokenHash = hashToken(encrypted);

  // Store in DB
  const tokenId = genId();
  await db.insert(userTokens).values({
    id: tokenId,
    userId: user.id,
    tokenHash,
    encryptedPayload: encrypted,
  });

  // Ensure Redis quota exists without overwriting any existing usage.
  ensureQuota(user.id, user.quotaFree).catch(() => {});
  analytics.token.generate(user.id);

  return NextResponse.json({
    token: encrypted,
    tokenId,
    command: `export CLAWPLAY_TOKEN=${encrypted}`,
    createdAt: new Date().toISOString(),
  });
}
