import { db } from "@/lib/db";
import { userIdentities, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAuthFromCookies } from "@/lib/auth";
import { getQuota } from "@/lib/redis";
import { redirect } from "next/navigation";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

async function getDashboardData(userId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) return null;

  const identities = await db.query.userIdentities.findMany({
    where: eq(userIdentities.userId, userId),
  });

  const email = identities.find((i) => i.provider === "email")?.providerAccountId ?? null;
  const phone = identities.find((i) => i.provider === "phone")?.providerAccountId ?? null;
  const wechat = identities.find((i) => i.provider === "wechat")?.providerAccountId ?? null;

  let quota = await getQuota(userId);
  if (!quota) {
    quota = {
      used: user.quotaUsed,
      limit: user.quotaFree,
      remaining: user.quotaFree - user.quotaUsed,
    };
  }

  const activeToken = await db.query.userTokens.findFirst({
    columns: { id: true, createdAt: true },
    where: (t, { and, eq, isNull }) =>
      and(eq(t.userId, userId), isNull(t.revokedAt)),
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email,
      phone,
      wechat,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    },
    quota,
    token: activeToken
      ? { id: activeToken.id, createdAt: activeToken.createdAt instanceof Date ? activeToken.createdAt.toISOString() : activeToken.createdAt }
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
