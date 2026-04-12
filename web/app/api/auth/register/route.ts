import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userIdentities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signJWT, buildSetCookieHeader } from "@/lib/auth";
import { analytics } from "@/lib/analytics";
import { DEFAULT_QUOTA_FREE } from "@/lib/redis";

const AVATAR_COLORS = [
  "#586330",
  "#a23f00",
  "#fa7025",
  "#8a6040",
  "#5a7a4a",
  "#4a7a8a",
  "#7a4a8a",
  "#8a4a5a",
];
const randomAvatarColor = () =>
  AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format." },
        { status: 400 }
      );
    }

    // Check duplicate email in user_identities
    const existing = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.provider, "email"),
        eq(userIdentities.providerAccountId, email.toLowerCase())
      ),
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const cost = process.env.NODE_ENV === "production" ? 12 : 6;
    const credential = await bcrypt.hash(password, cost);

    // Create user + identity in a transaction
    const [user] = await db.insert(users).values({
      name: name?.trim() || "",
      role: "user",
      quotaFree: DEFAULT_QUOTA_FREE,
      avatarColor: randomAvatarColor(),
    }).returning({ id: users.id, role: users.role });

    await db.insert(userIdentities).values({
      userId: user.id,
      provider: "email",
      providerAccountId: email.toLowerCase(),
      credential,
    });

    const token = await signJWT({ userId: user.id, role: user.role as "user" | "admin" });
    analytics.user.register(user.id, "email");

    const response = NextResponse.json(
      { user: { id: user.id, email, role: user.role }, message: "Account created successfully." },
      { status: 201 }
    );
    response.headers.set("Set-Cookie", buildSetCookieHeader(token));
    return response;
  } catch (err) {
    console.error("[auth/register]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
