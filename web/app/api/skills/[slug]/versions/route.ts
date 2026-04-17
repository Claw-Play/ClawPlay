import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skills, skillVersions } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import matter from "gray-matter";
import { scanSkillContent } from "@/lib/skill-security-scan";
import { llmSafetyReview } from "@/lib/skill-llm-safety";
import { analytics } from "@/lib/analytics";
import { getT } from "@/lib/i18n";

// Strict semver 2.0 regex
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const t = await getT("errors");
  const { slug } = params;

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.slug, slug), isNull(skills.deletedAt)),
  });

  if (!skill) {
    return NextResponse.json({ error: t("skill_not_found") }, { status: 404 });
  }

  const versions = await db
    .select({
      id: skillVersions.id,
      version: skillVersions.version,
      changelog: skillVersions.changelog,
      authorId: skillVersions.authorId,
      moderationStatus: skillVersions.moderationStatus,
      moderationFlags: skillVersions.moderationFlags,
      deprecatedAt: skillVersions.deprecatedAt,
      createdAt: skillVersions.createdAt,
    })
    .from(skillVersions)
    .where(eq(skillVersions.skillId, skill.id))
    .orderBy(skillVersions.createdAt);

  return NextResponse.json({ versions });
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

  // Load skill
  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.slug, slug), isNull(skills.deletedAt)),
  });

  if (!skill) {
    return NextResponse.json({ error: t("skill_not_found") }, { status: 404 });
  }

  // Authorization: author or admin/reviewer
  const isAdmin =
    auth.role === "admin" || auth.role === "reviewer";
  const isAuthor = skill.authorId === auth.userId;
  if (!isAuthor && !isAdmin) {
    return NextResponse.json(
      { error: t("only_author_can_submit_version") },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { version, changelog, skillMdContent } = body as {
      version?: string;
      changelog?: string;
      skillMdContent?: string;
    };

    if (!version || !skillMdContent) {
      return NextResponse.json(
        { error: t("version_required") },
        { status: 400 }
      );
    }

    if (changelog && changelog.length > 1000) {
      return NextResponse.json(
        { error: t("changelog_too_long") },
        { status: 400 }
      );
    }

    // Semver validation
    if (!SEMVER_RE.test(version.trim())) {
      return NextResponse.json(
        { error: t("invalid_semver") },
        { status: 400 }
      );
    }

    // ── 1. Security scan ─────────────────────────────────────────────────────
    const scan = scanSkillContent(skillMdContent);
    if (!scan.safe) {
      const errorFlags = scan.flags
        .filter((f) => f.severity === "error")
        .map((f) => `[${f.code}] ${f.description}`);
      return NextResponse.json(
        { error: t("security_scan_failed"), details: errorFlags },
        { status: 400 }
      );
    }

    // ── 2. LLM safety review ───────────────────────────────────────────────────
    let llmFlags: Array<{ code: string; description: string }> = [];
    try {
      const { getLLMProvider } = await import("@/lib/providers/llm");
      const provider = getLLMProvider();
      const review = await llmSafetyReview(skillMdContent, async (req) => {
        const result = await provider.generate({
          prompt: req.prompt,
          system: req.system,
          maxTokens: req.maxTokens,
          temperature: req.temperature,
        });
        return { text: result.text };
      });
      if (review) {
        llmFlags = review.flags;
        if (review.verdict === "UNSAFE") {
          return NextResponse.json(
            { error: t("safety_review_failed"), reason: review.reason },
            { status: 400 }
          );
        }
      }
    } catch {
      // LLM not configured — skip
    }

    // Merge flags
    const allFlags = [
      ...scan.flags
        .filter((f) => f.severity === "warning")
        .map((f) => ({ code: f.code, description: f.description })),
      ...llmFlags.map((f) => ({ code: `LLM_${f.code}`, description: f.description })),
    ];

    // ── 3. Parse frontmatter ─────────────────────────────────────────────────
    let parsedMetadata: Record<string, unknown> = {};
    try {
      const { data } = matter(skillMdContent);
      parsedMetadata = data as Record<string, unknown>;
    } catch {
      // Graceful degradation
    }

    // ── 4. Moderation routing ────────────────────────────────────────────────
    // Auto-approve if the skill is already approved; otherwise hold for review
    const versionModerationStatus =
      skill.moderationStatus === "approved" ? "approved" : "pending";

    const versionId = genId();

    // ── 5. DB write ──────────────────────────────────────────────────────────
    await db.insert(skillVersions).values({
      id: versionId,
      skillId: skill.id,
      version: version.trim(),
      changelog: changelog?.trim() ?? "",
      content: skillMdContent,
      parsedMetadata: JSON.stringify(parsedMetadata),
      authorId: auth.userId,
      moderationStatus: versionModerationStatus,
      moderationFlags: JSON.stringify(allFlags),
    });

    // Update latestVersionId if auto-approved
    if (versionModerationStatus === "approved") {
      await db
        .update(skills)
        .set({ latestVersionId: versionId, updatedAt: new Date() })
        .where(eq(skills.id, skill.id));
    }

    analytics.skill.version_submit(skill.id, slug, version.trim());

    return NextResponse.json(
      {
        versionId,
        version: version.trim(),
        moderationStatus: versionModerationStatus,
        reviewFlags: allFlags.length > 0 ? allFlags : undefined,
        message:
          versionModerationStatus === "approved"
            ? t("version_published")
            : t("version_pending_review"),
      },
      { status: 201 }
    );
  } catch (err) {
    // Handle unique constraint violation (duplicate version)
    if (
      err instanceof Error &&
      err.message.includes("UNIQUE constraint failed")
    ) {
      return NextResponse.json(
        { error: t("version_exists") },
        { status: 409 }
      );
    }
    console.error("[api/skills/[slug]/versions POST]", err);
    return NextResponse.json(
      { error: t("internal_error") },
      { status: 500 }
    );
  }
}
