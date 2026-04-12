import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { decryptToken, type TokenPayload } from "@/lib/token";
import { db } from "@/lib/db";
import { users, userIdentities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getQuota, DEFAULT_QUOTA_FREE } from "@/lib/redis";

export async function GET(request: NextRequest) {
  // Accept either JWT cookie or Bearer CLAWPLAY_TOKEN
  let auth = await getAuthFromCookies();

  // Fallback: try Bearer token (CLAWPLAY_TOKEN = AES-256-GCM encrypted)
  if (!auth) {
    const bearer = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (bearer) {
      try {
        const payload = decryptToken<TokenPayload>(bearer);
        auth = { userId: payload.userId, role: "user" };
      } catch {
        // Token invalid — fall through to unauthorized
      }
    }
  }

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Collect all linked identities for display (email, phone)
  const identities = await db.query.userIdentities.findMany({
    where: eq(userIdentities.userId, auth.userId),
  });

  const email = identities.find((i) => i.provider === "email")?.providerAccountId ?? null;
  const phone = identities.find((i) => i.provider === "phone")?.providerAccountId ?? null;
  const wechat = identities.find((i) => i.provider === "wechat")?.providerAccountId ?? null;

  // Get quota from Redis (real-time source of truth)
  const quota = await getQuota(auth.userId);

  // Get current active token (not revoked, belongs to this user)
  const activeToken = await db.query.userTokens.findFirst({
    columns: { id: true, createdAt: true },
    where: (t, { and, eq, isNull }) =>
      and(eq(t.userId, auth.userId), isNull(t.revokedAt)),
  });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email,
      phone,
      wechat,
      avatarColor: user.avatarColor,
      avatarInitials: user.avatarInitials,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.createdAt,
    },
    quota: quota ?? { used: 0, limit: DEFAULT_QUOTA_FREE, remaining: DEFAULT_QUOTA_FREE },
    token: activeToken
      ? { id: activeToken.id, createdAt: activeToken.createdAt }
      : null,
  });
}

export async function PATCH(request: NextRequest) {
  let auth = await getAuthFromCookies();

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, avatarColor, avatarInitials, avatarUrl } = body as {
    name?: string;
    avatarColor?: string;
    avatarInitials?: string;
    avatarUrl?: string | null;
  };

  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 32) {
      return NextResponse.json({ error: "Name must be 2–32 characters." }, { status: 400 });
    }
    updates.name = trimmed;
  }

  if (avatarColor !== undefined) {
    if (!/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(avatarColor)) {
      return NextResponse.json({ error: "Invalid color format." }, { status: 400 });
    }
    updates.avatarColor = avatarColor;
  }

  if (avatarInitials !== undefined) {
    updates.avatarInitials = (avatarInitials ?? "").trim().slice(0, 2).toUpperCase();
  }

  if (avatarUrl !== undefined) {
    // Accept null to clear avatar, or a data URL / valid URL
    if (avatarUrl === null) {
      updates.avatarUrl = null;
    } else {
      const trimmed = (avatarUrl ?? "").trim();
      if (trimmed.length > 0) {
        // Basic validation: must be data URL or plausible HTTP URL
        if (!/^(data:image\/\w+;base64,|https?:\/\/)/.test(trimmed)) {
          return NextResponse.json({ error: "Invalid avatar URL format." }, { status: 400 });
        }
        if (trimmed.length > 5 * 1024 * 1024) {
          return NextResponse.json({ error: "Avatar image too large (max 5MB)." }, { status: 400 });
        }
        updates.avatarUrl = trimmed;
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, auth.userId));
  }

  const updated = await db.query.users.findFirst({ where: eq(users.id, auth.userId) });
  return NextResponse.json({
    name: updated?.name ?? "",
    avatarColor: updated?.avatarColor ?? "#586330",
    avatarInitials: updated?.avatarInitials ?? "",
    avatarUrl: updated?.avatarUrl ?? null,
  });
}
