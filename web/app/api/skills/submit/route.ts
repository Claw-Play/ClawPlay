import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skills, skillVersions, userIdentities, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import matter from "gray-matter";

// Generate a slug from name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      summary,
      repoUrl,
      iconEmoji,
      skillMdContent,
    } = body as {
      name?: string;
      summary?: string;
      repoUrl?: string;
      iconEmoji?: string;
      skillMdContent?: string;
    };

    if (!name || !skillMdContent) {
      return NextResponse.json(
        { error: "name and skillMdContent are required." },
        { status: 400 }
      );
    }

    // Resolve author info from user record + email identity (if any)
    const user = await db.query.users.findFirst({ where: eq(users.id, auth.userId) });
    const emailIdentity = await db.query.userIdentities.findFirst({
      where: and(eq(userIdentities.userId, auth.userId), eq(userIdentities.provider, "email")),
    });
    const authorName = user?.name || "";
    const authorEmail = emailIdentity?.providerAccountId ?? "";

    // Generate unique slug
    let slug = slugify(name);
    const existing = await db.query.skills.findFirst({
      where: eq(skills.slug, slug),
    });
    if (existing) {
      slug = `${slug}-${genId().slice(0, 6)}`;
    }

    // Parse SKILL.md frontmatter
    let parsedMetadata: Record<string, unknown> = {};
    try {
      const { data } = matter(skillMdContent);
      parsedMetadata = data as Record<string, unknown>;
    } catch {
      // Graceful degradation — store as-is
    }

    const skillId = genId();
    const versionId = genId();
    const version = "1.0.0";

    // Create skill
    await db.insert(skills).values({
      id: skillId,
      slug,
      name: name.trim(),
      summary: summary?.trim() ?? "",
      authorName: authorName ?? "",
      authorEmail: authorEmail ?? "",
      repoUrl: repoUrl?.trim() ?? "",
      iconEmoji: iconEmoji ?? "🦐",
      moderationStatus: "pending",
      moderationReason: "",
      moderationFlags: "[]",
      latestVersionId: versionId,
      statsStars: 0,
    });

    // Create first version
    await db.insert(skillVersions).values({
      id: versionId,
      skillId,
      version,
      changelog: "Initial submission.",
      content: skillMdContent,
      parsedMetadata: JSON.stringify(parsedMetadata),
    });

    return NextResponse.json(
      {
        skill: { id: skillId, slug, name, version },
        message: "Skill submitted. Pending review.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/skills/submit]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
