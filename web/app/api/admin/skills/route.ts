import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skills, skillVersions } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

export async function GET() {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const pendingSkills = await db.query.skills.findMany({
    where: and(
      eq(skills.moderationStatus, "pending"),
      isNull(skills.deletedAt)
    ),
    orderBy: (skills, { asc }) => [asc(skills.createdAt)],
  });

  // Attach latest version content to each skill
  const skillsWithContent = await Promise.all(
    pendingSkills.map(async (skill) => {
      const latestVersion = await db
        .select({ content: skillVersions.content })
        .from(skillVersions)
        .where(eq(skillVersions.skillId, skill.id))
        .orderBy(desc(skillVersions.createdAt))
        .limit(1);
      return {
        ...skill,
        skillMdContent: latestVersion[0]?.content ?? null,
      };
    })
  );

  return NextResponse.json({ skills: skillsWithContent });
}
