import { NextRequest, NextResponse } from "next/server";
import { authenticateClawplayToken } from "@/lib/token-auth";
import { getQuota, DEFAULT_QUOTA_FREE } from "@/lib/redis";
import { analytics } from "@/lib/analytics";
import { getT } from "@/lib/i18n";

/** Check quota status for the authenticated user */
export async function GET(request: NextRequest) {
  const t = await getT("errors");
  const auth = await authenticateClawplayToken(request);
  if (!auth) {
    return NextResponse.json({ error: t("invalid_auth_token") }, { status: 401 });
  }

  try {
    const quota = await getQuota(auth.userId);
    if (quota) {
      analytics.quota.check(auth.userId, quota.used, quota.limit);
      return NextResponse.json({
        userId: auth.userId,
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
        source: "redis",
      });
    }

    // Redis not configured — allow through in dev
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: t("quota_service_unavailable") }, { status: 503 });
    }
    return NextResponse.json({
      userId: auth.userId,
      used: 0,
      limit: DEFAULT_QUOTA_FREE,
      remaining: DEFAULT_QUOTA_FREE,
      source: "none",
    });
  } catch (err) {
    console.error("[ability/check]", err);
    return NextResponse.json({ error: t("quota_fetch_failed") }, { status: 500 });
  }
}
