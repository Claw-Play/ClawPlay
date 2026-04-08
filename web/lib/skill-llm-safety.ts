/**
 * skill-llm-safety.ts
 * LLM 安全预审 — 对 SKILL.md 内容做安全评估。
 * 无 API Key 时优雅降级（不阻断提交）。
 */

export interface LLMReviewResult {
  verdict: "SAFE" | "REVIEW" | "UNSAFE";
  reason: string;
  flags: Array<{ code: string; description: string }>;
}

const SYSTEM_PROMPT =
  'You are a content-safety reviewer for AI agent Skills. ' +
  'Output ONLY valid JSON: {"verdict":"SAFE|REVIEW|UNSAFE","reason":"...","flags":[{"code":"...","description":"..."}]}.' +
  'verdict meanings: SAFE = no issues. REVIEW = suspicious, needs human review. UNSAFE = clearly harmful content.' +
  'flag codes: ADULT, VIOLENCE, POLITICS, HATE_SPEECH, MALWARE, HARASSMENT, COPYRIGHT, OTHER.';

const USER_PROMPT_TEMPLATE =
  'Review the following SKILL.md content for safety issues. ' +
  "Check for: adult content, violence, political topics, hate speech, malware instructions, harassment, copyright violations.\n\n" +
  "SKILL.md content:\n" +
  "```\n{content}\n```";

/**
 * 调用 LLM 对 SKILL.md 内容做安全预审。
 * 失败时返回 null（调用方应优雅降级）。
 */
export async function llmSafetyReview(
  content: string,
  generate: (req: {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    system?: string;
  }) => Promise<{ text: string }>
): Promise<LLMReviewResult | null> {
  const userPrompt = USER_PROMPT_TEMPLATE.replace("{content}", content.slice(0, 4000));

  let text: string;
  try {
    const result = await generate({
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 300,
      temperature: 0,
    });
    text = result.text.trim();
  } catch {
    return null;
  }

  // 提取 JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      verdict?: string;
      reason?: string;
      flags?: unknown;
    };

    if (!("verdict" in parsed)) return null;

    const verdict = (["SAFE", "REVIEW", "UNSAFE"] as const).includes(
      parsed.verdict as "SAFE" | "REVIEW" | "UNSAFE"
    )
      ? (parsed.verdict as "SAFE" | "REVIEW" | "UNSAFE")
      : "SAFE";

    const flags = Array.isArray(parsed.flags)
      ? parsed.flags.map((f) => ({
          code: String(f?.code ?? "UNKNOWN"),
          description: String(f?.description ?? ""),
        }))
      : [];

    return {
      verdict,
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
      flags,
    };
  } catch {
    return null;
  }
}
