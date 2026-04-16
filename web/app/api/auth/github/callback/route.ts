import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userIdentities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { exchangeGithubCode, getGithubUserInfo } from "@/lib/oauth";
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
    console.error("[auth/github/callback] no code — user denied or state error");
    return NextResponse.redirect(
      new URL("/login?error=github_denied", request.nextUrl.origin)
    );
  }

  try {
    console.log("[auth/github/callback] exchanging code...");
    const accessToken = await exchangeGithubCode(code, request.nextUrl.origin);
    console.log("[auth/github/callback] fetching user info...");
    const userInfo = await getGithubUserInfo(accessToken);
    console.log("[auth/github/callback] got user:", JSON.stringify(userInfo));

    const identity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.provider, "github"),
        eq(userIdentities.providerAccountId, String(userInfo.id))
      ),
    });

    let userId: number;
    let role: "user" | "admin" | "reviewer" = "user";

    if (identity) {
      console.log("[auth/github/callback] existing user, identityId:", identity.id);
      userId = identity.userId;
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      role = (user?.role as "user" | "admin" | "reviewer") ?? "user";
    } else {
      console.log("[auth/github/callback] creating new user...");
      const [user] = await db
        .insert(users)
        .values({
          name: userInfo.name || userInfo.email.split("@")[0],
          role: "user",
          quotaFree: DEFAULT_QUOTA_FREE,
          avatarColor: randomAvatarColor(),
          avatarUrl: userInfo.avatarUrl || null,
        })
        .returning({ id: users.id, role: users.role });

      await db.insert(userIdentities).values({
        userId: user.id,
        provider: "github",
        providerAccountId: String(userInfo.id),
        credential: null,
      });

      userId = user.id;
      role = user.role as "user" | "admin" | "reviewer";
      // First-time login: redirect to homepage at featured-skills section
      redirectPath = "/?welcome#featured-skills";
    }

    const token = await signJWT({ userId, role });
    console.log("[auth/github/callback] success, redirecting to:", redirectPath);
    const response = NextResponse.redirect(
      new URL(redirectPath, request.nextUrl.origin)
    );
    response.headers.set("Set-Cookie", buildSetCookieHeader(token));
    return response;
  } catch (err) {
    console.error("[auth/github/callback] error:", err);
    return NextResponse.redirect(
      new URL("/login?error=github_failed", request.nextUrl.origin)
    );
  }
}
