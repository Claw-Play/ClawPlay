import { NextRequest, NextResponse } from "next/server";
import { decryptToken, type TokenPayload } from "@/lib/token";
import { checkQuota, incrementQuota } from "@/lib/redis";
import { getImageProvider, type ImageGenerateRequest } from "@/lib/providers/image";
import { analytics } from "@/lib/analytics";

const ABILITY = "image.generate";

/** Proxy image generation through ClawPlay (quota-protected) */
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
  const body = await request.json() as Partial<ImageGenerateRequest>;
  const { prompt, size, quality, refImages, webSearch } = body;

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required." }, { status: 400 });
  }

  if (refImages && refImages.length > 14) {
    return NextResponse.json({ error: "Maximum 14 reference images allowed." }, { status: 400 });
  }

  // 4. Call provider (post-deduct: quota incremented only on success)
  let provider;
  try {
    provider = getImageProvider();
  } catch {
    return NextResponse.json(
      { error: "Image generation not configured on server." },
      { status: 503 }
    );
  }

  try {
    const providerName = process.env.IMAGE_PROVIDER ?? "ark";
    const result = await provider.generate({ prompt, size, quality, refImages, webSearch });

    // 5. Deduct quota after successful generation using actual tokens
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
    analytics.quota.error(payload.userId, ABILITY, "image", (err as NodeJS.ErrnoException).code ?? "UNKNOWN");
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "PROVIDER_RATE_LIMITED") {
      console.warn("[ability/image/generate] provider rate limited");
      return NextResponse.json(
        { error: "Service busy. Please retry in a moment." },
        { status: 503 }
      );
    }
    console.error("[ability/image/generate]", err);
    return NextResponse.json({ error: "Failed to generate image." }, { status: 500 });
  }
}
