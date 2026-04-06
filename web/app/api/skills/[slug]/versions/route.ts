import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills, skillVersions } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.slug, slug), isNull(skills.deletedAt)),
  });

  if (!skill) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  const versions = await db
    .select({
      id: skillVersions.id,
      version: skillVersions.version,
      changelog: skillVersions.changelog,
      createdAt: skillVersions.createdAt,
    })
    .from(skillVersions)
    .where(eq(skillVersions.skillId, skill.id))
    .orderBy(desc(skillVersions.createdAt));

  return NextResponse.json({ versions });
}
