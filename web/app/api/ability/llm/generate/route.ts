import { NextRequest, NextResponse } from "next/server";
import { decryptToken, type TokenPayload } from "@/lib/token";
import { getLLMProvider, type LLMGenerateRequest } from "@/lib/providers/llm";
import { analytics } from "@/lib/analytics";

/**
 * Relay LLM text generation through ClawPlay (free, no quota deduction).
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

  // 2. Parse request body
  const body = await request.json() as Partial<LLMGenerateRequest>;
  const { prompt, model, maxTokens, temperature } = body;

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required." }, { status: 400 });
  }

  // 3. Call LLM provider (no quota deduction — this is a free developer tool)
  let provider;
  try {
    provider = getLLMProvider();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM provider not configured.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  try {
    const result = await provider.generate({ prompt, model, maxTokens, temperature });
    analytics.quota.use(payload.userId, "llm.generate", 0);
    return NextResponse.json(result);
  } catch (err) {
    analytics.quota.error(payload.userId, "llm.generate", "llm", (err as NodeJS.ErrnoException).code ?? "UNKNOWN");
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
