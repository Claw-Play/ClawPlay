import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { SkillsClient } from "./SkillsClient";

export const dynamic = "force-dynamic";

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const sort = typeof searchParams.sort === "string" ? searchParams.sort : "";

  let allSkills: {
    slug: string;
    name: string;
    summary: string | null;
    authorName: string | null;
    iconEmoji: string | null;
    statsStars: number | null;
    statsRatingsCount: number | null;
    createdAt: Date | null;
    statsInstalls: number | null;
  }[] = [];

  try {
    const base = db
      .select({
        slug: skills.slug,
        name: skills.name,
        summary: skills.summary,
        authorName: skills.authorName,
        iconEmoji: skills.iconEmoji,
        statsStars: skills.statsStars,
        statsRatingsCount: skills.statsRatingsCount,
        statsInstalls: skills.statsInstalls,
        createdAt: skills.createdAt,
      })
      .from(skills)
      .where(and(eq(skills.moderationStatus, "approved"), isNull(skills.deletedAt)));

    const ordered =
      sort === "new"
        ? base.orderBy(desc(skills.createdAt))
        : sort === "trending"
        ? base.orderBy(desc(skills.statsInstalls))
        : base.orderBy(desc(skills.isFeatured), desc(skills.statsInstalls), desc(skills.createdAt));

    allSkills = await ordered;
  } catch {
    // DB not ready
  }

  return <SkillsClient initialSkills={allSkills} initialSort={sort} />;
}
