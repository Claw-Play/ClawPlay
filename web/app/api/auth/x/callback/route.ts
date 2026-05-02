import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userIdentities, userTokens } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { exchangeXCode, getXUserInfo } from "@/lib/oauth";
import { signJWT, buildSetCookieHeader } from "@/lib/auth";
import { DEFAULT_QUOTA_FREE, ensureQuota } from "@/lib/redis";
import { getPublicOrigin } from "@/lib/request-origin";

const AVATAR_COLORS = [
  "#586330", "#2d67f7", "#4f82f7", "#8a6040",
  "#5a7a4a", "#4a7a8a", "#7a4a8a", "#8a4a5a",
];
const randomAvatarColor = () =>
  AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? "";
  const publicOrigin = getPublicOrigin(request);
  // X uses PKCE, so we don't need a code_verifier stored — but we need to handle it
  // Twitter OAuth 2.0 requires code_challenge. We use S256, which means we need
  // the code_verifier to exchange the code. Since we can't pass it via callback,
  // we use a cookie to temporarily store the code_verifier per-request.
  const codeVerifier = request.cookies.get("x_code_verifier")?.value ?? "";

  let redirectPath = "/dashboard";
  try {
    redirectPath = Buffer.from(state, "base64url").toString("utf8") || "/dashboard";
    if (!redirectPath.startsWith("/")) redirectPath = "/dashboard";
  } catch {
    // ignore decode errors
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=x_denied", publicOrigin)
    );
  }

  try {
    const accessToken = await exchangeXCode(code, codeVerifier, publicOrigin);
    const userInfo = await getXUserInfo(accessToken);

    const identity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.provider, "x"),
        eq(userIdentities.providerAccountId, userInfo.id)
      ),
    });

    let userId: number;
    let role: "user" | "admin" | "reviewer" = "user";

    if (identity) {
      userId = identity.userId;
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      role = (user?.role as "user" | "admin" | "reviewer") ?? "user";

      // Returning user with a token → skip dashboard
      if (redirectPath === "/dashboard") {
        const existingToken = await db
          .select({ id: userTokens.id })
          .from(userTokens)
          .where(and(eq(userTokens.userId, userId), isNull(userTokens.revokedAt)))
          .limit(1);
        if (existingToken.length > 0) {
          redirectPath = "/skills";
        }
      }
    } else {
      const [user] = await db
        .insert(users)
        .values({
          name: userInfo.name || `@${userInfo.username}`,
          role: "user",
          quotaFree: DEFAULT_QUOTA_FREE,
          avatarColor: randomAvatarColor(),
        })
        .returning({ id: users.id, role: users.role });

      await db.insert(userIdentities).values({
        userId: user.id,
        provider: "x",
        providerAccountId: userInfo.id,
        credential: null,
      });

      ensureQuota(user.id, DEFAULT_QUOTA_FREE).catch(() => {});

      userId = user.id;
      role = user.role as "user" | "admin" | "reviewer";
      redirectPath = "/?welcome#featured-skills";
    }

    const token = await signJWT({ userId, role });
    const response = NextResponse.redirect(
      new URL(redirectPath, publicOrigin)
    );
    response.headers.set("Set-Cookie", buildSetCookieHeader(token));
    return response;
  } catch (err) {
    console.error("[auth/x/callback]", err);
    return NextResponse.redirect(
      new URL("/login?error=x_failed", publicOrigin)
    );
  }
}
