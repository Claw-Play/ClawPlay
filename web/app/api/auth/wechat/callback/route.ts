import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userIdentities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { exchangeCode, getWechatUserInfo } from "@/lib/wechat";
import { signJWT, buildSetCookieHeader } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? "";

  // Decode redirect path from state
  let redirectPath = "/dashboard";
  try {
    redirectPath = Buffer.from(state, "base64url").toString("utf8") || "/dashboard";
    // Safety: only allow relative paths
    if (!redirectPath.startsWith("/")) redirectPath = "/dashboard";
  } catch {
    // ignore decode errors
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=wechat_denied", request.nextUrl.origin));
  }

  try {
    const { openid, accessToken } = await exchangeCode(code);
    const userInfo = await getWechatUserInfo(accessToken, openid);

    // Find or create user by wechat identity
    const identity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.provider, "wechat"),
        eq(userIdentities.providerAccountId, openid)
      ),
    });

    let userId: number;
    let role: "user" | "admin" = "user";

    if (identity) {
      userId = identity.userId;
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      role = (user?.role as "user" | "admin") ?? "user";
    } else {
      const [user] = await db
        .insert(users)
        .values({
          name: userInfo.nickname || "",
          role: "user",
          quotaFree: 1000,
          quotaUsed: 0,
        })
        .returning({ id: users.id, role: users.role });

      await db.insert(userIdentities).values({
        userId: user.id,
        provider: "wechat",
        providerAccountId: openid,
        credential: null,
      });

      userId = user.id;
      role = user.role as "user" | "admin";
    }

    const token = await signJWT({ userId, role });
    const response = NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin));
    response.headers.set("Set-Cookie", buildSetCookieHeader(token));
    return response;
  } catch (err) {
    console.error("[auth/wechat/callback]", err);
    return NextResponse.redirect(new URL("/login?error=wechat_failed", request.nextUrl.origin));
  }
}
