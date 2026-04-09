import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skills, skillVersions, userIdentities, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import matter from "gray-matter";
import { scanSkillContent } from "@/lib/skill-security-scan";
import { llmSafetyReview } from "@/lib/skill-llm-safety";
import { analytics } from "@/lib/analytics";

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

    // ── 1. 静态安全扫描 ─────────────────────────────────────────────────────
    const scan = scanSkillContent(skillMdContent);
    if (!scan.safe) {
      const errorFlags = scan.flags
        .filter((f) => f.severity === "error")
        .map((f) => `[${f.code}] ${f.description}`);
      return NextResponse.json(
        {
          error: "Security scan failed.",
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
              error: "LLM safety review flagged this content.",
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

    // ── 5. 生成 slug ────────────────────────────────────────────────────────
    let slug = slugify(name);
    const existing = await db.query.skills.findFirst({
      where: eq(skills.slug, slug),
    });
    if (existing) {
      slug = `${slug}-${genId().slice(0, 6)}`;
    }

    // ── 6. 解析 SKILL.md frontmatter ────────────────────────────────────────
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

    // ── 7. 写 DB ────────────────────────────────────────────────────────────
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
      moderationFlags: JSON.stringify(allFlags),
      latestVersionId: versionId,
      statsStars: 0,
      statsRatingsCount: 0,
      isFeatured: 0,
    });

    await db.insert(skillVersions).values({
      id: versionId,
      skillId,
      version,
      changelog: "Initial submission.",
      content: skillMdContent,
      parsedMetadata: JSON.stringify(parsedMetadata),
    });

    analytics.skill.submit(skillId, "pending");

    return NextResponse.json(
      {
        skill: { id: skillId, slug, name, version },
        message:
          allFlags.length > 0
            ? "Skill submitted. Pending review."
            : "Skill submitted. Pending review.",
        reviewFlags: allFlags.length > 0 ? allFlags : undefined,
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
