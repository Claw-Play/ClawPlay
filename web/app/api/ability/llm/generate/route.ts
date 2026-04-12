import { NextRequest, NextResponse } from "next/server";
import { decryptToken, type TokenPayload } from "@/lib/token";
import { checkQuota, incrementQuota } from "@/lib/redis";
import { getLLMProvider, type LLMGenerateRequest } from "@/lib/providers/llm";
import { analytics } from "@/lib/analytics";

const ABILITY = "llm.generate";

/**
 * Relay LLM text generation through ClawPlay (token-based quota).
 * POST /api/ability/llm/generate
 * Body: { prompt, model?, maxTokens?, temperature? }
 */
export async function POST(request: NextRequest) {
  // 1. Extract + decrypt token
  const token =
    request.headers.get("Authorization")?.replace("Bearer ", "") ??
    request.cookies.get("clawplay_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Authorization required." }, { status: 401 });
  }

  let payload: TokenPayload;
  try {
    payload = decryptToken<TokenPayload>(token);
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  // 2. Check quota (pre-check with conservative estimate)
  const quotaCheck = await checkQuota(payload.userId, ABILITY);
  if (!quotaCheck.allowed) {
    analytics.quota.exceeded(payload.userId, ABILITY, quotaCheck.remaining ?? 0, quotaCheck.remaining ?? 0);
    return NextResponse.json(
      { error: "Quota exceeded.", reason: quotaCheck.reason, remaining: quotaCheck.remaining },
      { status: 429 }
    );
  }

  // 3. Parse request body
  const body = await request.json() as Partial<LLMGenerateRequest>;
  const { prompt, model, maxTokens, temperature } = body;

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required." }, { status: 400 });
  }

  // 4. Call LLM provider
  let provider;
  try {
    provider = getLLMProvider();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM provider not configured.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  try {
    const providerName = process.env.LLM_PROVIDER ?? "ark";
    const result = await provider.generate({ prompt, model, maxTokens, temperature });

    // 5. Deduct quota after success using actual tokens
    const actualTokens = result.usage?.totalTokens ?? 0;
    const incr = await incrementQuota(payload.userId, actualTokens);
    analytics.quota.use(payload.userId, ABILITY, actualTokens, { ...result.usage, provider: providerName });

    if (!incr.ok) {
      return NextResponse.json(
        { error: "Quota exceeded.", remaining: 0 },
        { status: 429 }
      );
    }
    return NextResponse.json({ ...result, _quota: { used: actualTokens, remaining: incr.remaining ?? 0 } });
  } catch (err) {
    analytics.quota.error(payload.userId, ABILITY, "llm", (err as NodeJS.ErrnoException).code ?? "UNKNOWN");
    const err_ = err as NodeJS.ErrnoException;
    if (err_.code === "PROVIDER_RATE_LIMITED") {
      console.warn("[ability/llm/generate] provider rate limited");
      return NextResponse.json(
        { error: "Service busy. Please retry in a moment." },
        { status: 503 }
      );
    }
    console.error("[ability/llm/generate]", err);
    return NextResponse.json({ error: "Failed to generate text." }, { status: 500 });
  }
}
