import { NextRequest, NextResponse } from "next/server";
import { authenticateClawplayToken } from "@/lib/token-auth";
import { checkQuota, incrementQuota } from "@/lib/redis";
import { getLLMProvider, type LLMGenerateRequest } from "@/lib/providers/llm";
import { analytics } from "@/lib/analytics";
import { getT } from "@/lib/i18n";

const ABILITY = "llm.generate";

/**
 * Relay LLM text generation through ClawPlay (token-based quota).
 * POST /api/ability/llm/generate
 * Body: { prompt, model?, maxTokens?, temperature? }
 */
export async function POST(request: NextRequest) {
  const t = await getT("errors");

  const auth = await authenticateClawplayToken(request);
  if (!auth) {
    return NextResponse.json({ error: t("authorization_required") }, { status: 401 });
  }

  // 2. Check quota (pre-check with conservative estimate)
  const quotaCheck = await checkQuota(auth.userId, ABILITY);
  if (!quotaCheck.allowed) {
    analytics.quota.exceeded(auth.userId, ABILITY, quotaCheck.remaining ?? 0, quotaCheck.remaining ?? 0);
    return NextResponse.json(
      { error: t("quota_exceeded"), reason: quotaCheck.reason, remaining: quotaCheck.remaining },
      { status: 429 }
    );
  }

  // 3. Parse request body
  const body = await request.json() as Partial<LLMGenerateRequest>;
  const { prompt, model, maxTokens, temperature } = body;

  if (!prompt) {
    return NextResponse.json({ error: t("prompt_required") }, { status: 400 });
  }

  // 4. Call LLM provider
  let provider;
  try {
    provider = getLLMProvider();
  } catch (err) {
    const msg = err instanceof Error ? err.message : t("quota_service_unavailable");
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  try {
    const providerName = process.env.LLM_PROVIDER ?? "ark";
    const result = await provider.generate({ prompt, model, maxTokens, temperature });

    // 5. Deduct quota after success using actual tokens
    const actualTokens = result.usage?.totalTokens ?? 0;
    const incr = await incrementQuota(auth.userId, actualTokens);
    if (!incr.ok) {
      analytics.quota.exceeded(auth.userId, ABILITY, quotaCheck.remaining ?? 0, quotaCheck.remaining ?? 0);
      return NextResponse.json(
        { error: t("quota_exceeded"), remaining: 0 },
        { status: 429 }
      );
    }
    analytics.quota.use(auth.userId, ABILITY, actualTokens, { ...result.usage, provider: providerName });
    return NextResponse.json({ ...result, _quota: { used: actualTokens, remaining: incr.remaining ?? 0 } });
  } catch (err) {
    analytics.quota.error(auth.userId, ABILITY, "llm", (err as NodeJS.ErrnoException).code ?? "UNKNOWN");
    const err_ = err as NodeJS.ErrnoException;
    if (err_.code === "PROVIDER_RATE_LIMITED") {
      console.warn("[ability/llm/generate] provider rate limited");
      return NextResponse.json(
        { error: t("service_busy") },
        { status: 503 }
      );
    }
    console.error("[ability/llm/generate]", err);
    return NextResponse.json({ error: t("text_generation_failed") }, { status: 500 });
  }
}
