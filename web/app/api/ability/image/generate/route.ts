import { NextRequest, NextResponse } from "next/server";
import { authenticateClawplayToken } from "@/lib/token-auth";
import { checkQuota, incrementQuota } from "@/lib/redis";
import { getImageProvider, type ImageGenerateRequest } from "@/lib/providers/image";
import { analytics } from "@/lib/analytics";
import { getT } from "@/lib/i18n";

const ABILITY = "image.generate";

/** Proxy image generation through ClawPlay (quota-protected) */
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
  const body = await request.json() as Partial<ImageGenerateRequest>;
  const { prompt, size, quality, refImages, webSearch } = body;

  if (!prompt) {
    return NextResponse.json({ error: t("prompt_required") }, { status: 400 });
  }

  if (refImages && refImages.length > 14) {
    return NextResponse.json({ error: t("max_ref_images") }, { status: 400 });
  }

  // 4. Call provider (post-deduct: quota incremented only on success)
  let provider;
  try {
    provider = await getImageProvider();
  } catch {
    return NextResponse.json(
      { error: t("image_not_configured") },
      { status: 503 }
    );
  }

  try {
    const providerName = process.env.IMAGE_PROVIDER ?? "ark";
    const result = await provider.generate({ prompt, size, quality, refImages, webSearch });

    // 5. Deduct quota after successful generation using actual tokens
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
    analytics.quota.error(auth.userId, ABILITY, "image", (err as NodeJS.ErrnoException).code ?? "UNKNOWN");
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "PROVIDER_RATE_LIMITED") {
      console.warn("[ability/image/generate] provider rate limited");
      return NextResponse.json(
        { error: t("service_busy") },
        { status: 503 }
      );
    }
    console.error("[ability/image/generate]", err);
    return NextResponse.json({ error: t("image_generation_failed") }, { status: 500 });
  }
}
