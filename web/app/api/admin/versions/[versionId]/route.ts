import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skills, skillVersions } from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { analytics } from "@/lib/analytics";
import { getT } from "@/lib/i18n";

export async function GET(request: NextRequest) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }
  if (auth.role !== "admin" && auth.role !== "reviewer") {
    return NextResponse.json({ error: t("forbidden") }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "pending";

  const query = db
    .select({
      id: skillVersions.id,
      skillId: skillVersions.skillId,
      version: skillVersions.version,
      changelog: skillVersions.changelog,
      moderationStatus: skillVersions.moderationStatus,
      authorId: skillVersions.authorId,
      createdAt: skillVersions.createdAt,
    })
    .from(skillVersions)
    .innerJoin(skills, eq(skillVersions.skillId, skills.id))
    .where(isNull(skills.deletedAt))
    .orderBy(skillVersions.createdAt);

  const results = await query;

  const filtered =
    filter === "all"
      ? results
      : results.filter((v) => v.moderationStatus === filter);

  return NextResponse.json({ versions: filtered });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { versionId: string } }
) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }
  if (auth.role !== "admin" && auth.role !== "reviewer") {
    return NextResponse.json({ error: t("forbidden") }, { status: 403 });
  }

  const { versionId } = params;

  const [versionRecord] = await db
    .select()
    .from(skillVersions)
    .where(eq(skillVersions.id, versionId))
    .limit(1);

  if (!versionRecord) {
    return NextResponse.json(
      { error: t("version_not_found") },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { action, reason } = body as {
    action?: "approve" | "reject";
    reason?: string;
  };

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: t("action_approve_reject_invalid") },
      { status: 400 }
    );
  }

  if (action === "reject" && !reason) {
    return NextResponse.json(
      { error: t("reason_required_for_rejection") },
      { status: 400 }
    );
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  // Store rejection reason in moderationFlags JSON
  if (action === "reject") {
    const existingFlags = versionRecord.moderationFlags
      ? JSON.parse(versionRecord.moderationFlags)
      : [];
    existingFlags.push({
      code: "REJECTED",
      description: reason,
      rejectedBy: auth.userId,
      rejectedAt: new Date().toISOString(),
    });
    await db
      .update(skillVersions)
      .set({
        moderationStatus: newStatus,
        moderationFlags: JSON.stringify(existingFlags),
      })
      .where(eq(skillVersions.id, versionId));
  } else {
    await db
      .update(skillVersions)
      .set({ moderationStatus: newStatus })
      .where(eq(skillVersions.id, versionId));
  }

  // If approved, update latestVersionId
  if (action === "approve") {
    await db
      .update(skills)
      .set({ latestVersionId: versionId, updatedAt: new Date() })
      .where(eq(skills.id, versionRecord.skillId));
    analytics.skill.version_approve(
      versionRecord.skillId,
      versionId,
      auth.userId
    );
  } else {
    analytics.skill.version_reject(
      versionRecord.skillId,
      versionId,
      auth.userId,
      reason ?? ""
    );
  }

  return NextResponse.json({
    message:
      action === "approve"
        ? t("version_approved")
        : t("version_rejected"),
  });
}
