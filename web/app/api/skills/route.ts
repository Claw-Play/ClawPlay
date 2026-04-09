import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { analytics } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const emoji = searchParams.get("emoji");
  const sort = searchParams.get("sort") ?? "newest";

  try {
    const query = db
      .select({
        id: skills.id,
        slug: skills.slug,
        name: skills.name,
        summary: skills.summary,
        authorName: skills.authorName,
        iconEmoji: skills.iconEmoji,
        moderationStatus: skills.moderationStatus,
        latestVersionId: skills.latestVersionId,
        statsStars: skills.statsStars,
        createdAt: skills.createdAt,
      })
      .from(skills)
      .where(
        and(
          eq(skills.moderationStatus, "approved"),
          isNull(skills.deletedAt)
        )
      );

    let results = await query;

    // Filter by emoji (client-side as it's not indexed for now)
    if (emoji) {
      results = results.filter((s) => s.iconEmoji === emoji);
    }

    // Sort
    if (sort === "newest") {
      results.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    } else if (sort === "stars") {
      results.sort((a, b) => (b.statsStars ?? 0) - (a.statsStars ?? 0));
    }

    // Track skill browse/search when filters are applied
    if (emoji || sort !== "newest") {
      analytics.skill.search(emoji ?? "", { sort }, results.length);
    }

    return NextResponse.json({ skills: results });
  } catch (err) {
    console.error("[api/skills GET]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
