import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skills, skillVersions } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getT } from "@/lib/i18n";

type RouteParams = { params: { slug: string; version: string } };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const t = await getT("errors");
  const { slug, version } = params;

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.slug, slug), isNull(skills.deletedAt)),
  });

  if (!skill) {
    return NextResponse.json({ error: t("skill_not_found") }, { status: 404 });
  }

  const [versionRecord] = await db
    .select()
    .from(skillVersions)
    .where(
      and(
        eq(skillVersions.skillId, skill.id),
        eq(skillVersions.version, version)
      )
    )
    .limit(1);

  if (!versionRecord) {
    return NextResponse.json(
      { error: t("version_not_found") },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: versionRecord.id,
    skillId: versionRecord.skillId,
    version: versionRecord.version,
    changelog: versionRecord.changelog,
    content: versionRecord.content,
    parsedMetadata: versionRecord.parsedMetadata
      ? JSON.parse(versionRecord.parsedMetadata)
      : {},
    authorId: versionRecord.authorId,
    moderationStatus: versionRecord.moderationStatus,
    moderationFlags: versionRecord.moderationFlags
      ? JSON.parse(versionRecord.moderationFlags)
      : [],
    deprecatedAt: versionRecord.deprecatedAt,
    createdAt: versionRecord.createdAt,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  const { slug, version } = params;

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.slug, slug), isNull(skills.deletedAt)),
  });

  if (!skill) {
    return NextResponse.json({ error: t("skill_not_found") }, { status: 404 });
  }

  const [versionRecord] = await db
    .select()
    .from(skillVersions)
    .where(
      and(
        eq(skillVersions.skillId, skill.id),
        eq(skillVersions.version, version)
      )
    )
    .limit(1);

  if (!versionRecord) {
    return NextResponse.json(
      { error: t("version_not_found") },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { action } = body as { action?: string };

  const isAdmin =
    auth.role === "admin" || auth.role === "reviewer";
  const isAuthor = skill.authorId === auth.userId;

  switch (action) {
    case "deprecate": {
      if (!isAuthor && !isAdmin) {
        return NextResponse.json(
          { error: t("only_author_or_admin_can_deprecate") },
          { status: 403 }
        );
      }
      await db
        .update(skillVersions)
        .set({ deprecatedAt: new Date() })
        .where(eq(skillVersions.id, versionRecord.id));
      return NextResponse.json({ message: t("version_deprecated") });
    }

    case "undeprecate": {
      if (!isAuthor && !isAdmin) {
        return NextResponse.json(
          { error: t("only_author_or_admin_can_restore") },
          { status: 403 }
        );
      }
      await db
        .update(skillVersions)
        .set({ deprecatedAt: null })
        .where(eq(skillVersions.id, versionRecord.id));
      return NextResponse.json({ message: t("version_restored") });
    }

    case "set-latest": {
      if (!isAdmin) {
        return NextResponse.json(
          { error: t("only_admin_can_set_latest") },
          { status: 403 }
        );
      }
      await db
        .update(skills)
        .set({ latestVersionId: versionRecord.id, updatedAt: new Date() })
        .where(eq(skills.id, skill.id));
      return NextResponse.json({ message: t("latest_version_updated") });
    }

    default:
      return NextResponse.json(
        { error: t("invalid_action") },
        { status: 400 }
      );
  }
}
