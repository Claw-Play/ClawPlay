import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userIdentities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifySmsCode } from "@/lib/sms";
import { signJWT, buildSetCookieHeader } from "@/lib/auth";

const PHONE_RE = /^1[3-9]\d{9}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code, name } = body as {
      phone?: string;
      code?: string;
      name?: string;
    };

    if (!phone || !PHONE_RE.test(phone)) {
      return NextResponse.json({ error: "请输入有效的手机号。" }, { status: 400 });
    }

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "请输入6位验证码。" }, { status: 400 });
    }

    const valid = await verifySmsCode(phone, code);
    if (!valid) {
      return NextResponse.json(
        { error: "验证码错误或已过期，请重新获取。" },
        { status: 401 }
      );
    }

    // Find or create user by phone identity
    const identity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.provider, "phone"),
        eq(userIdentities.providerAccountId, phone)
      ),
    });

    let userId: number;
    let role: "user" | "admin" = "user";

    if (identity) {
      userId = identity.userId;
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      role = (user?.role as "user" | "admin") ?? "user";
    } else {
      // Auto-register new user
      const [user] = await db
        .insert(users)
        .values({ name: name?.trim() || "", role: "user", quotaFree: 1000, quotaUsed: 0 })
        .returning({ id: users.id, role: users.role });

      await db.insert(userIdentities).values({
        userId: user.id,
        provider: "phone",
        providerAccountId: phone,
        credential: null,
      });

      userId = user.id;
      role = user.role as "user" | "admin";
    }

    const token = await signJWT({ userId, role });
    const response = NextResponse.json({ user: { id: userId, phone, role } });
    response.headers.set("Set-Cookie", buildSetCookieHeader(token));
    return response;
  } catch (err) {
    console.error("[auth/sms/verify]", err);
    return NextResponse.json({ error: "服务器错误，请稍后重试。" }, { status: 500 });
  }
}
