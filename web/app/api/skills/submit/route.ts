import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skills, skillVersions, userIdentities, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import matter from "gray-matter";
import { scanSkillContent } from "@/lib/skill-security-scan";
import { llmSafetyReview } from "@/lib/skill-llm-safety";
import { analytics } from "@/lib/analytics";
import { getPublicOrigin } from "@/lib/request-origin";
import { sendSkillSubmissionReviewEmail } from "@/lib/review-notifications";
import { getT } from "@/lib/i18n";

export const runtime = "nodejs";

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

function isUniqueConstraintError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("UNIQUE constraint failed") ||
    err.message.includes("SQLITE_CONSTRAINT_UNIQUE")
  );
}

export async function POST(request: NextRequest) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      slug: providedSlug,
      summary,
      repoUrl,
      iconEmoji,
      skillMdContent,
      workflowMd,
    } = body as {
      name?: string;
      slug?: string;
      summary?: string;
      repoUrl?: string;
      iconEmoji?: string;
      skillMdContent?: string;
      workflowMd?: string;
    };

    if (!name?.trim() || !skillMdContent?.trim()) {
      return NextResponse.json(
        { error: t("name_required") },
        { status: 400 }
      );
    }

    if (!workflowMd?.trim()) {
      return NextResponse.json(
        { error: t("workflow_required") },
        { status: 400 }
      );
    }

    // ── 1. 静态安全扫描 ─────────────────────────────────────────────────────
    const scan = scanSkillContent(skillMdContent);
    if (!scan.safe) {
      const errorFlags = scan.flags
        .filter((f) => f.severity === "error")
        .map((f) => `[${f.code}] ${f.description}`);
      return NextResponse.json(
        {
          error: t("security_scan_failed"),
          details: errorFlags,
        },
        { status: 400 }
      );
    }

    // ── 2. LLM 安全预审（可选，优雅降级）───────────────────────────────────
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
            {
              error: t("safety_review_failed"),
              reason: review.reason,
            },
            { status: 400 }
          );
        }
      }
    } catch {
      // LLM 未配置或调用失败 — 跳过，不阻断提交
    }

    // ── 3. 合并 moderationFlags ─────────────────────────────────────────────
    const allFlags = [
      ...scan.flags
        .filter((f) => f.severity === "warning")
        .map((f) => ({ code: f.code, description: f.description })),
      ...llmFlags.map((f) => ({ code: `LLM_${f.code}`, description: f.description })),
    ];

    // ── 4. 解析 author info ─────────────────────────────────────────────────
    const user = await db.query.users.findFirst({
      where: eq(users.id, auth.userId),
    });
    const emailIdentity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.userId, auth.userId),
        eq(userIdentities.provider, "email")
      ),
    });
    const authorName = user?.name || "";
    const authorEmail = emailIdentity?.providerAccountId ?? "";

    const normalizedName = name.trim();
    const normalizedSummary = summary?.trim() ?? "";
    const normalizedRepoUrl = repoUrl?.trim() ?? "";

    // ── 5. 生成 slug ────────────────────────────────────────────────────────
    let slug = slugify(providedSlug?.trim() || "");
    if (!slug) {
      slug = slugify(normalizedName);
    }
    if (!slug) {
      return NextResponse.json({ error: t("invalid_slug") }, { status: 400 });
    }

    // ── 6. 解析 SKILL.md frontmatter ────────────────────────────────────────
    let parsedMetadata: Record<string, unknown> = {};
    try {
      const { data } = matter(skillMdContent);
      parsedMetadata = data as Record<string, unknown>;
    } catch {
      // Graceful degradation — store as-is
    }

    const version = "1.0.0";

    let skillId = "";
    let versionId = "";
    const maxSlugAttempts = 5;

    for (let attempt = 0; attempt < maxSlugAttempts; attempt++) {
      const candidateSlug = attempt === 0 ? slug : `${slug}-${genId().slice(0, 6)}`;
      skillId = genId();
      versionId = genId();

      try {
        // ── 7. 写 DB ────────────────────────────────────────────────────────
        await db.transaction((tx) => {
          tx.insert(skills).values({
            id: skillId,
            slug: candidateSlug,
            name: normalizedName,
            summary: normalizedSummary,
            authorName: authorName ?? "",
            authorEmail: authorEmail ?? "",
            authorId: auth.userId,
            repoUrl: normalizedRepoUrl,
            iconEmoji: iconEmoji ?? "🦐",
            moderationStatus: "pending",
            moderationReason: "",
            moderationFlags: JSON.stringify(allFlags),
            latestVersionId: versionId,
            statsStars: 0,
            statsRatingsCount: 0,
            isFeatured: 0,
          }).run();

          tx.insert(skillVersions).values({
            id: versionId,
            skillId,
            version,
            changelog: "Initial submission.",
            content: skillMdContent,
            parsedMetadata: JSON.stringify(parsedMetadata),
            workflowMd: workflowMd ?? "",
            authorId: auth.userId,
            moderationStatus: "pending",
            moderationFlags: JSON.stringify([]),
          }).run();
        });

        slug = candidateSlug;
        break;
      } catch (err) {
        if (isUniqueConstraintError(err) && attempt < maxSlugAttempts - 1) {
          continue;
        }
        throw err;
      }
    }

    analytics.skill.submit(skillId, "pending");

    const publicOrigin = getPublicOrigin(request);
    const reviewUrl = new URL(`/admin/review/${skillId}`, publicOrigin).toString();
    void sendSkillSubmissionReviewEmail({
      skillId,
      skillName: normalizedName,
      slug,
      summary: normalizedSummary,
      repoUrl: normalizedRepoUrl,
      authorName: authorName || "Unknown author",
      authorEmail: authorEmail || "",
      reviewFlags: allFlags,
      reviewUrl,
      submittedAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        skill: { id: skillId, slug, name: normalizedName, version },
        message: t("skill_submitted"),
        reviewFlags: allFlags.length > 0 ? allFlags : undefined,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/skills/submit]", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such column/i.test(msg) || /has no column/i.test(msg)) {
      return NextResponse.json(
        { error: "Database schema out of date. Please run migrations." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: t("internal_error") },
      { status: 500 }
    );
  }
}
