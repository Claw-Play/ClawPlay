import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills, skillVersions } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { analytics, incrementSkillStat } from "@/lib/analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  const skill = await db.query.skills.findFirst({
    where: and(
      eq(skills.slug, slug),
      isNull(skills.deletedAt)
    ),
  });

  if (!skill) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  // Fire-and-forget: record view + increment view counter
  analytics.skill.view(skill.id, slug);
  void incrementSkillStat(skill.id, "statsViews");

  // Get latest version content
  let latestVersion = null;
  if (skill.latestVersionId) {
    latestVersion = await db.query.skillVersions.findFirst({
      where: eq(skillVersions.id, skill.latestVersionId),
    });
  }

  return NextResponse.json({
    skill: {
      ...skill,
      parsedMetadata: latestVersion
        ? JSON.parse(latestVersion.parsedMetadata)
        : {},
      content: latestVersion?.content ?? "",
      version: latestVersion?.version ?? "",
    },
  });
}
