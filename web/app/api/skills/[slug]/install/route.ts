import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { verifyJWT } from "@/lib/auth";
import { analytics, incrementSkillStat } from "@/lib/analytics";
import { getT } from "@/lib/i18n";

// POST /api/skills/[slug]/install
// CLI calls this after successfully installing a skill locally.
// Increments statsInstalls on the skill, and fires a skill.install analytics event.
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const t = await getT("errors");
  const { slug } = params;

  // Validate slug
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: t("invalid_slug") }, { status: 400 });
  }

  // Authenticate via Bearer token (CLI passes CLAWPLAY_TOKEN)
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let userId: number | null = null;
  if (token) {
    const payload = await verifyJWT(token);
    if (payload) {
      userId = payload.userId;
    }
  }

  // Look up skill
  const skill = await db.query.skills.findFirst({
    where: and(
      eq(skills.slug, slug),
      isNull(skills.deletedAt),
      eq(skills.moderationStatus, "approved")
    ),
  });

  if (!skill) {
    return NextResponse.json({ error: t("skill_not_found") }, { status: 404 });
  }

  // Fire-and-forget: record install (non-blocking)
  void doRecordInstall(skill.id, userId);

  return NextResponse.json({ ok: true });
}

async function doRecordInstall(skillId: string, userId: number | null): Promise<void> {
  try {
    // Increment statsInstalls on the skill
    await incrementSkillStat(skillId, "statsInstalls");
  } catch (err) {
    console.error(`[analytics] Failed to increment statsInstalls for ${skillId}:`, err);
  }

  try {
    // Log analytics event
    analytics.skill.install(skillId, userId);
  } catch (err) {
    console.error(`[analytics] Failed to log skill.install for ${skillId}:`, err);
  }
}
