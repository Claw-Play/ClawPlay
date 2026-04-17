import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skills, skillVersions } from "@/lib/db/schema";
import { eq, and, isNull, desc, asc } from "drizzle-orm";
import { getT } from "@/lib/i18n";

export async function GET() {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  if (auth.role !== "admin" && auth.role !== "reviewer") {
    return NextResponse.json({ error: t("forbidden") }, { status: 403 });
  }

  const pendingSkills = await db.query.skills.findMany({
    where: and(
      eq(skills.moderationStatus, "pending"),
      isNull(skills.deletedAt)
    ),
    orderBy: [asc(skills.createdAt)],
  });

  // Attach latest version content to each skill
  const skillsWithContent = await Promise.all(
    pendingSkills.map(async (skill) => {
      const latestVersion = await db
        .select({ content: skillVersions.content, workflowMd: skillVersions.workflowMd })
        .from(skillVersions)
        .where(eq(skillVersions.skillId, skill.id))
        .orderBy(desc(skillVersions.createdAt))
        .limit(1);
      return {
        ...skill,
        skillMdContent: latestVersion[0]?.content ?? null,
        workflowMd: latestVersion[0]?.workflowMd ?? null,
      };
    })
  );

  return NextResponse.json({ skills: skillsWithContent });
}
