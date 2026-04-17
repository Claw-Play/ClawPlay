import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skills, skillVersions } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function GET(_request: NextRequest) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userSkills = await db
    .select({
      id: skills.id,
      slug: skills.slug,
      name: skills.name,
      summary: skills.summary,
      iconEmoji: skills.iconEmoji,
      moderationStatus: skills.moderationStatus,
      latestVersionId: skills.latestVersionId,
      createdAt: skills.createdAt,
      updatedAt: skills.updatedAt,
    })
    .from(skills)
    .where(eq(skills.authorId, auth.userId));

  if (userSkills.length === 0) {
    return NextResponse.json({ skills: [] });
  }

  // Fetch latest version info for each skill
  const skillIds = userSkills.map((s) => s.id);

  const versions = await db
    .select({
      id: skillVersions.id,
      skillId: skillVersions.skillId,
      version: skillVersions.version,
      changelog: skillVersions.changelog,
      moderationStatus: skillVersions.moderationStatus,
      deprecatedAt: skillVersions.deprecatedAt,
      createdAt: skillVersions.createdAt,
    })
    .from(skillVersions)
    .where(inArray(skillVersions.skillId, skillIds));

  // Map latest version by skillId
  const latestBySkillId = new Map<string, (typeof versions)[0]>();
  for (const v of versions) {
    const existing = latestBySkillId.get(v.skillId);
    if (!existing || v.createdAt > existing.createdAt) {
      latestBySkillId.set(v.skillId, v);
    }
  }

  const result = userSkills.map((skill) => ({
    ...skill,
    latestVersion: latestBySkillId.get(skill.id) ?? null,
  }));

  return NextResponse.json({ skills: result });
}
