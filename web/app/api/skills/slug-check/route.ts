import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { getT } from "@/lib/i18n";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function genSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function POST(request: NextRequest) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name } = body as { name?: string };
    const normalizedName = name?.trim() ?? "";

    if (!normalizedName) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const slug = slugify(normalizedName);
    if (!slug) {
      return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    }

    const existing = await db.query.skills.findFirst({
      where: eq(skills.slug, slug),
    });

    return NextResponse.json({
      slug,
      exists: Boolean(existing),
      suggestedSlug: existing ? `${slug}-${genSuffix()}` : slug,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
