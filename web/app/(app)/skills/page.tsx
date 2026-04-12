import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { SkillsClient } from "./SkillsClient";

export const metadata = {
  title: "技能库 — ClawPlay",
  description: "浏览和发现 X Claw 社交与娱乐技能。",
};

export default async function SkillsPage() {
  let allSkills: {
    slug: string;
    name: string;
    summary: string | null;
    authorName: string | null;
    iconEmoji: string | null;
    statsStars: number | null;
    statsRatingsCount: number | null;
    createdAt: Date | null;
  }[] = [];

  try {
    allSkills = await db
      .select({
        slug: skills.slug,
        name: skills.name,
        summary: skills.summary,
        authorName: skills.authorName,
        iconEmoji: skills.iconEmoji,
        statsStars: skills.statsStars,
        statsRatingsCount: skills.statsRatingsCount,
        createdAt: skills.createdAt,
      })
      .from(skills)
      .where(and(eq(skills.moderationStatus, "approved"), isNull(skills.deletedAt)))
      .orderBy(desc(skills.createdAt));
  } catch {
    // DB not ready
  }

  return <SkillsClient initialSkills={allSkills} />;
}
