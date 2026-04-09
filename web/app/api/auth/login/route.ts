import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userIdentities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signJWT, buildSetCookieHeader } from "@/lib/auth";
import { analytics } from "@/lib/analytics";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
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
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, identity.credential);
    if (!valid) {
      analytics.user.loginFailed(email, "wrong_password");
      console.warn("[auth/login] failed — wrong password", { email });
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, identity.userId),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const token = await signJWT({ userId: user.id, role: user.role as "user" | "admin" });
    analytics.user.login(user.id, "email");

    const response = NextResponse.json({
      user: { id: user.id, email, role: user.role },
    });
    response.headers.set("Set-Cookie", buildSetCookieHeader(token));
    return response;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
