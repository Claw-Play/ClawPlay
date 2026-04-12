import { NextRequest, NextResponse } from "next/server";
import { decryptToken, type TokenPayload } from "@/lib/token";
import { checkQuota, incrementQuota } from "@/lib/redis";
import { getVisionProvider, type VisionAnalyzeRequest, type VisionImage } from "@/lib/providers/vision";
import { analytics } from "@/lib/analytics";

const ABILITY = "vision.analyze";

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

  // 3. Parse + validate request body
  const body = await request.json() as Partial<VisionAnalyzeRequest> & { provider?: string };
  const { images, prompt, mode = "describe", provider = "ark" } = body;

  // Normalize images: convert plain strings to VisionImage objects
  const normalizedImages: VisionImage[] = ((images ?? []) as (string | VisionImage)[]).map((img) => {
    if (typeof img === "string") {
      // Detect base64 data URI: "data:image/png;base64,xxxx"
      if (img.startsWith("data:")) {
        const match = img.match(/^data:([^;]+);base64,(.*)$/);
        if (match) {
          return { type: "b64", data: match[2], mimeType: match[1] };
        }
      }
      // Otherwise treat as URL
      return { type: "url", data: img };
    }
    return img as VisionImage;
  });

  if (!normalizedImages || normalizedImages.length === 0) {
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
    const result = await visionProvider.analyze({ images: normalizedImages, prompt, mode });

    // 5. Deduct quota after success using actual tokens
    const actualTokens = result.usage?.totalTokens ?? 0;
    const incr = await incrementQuota(payload.userId, actualTokens);
    analytics.quota.use(payload.userId, ABILITY, actualTokens, { ...result.usage, provider });

    if (!incr.ok) {
      // Quota exceeded (atomic check caught it) — return 429
      return NextResponse.json(
        { error: "Quota exceeded.", remaining: 0 },
        { status: 429 }
      );
    }

    return NextResponse.json({ ...result, _quota: { used: actualTokens, remaining: incr.remaining ?? 0 } });
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
