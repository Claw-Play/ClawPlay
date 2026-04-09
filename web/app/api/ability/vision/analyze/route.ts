import { NextRequest, NextResponse } from "next/server";
import { decryptToken, type TokenPayload } from "@/lib/token";
import { checkQuota, incrementQuota, ABILITY_COSTS } from "@/lib/redis";
import { getVisionProvider, type VisionAnalyzeRequest } from "@/lib/providers/vision";
import { analytics } from "@/lib/analytics";

const ABILITY = "vision.analyze";
const COST = ABILITY_COSTS[ABILITY] ?? 5;

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
    payload = decryptToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  // 2. Check quota
  const quotaCheck = await checkQuota(payload.userId, ABILITY);
  if (!quotaCheck.allowed) {
    analytics.quota.exceeded(payload.userId, ABILITY, quotaCheck.remaining ?? 0, (quotaCheck.remaining ?? 0) + COST);
    return NextResponse.json(
      { error: "Quota exceeded.", reason: quotaCheck.reason, remaining: quotaCheck.remaining },
      { status: 429 }
    );
  }

  // 3. Parse + validate request body
  const body = await request.json() as Partial<VisionAnalyzeRequest> & { provider?: string };
  const { images, prompt, mode = "describe", provider = "ark" } = body;

  if (!images || images.length === 0) {
    return NextResponse.json({ error: "At least one image is required." }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required." }, { status: 400 });
  }
  if (!["describe", "detect", "segment"].includes(mode)) {
    return NextResponse.json({ error: "mode must be describe, detect, or segment." }, { status: 400 });
  }
  if (!["ark", "gemini"].includes(provider)) {
    return NextResponse.json({ error: "provider must be ark or gemini." }, { status: 400 });
  }
  if (mode === "segment" && provider !== "gemini") {
    return NextResponse.json(
      { error: "segment mode requires --provider gemini." },
      { status: 400 }
    );
  }

  // 4. Call provider
  let visionProvider;
  try {
    visionProvider = getVisionProvider(provider);
  } catch {
    return NextResponse.json(
      { error: "Vision provider not configured on server." },
      { status: 503 }
    );
  }

  try {
    const result = await visionProvider.analyze({ images, prompt, mode });

    // 5. Deduct quota after success
    await incrementQuota(payload.userId, ABILITY);
    analytics.quota.use(payload.userId, ABILITY, COST, result.usage);

    return NextResponse.json({ ...result, _quota: { used: COST, remaining: quotaCheck.remaining! - COST } });
  } catch (err) {
    analytics.quota.error(payload.userId, ABILITY, provider, (err as NodeJS.ErrnoException).code ?? "UNKNOWN");
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "PROVIDER_RATE_LIMITED") {
      console.warn("[ability/vision/analyze] provider rate limited", { provider });
      return NextResponse.json(
        { error: "Service busy. Please retry in a moment." },
        { status: 503 }
      );
    }
    console.error("[ability/vision/analyze]", err);
    return NextResponse.json({ error: "Failed to analyze image." }, { status: 500 });
  }
}
