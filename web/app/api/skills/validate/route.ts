import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { scanSkillContent } from "@/lib/skill-security-scan";
import { llmSafetyReview } from "@/lib/skill-llm-safety";
import { validateSkillMdFormat } from "@/lib/submit-wizard";
import { getT } from "@/lib/i18n";

export async function POST(request: NextRequest) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { skillMdContent } = body as { skillMdContent?: string };

    if (!skillMdContent) {
      return NextResponse.json(
        { error: "skillMdContent is required" },
        { status: 400 },
      );
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // ── 1. 静态安全扫描 ─────────────────────────────────────────────────────
    const scan = scanSkillContent(skillMdContent);
    for (const flag of scan.flags) {
      const msg = `[${flag.code}] ${flag.description}`;
      if (flag.severity === "error") {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }

    // ── 2. LLM 安全预审（可选，优雅降级）───────────────────────────────────
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
        for (const flag of review.flags) {
          warnings.push(`[LLM_${flag.code}] ${flag.description}`);
        }
        if (review.verdict === "UNSAFE") {
          errors.push(`Safety review: ${review.reason}`);
        }
      }
    } catch {
      // LLM 未配置或调用失败 — 跳过，不阻断校验
    }

    // ── 3. 格式检查（复用客户端侧同一套逻辑）─────────────────────────────
    const formatCheck = validateSkillMdFormat(skillMdContent);
    errors.push(...formatCheck.errors);
    warnings.push(...formatCheck.warnings);

    const safe = errors.length === 0;

    return NextResponse.json({ safe, errors, warnings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
