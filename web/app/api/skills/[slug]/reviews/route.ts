import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skills, skillRatings } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
  }

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.slug, slug), isNull(skills.deletedAt)),
  });

  if (!skill) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  const reviews = await db
    .select({
      id: skillRatings.id,
      userId: skillRatings.userId,
      rating: skillRatings.rating,
      comment: skillRatings.comment,
      createdAt: skillRatings.createdAt,
    })
    .from(skillRatings)
    .where(eq(skillRatings.skillId, skill.id))
    .orderBy(sql`${skillRatings.createdAt} DESC`);

  // Hide userId from public response (only show in admin view)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const publicReviews = reviews.map(({ userId: _u, ...r }) => r);

  return NextResponse.json({
    skillId: skill.id,
    statsStars: skill.statsStars,
    statsRatingsCount: skill.statsRatingsCount,
    averageRating:
      skill.statsRatingsCount > 0
        ? Number((skill.statsStars / skill.statsRatingsCount).toFixed(1))
        : null,
    reviews: publicReviews,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { slug } = params;

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
  }

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.slug, slug), isNull(skills.deletedAt)),
  });

  if (!skill) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { rating, comment } = body as {
      rating?: number;
      comment?: string;
    };

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "rating must be an integer between 1 and 5." },
        { status: 400 }
      );
    }

    // Check existing rating
    const existing = await db.query.skillRatings.findFirst({
      where: and(
        eq(skillRatings.skillId, skill.id),
        eq(skillRatings.userId, auth.userId)
      ),
    });

    if (existing) {
      // Update existing rating
      await db
        .update(skillRatings)
        .set({ rating, comment: comment?.trim() ?? "", createdAt: new Date() })
        .where(eq(skillRatings.id, existing.id));
    } else {
      // Insert new rating
      await db.insert(skillRatings).values({
        skillId: skill.id,
        userId: auth.userId,
        rating,
        comment: comment?.trim() ?? "",
      });
    }

    // Recompute aggregate stats from all ratings for this skill
    const agg = await db
      .select({
        total: sql<number>`sum(${skillRatings.rating})`,
        count: sql<number>`count(*)`,
      })
      .from(skillRatings)
      .where(eq(skillRatings.skillId, skill.id));

    const total = Number(agg[0]?.total ?? 0);
    const count = Number(agg[0]?.count ?? 0);

    await db
      .update(skills)
      .set({ statsStars: total, statsRatingsCount: count })
      .where(eq(skills.id, skill.id));

    void (async () => {
      const { analytics } = await import("@/lib/analytics");
      analytics.skill.review(skill.id, auth.userId, rating);
    })();

    return NextResponse.json(
      {
        message: "Review submitted.",
        averageRating: count > 0 ? Number((total / count).toFixed(1)) : null,
        count,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/skills/reviews POST]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
