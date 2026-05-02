import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userIdentities, userTokens } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signJWT, buildSetCookieHeader } from "@/lib/auth";
import { analytics } from "@/lib/analytics";
import { getT } from "@/lib/i18n";

export async function POST(request: NextRequest) {
  try {
    const t = await getT("errors");
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json(
        { error: t("email_required") },
        { status: 400 }
      );
    }

    const identity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.provider, "email"),
        eq(userIdentities.providerAccountId, email.toLowerCase())
      ),
    });

    if (!identity || !identity.credential) {
      analytics.user.loginFailed(email, "identity_not_found");
      console.warn("[auth/login] failed — identity not found", { email });
      return NextResponse.json({ error: t("invalid_email_or_password") }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, identity.credential);
    if (!valid) {
      analytics.user.loginFailed(email, "wrong_password");
      console.warn("[auth/login] failed — wrong password", { email });
      return NextResponse.json({ error: t("invalid_email_or_password") }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, identity.userId),
    });

    if (!user) {
      return NextResponse.json({ error: t("not_found", { resource: "User" }) }, { status: 404 });
    }

    const token = await signJWT({ userId: user.id, role: user.role as "user" | "admin" | "reviewer" });
    analytics.user.login(user.id, "email");

    // Check if user already has a non-revoked token
    const existingToken = await db
      .select({ id: userTokens.id })
      .from(userTokens)
      .where(and(eq(userTokens.userId, user.id), isNull(userTokens.revokedAt)))
      .limit(1);

    const response = NextResponse.json({
      user: { id: user.id, email, role: user.role },
      hasToken: existingToken.length > 0,
    });
    response.headers.set("Set-Cookie", buildSetCookieHeader(token));
    return response;
  } catch (err) {
    console.error("[auth/login]", err);
    const t = await getT("errors");
    return NextResponse.json({ error: t("internal_error") }, { status: 500 });
  }
}
