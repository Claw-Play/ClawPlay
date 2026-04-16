import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userIdentities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { exchangeGoogleCode, getGoogleUserInfo } from "@/lib/oauth";
import { signJWT, buildSetCookieHeader } from "@/lib/auth";
import { DEFAULT_QUOTA_FREE } from "@/lib/redis";

const AVATAR_COLORS = [
  "#586330", "#a23f00", "#fa7025", "#8a6040",
  "#5a7a4a", "#4a7a8a", "#7a4a8a", "#8a4a5a",
];
const randomAvatarColor = () =>
  AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? "";

  let redirectPath = "/dashboard";
  try {
    redirectPath = Buffer.from(state, "base64url").toString("utf8") || "/dashboard";
    if (!redirectPath.startsWith("/")) redirectPath = "/dashboard";
  } catch {
    // ignore decode errors
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=google_denied", request.nextUrl.origin)
    );
  }

  try {
    const { accessToken } = await exchangeGoogleCode(code, request.nextUrl.origin);
    const userInfo = await getGoogleUserInfo(accessToken);

    const identity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.provider, "google"),
        eq(userIdentities.providerAccountId, userInfo.id)
      ),
    });

    let userId: number;
    let role: "user" | "admin" | "reviewer" = "user";

    if (identity) {
      userId = identity.userId;
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      role = (user?.role as "user" | "admin" | "reviewer") ?? "user";
    } else {
      const [user] = await db
        .insert(users)
        .values({
          name: userInfo.name || userInfo.email.split("@")[0],
          role: "user",
          quotaFree: DEFAULT_QUOTA_FREE,
          avatarColor: randomAvatarColor(),
          avatarUrl: userInfo.picture ?? null,
        })
        .returning({ id: users.id, role: users.role });

      await db.insert(userIdentities).values({
        userId: user.id,
        provider: "google",
        providerAccountId: userInfo.id,
        credential: null,
      });

      userId = user.id;
      role = user.role as "user" | "admin" | "reviewer";
      redirectPath = "/?welcome#featured-skills";
    }

    const token = await signJWT({ userId, role });
    const response = NextResponse.redirect(
      new URL(redirectPath, request.nextUrl.origin)
    );
    response.headers.set("Set-Cookie", buildSetCookieHeader(token));
    return response;
  } catch (err) {
    console.error("[auth/google/callback]", err);
    return NextResponse.redirect(
      new URL("/login?error=google_failed", request.nextUrl.origin)
    );
  }
}
