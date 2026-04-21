import { db } from "@/lib/db";
import { userIdentities, users, userTokens } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getAuthFromCookies } from "@/lib/auth";
import { getQuota, DEFAULT_QUOTA_FREE } from "@/lib/redis";
import { redirect } from "next/navigation";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

async function getDashboardData(userId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) return null;

  const identities = await db
    .select()
    .from(userIdentities)
    .where(eq(userIdentities.userId, userId)) as { provider: string; providerAccountId: string | null }[];

  const email = identities.find((i) => i.provider === "email")?.providerAccountId ?? null;
  const phone = identities.find((i) => i.provider === "phone")?.providerAccountId ?? null;
  const wechat = identities.find((i) => i.provider === "wechat")?.providerAccountId ?? null;

  // Get quota from Redis only. event_logs remains audit-only and no longer
  // participates in real-time quota display.
  const quotaFromRedis = await getQuota(userId);
  const quota = quotaFromRedis ?? { used: 0, limit: DEFAULT_QUOTA_FREE, remaining: DEFAULT_QUOTA_FREE };

  const tokenRows = await db
    .select({ id: userTokens.id, createdAt: userTokens.createdAt, encryptedPayload: userTokens.encryptedPayload })
    .from(userTokens)
    .where(and(eq(userTokens.userId, userId), isNull(userTokens.revokedAt)))
    .limit(1);
  const activeToken = tokenRows[0] ?? null;

  return {
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email,
      phone,
      wechat,
      avatarColor: user.avatarColor,
      avatarInitials: user.avatarInitials,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.createdAt instanceof Date && !isNaN(user.createdAt.getTime()) ? user.createdAt.toISOString() : null,
    },
    quota,
    token: activeToken
      ? {
          id: activeToken.id,
          createdAt:
            activeToken.createdAt instanceof Date && !isNaN(activeToken.createdAt.getTime())
              ? activeToken.createdAt.toISOString()
              : null,
          value: activeToken.encryptedPayload,
        }
      : null,
  };
}

export default async function DashboardPage() {
  const auth = await getAuthFromCookies();
  if (!auth) {
    redirect("/login?from=%2Fdashboard");
  }

  const data = await getDashboardData(auth.userId);
  if (!data) {
    redirect("/login?from=%2Fdashboard");
  }

  return (
    <DashboardClient
      user={data.user}
      quota={data.quota}
      token={data.token}
    />
  );
}
