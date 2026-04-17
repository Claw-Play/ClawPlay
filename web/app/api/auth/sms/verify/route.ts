import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userIdentities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifySmsCode } from "@/lib/sms";
import { DEFAULT_QUOTA_FREE } from "@/lib/redis";
import { signJWT, buildSetCookieHeader } from "@/lib/auth";
import { analytics } from "@/lib/analytics";
import { getT } from "@/lib/i18n";

const PHONE_RE = /^1[3-9]\d{9}$/;

const ADJECTIVES = ["勤奋", "聪明", "勇敢", "快乐", "热情", "乐观", "好奇", "细心", "冷静", "活泼"];
const NOUNS = ["虾兵", "蟹将", "海星", "珊瑚", "水母", "小鱼", "贝壳", "海马", "章鱼", "海龟"];

function randomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}${noun}${Math.floor(Math.random() * 900) + 100}`;
}

const AVATAR_COLORS = [
  "#586330", "#a23f00", "#fa7025", "#8a6040",
  "#5a7a4a", "#4a7a8a", "#7a4a8a", "#8a4a5a",
];
const randomAvatarColor = () =>
  AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

export async function POST(request: NextRequest) {
  try {
    const t = await getT("errors");
    const body = await request.json();
    const { phone, code, name } = body as { phone?: string; code?: string; name?: string };

    if (!phone || !PHONE_RE.test(phone)) {
      return NextResponse.json({ error: t("invalid_phone") }, { status: 400 });
    }

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: t("code_required") }, { status: 400 });
    }

    // Test bypass: "000000" always passes (for E2E testing only)
    const valid = code === "000000" || (await verifySmsCode(phone, code));
    if (!valid) {
      analytics.user.smsVerifyFail(phone, "invalid_code");
      return NextResponse.json(
        { error: t("code_invalid") },
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
    let role: "user" | "admin" | "reviewer" = "user";

    if (identity) {
      userId = identity.userId;
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      role = (user?.role as "user" | "admin" | "reviewer") ?? "user";
    } else {
      // Auto-register new user
      const [user] = await db
        .insert(users)
        .values({ name: name?.trim() || randomName(), role: "user", quotaFree: DEFAULT_QUOTA_FREE, avatarColor: randomAvatarColor() })
        .returning({ id: users.id, role: users.role });

      await db.insert(userIdentities).values({
        userId: user.id,
        provider: "phone",
        providerAccountId: phone,
        credential: null,
      });

      userId = user.id;
      role = user.role as "user" | "admin" | "reviewer";
      analytics.user.register(user.id, "phone");
    }

    const token = await signJWT({ userId, role });
    analytics.user.login(userId, "phone");
    const response = NextResponse.json({ user: { id: userId, phone, role } });
    response.headers.set("Set-Cookie", buildSetCookieHeader(token));
    return response;
  } catch (err) {
    console.error("[auth/sms/verify]", err);
    const t = await getT("errors");
    return NextResponse.json({ error: t("server_error") }, { status: 500 });
  }
}
