import { NextRequest, NextResponse } from "next/server";
import { decryptToken, type TokenPayload } from "@/lib/token";
import { getQuota } from "@/lib/redis";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { analytics } from "@/lib/analytics";

/** Check quota status for the authenticated user */
export async function GET(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "") ??
                request.cookies.get("clawplay_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Authorization required." }, { status: 401 });
  }

  let payload: TokenPayload;
  try {
    payload = decryptToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  try {
    // Get current quota (Redis, fall back to DB)
    const quota = await getQuota(payload.userId);
    if (quota) {
      analytics.quota.check(payload.userId, quota.used, quota.limit);
      return NextResponse.json({
        userId: payload.userId,
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
        source: "redis",
      });
    }

    // Fall back to DB
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    analytics.quota.check(payload.userId, user.quotaUsed, user.quotaFree);
    return NextResponse.json({
      userId: payload.userId,
      used: user.quotaUsed,
      limit: user.quotaFree,
      remaining: user.quotaFree - user.quotaUsed,
      source: "db",
    });
  } catch (err) {
    console.error("[ability/check]", err);
    return NextResponse.json({ error: "Failed to retrieve quota." }, { status: 500 });
  }
}
