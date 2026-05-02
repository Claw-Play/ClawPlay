import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skillVersions, skills } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { analytics } from "@/lib/analytics";
import { getT } from "@/lib/i18n";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  if (auth.role !== "admin" && auth.role !== "reviewer") {
    return NextResponse.json({ error: t("forbidden") }, { status: 403 });
  }

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.id, params.id), isNull(skills.deletedAt)),
  });

  if (!skill) {
    return NextResponse.json({ error: t("skill_not_found") }, { status: 404 });
  }

  const latestVersion = await db
    .select({
      content: skillVersions.content,
      workflowMd: skillVersions.workflowMd,
      parsedMetadata: skillVersions.parsedMetadata,
      createdAt: skillVersions.createdAt,
    })
    .from(skillVersions)
    .where(eq(skillVersions.skillId, skill.id))
    .orderBy(desc(skillVersions.createdAt))
    .limit(1);

  const version = latestVersion[0] ?? null;

  return NextResponse.json({
    skill: {
      ...skill,
      createdAt: skill.createdAt?.toISOString?.() ?? null,
      updatedAt: skill.updatedAt?.toISOString?.() ?? null,
      skillMdContent: version?.content ?? null,
      workflowMd: version?.workflowMd ?? null,
      parsedMetadata: version?.parsedMetadata ?? "{}",
      latestVersionCreatedAt: version?.createdAt?.toISOString?.() ?? null,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  if (auth.role !== "admin" && auth.role !== "reviewer") {
    return NextResponse.json({ error: t("forbidden") }, { status: 403 });
  }

  const { id } = params;
  const body = await request.json();
  const { action, reason } = body as {
    action?: "approve" | "reject" | "feature" | "unfeature";
    reason?: string;
  };

  if (!action || !["approve", "reject", "feature", "unfeature"].includes(action)) {
    return NextResponse.json(
      { error: t("action_invalid") },
      { status: 400 }
    );
  }

  if (action === "feature" || action === "unfeature") {
    await db
      .update(skills)
      .set({ isFeatured: action === "feature" ? 1 : 0, updatedAt: new Date() })
      .where(and(eq(skills.id, id), isNull(skills.deletedAt)));
    if (action === "feature") {
      analytics.skill.feature(id, auth.userId);
    } else {
      analytics.skill.unfeature(id, auth.userId);
    }
    return NextResponse.json({
      message: action === "feature" ? t("skill_featured") : t("skill_unfeatured"),
    });
  }

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.id, id), isNull(skills.deletedAt)),
  });

  if (!skill) {
    return NextResponse.json({ error: t("skill_not_found") }, { status: 404 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  await db
    .update(skills)
    .set({
      moderationStatus: newStatus,
      moderationReason: reason ?? "",
      updatedAt: new Date(),
    })
    .where(and(eq(skills.id, id), isNull(skills.deletedAt)));

  if (action === "approve") {
    analytics.skill.approve(id, auth.userId);
  } else {
    analytics.skill.reject(id, auth.userId, reason ?? "");
  }

  return NextResponse.json({
    skill: { ...skill, moderationStatus: newStatus },
    message:
      action === "approve"
        ? t("skill_approved")
        : t("skill_rejected"),
  });
}
