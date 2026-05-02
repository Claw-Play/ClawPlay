import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skills, skillRatings } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getT } from "@/lib/i18n";
import { averageRating } from "@/lib/ratings";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const t = await getT("errors");
  const { slug } = params;

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: t("invalid_slug") }, { status: 400 });
  }

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.slug, slug), isNull(skills.deletedAt)),
  });

  if (!skill) {
    return NextResponse.json({ error: t("skill_not_found") }, { status: 404 });
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
    averageRating: averageRating(skill.statsStars, skill.statsRatingsCount),
    reviews: publicReviews,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  const { slug } = params;

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: t("invalid_slug") }, { status: 400 });
  }

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.slug, slug), isNull(skills.deletedAt)),
  });

  if (!skill) {
    return NextResponse.json({ error: t("skill_not_found") }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { rating, comment } = body as {
      rating?: number;
      comment?: string;
    };

    const validatedRating = Number(rating);

    if (!Number.isInteger(validatedRating) || validatedRating < 1 || validatedRating > 5) {
      return NextResponse.json(
        { error: t("rating_invalid") },
        { status: 400 }
      );
    }

    const { total, count } = db.transaction((tx) => {
      const existing = tx
        .select({ id: skillRatings.id })
        .from(skillRatings)
        .where(and(
          eq(skillRatings.skillId, skill.id),
          eq(skillRatings.userId, auth.userId)
        ))
        .get();

      if (existing) {
        tx
          .update(skillRatings)
          .set({ rating: validatedRating, comment: comment?.trim() ?? "", createdAt: new Date() })
          .where(eq(skillRatings.id, existing.id))
          .run();
      } else {
        tx.insert(skillRatings).values({
          skillId: skill.id,
          userId: auth.userId,
          rating: validatedRating,
          comment: comment?.trim() ?? "",
        }).run();
      }

      const agg = tx
        .select({
          total: sql<number>`sum(${skillRatings.rating})`,
          count: sql<number>`count(*)`,
        })
        .from(skillRatings)
        .where(eq(skillRatings.skillId, skill.id))
        .all();

      const total = Number(agg[0]?.total ?? 0);
      const count = Number(agg[0]?.count ?? 0);

      tx
        .update(skills)
        .set({ statsStars: total, statsRatingsCount: count })
        .where(eq(skills.id, skill.id))
        .run();

      return { total, count };
    });

    void (async () => {
      const { analytics } = await import("@/lib/analytics");
      analytics.skill.review(skill.id, auth.userId, validatedRating);
    })();

    return NextResponse.json(
      {
        message: t("review_submitted"),
        averageRating: averageRating(total, count),
        count,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/skills/reviews POST]", err);
    return NextResponse.json(
      { error: t("internal_error") },
      { status: 500 }
    );
  }
}
