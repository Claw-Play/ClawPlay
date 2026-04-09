import { NextRequest, NextResponse } from "next/server";
import { decryptToken, type TokenPayload } from "@/lib/token";
import { checkAndIncrementQuota, ABILITY_COSTS } from "@/lib/redis";
import { analytics } from "@/lib/analytics";

const TTS_API_URL = "https://openspeech.bytedance.com/api/v3/tts";
const TTS_API_KEY = process.env.ARK_TTS_API_KEY ?? "";
const ABILITY = "tts.synthesize";
const COST = ABILITY_COSTS[ABILITY] ?? 5;

/** Proxy TTS synthesis through ClawPlay (quota-protected) */
export async function POST(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "") ??
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

  const quotaResult = await checkAndIncrementQuota(payload.userId, ABILITY);
  if (!quotaResult.allowed) {
    analytics.quota.exceeded(payload.userId, ABILITY, quotaResult.remaining ?? 0, (quotaResult.remaining ?? 0) + COST);
    return NextResponse.json(
      { error: "Quota exceeded.", reason: quotaResult.reason, remaining: quotaResult.remaining },
      { status: 429 }
    );
  }

  if (!TTS_API_KEY) {
    return NextResponse.json({ error: "TTS not configured on server." }, { status: 503 });
  }

  const body = await request.json();
  const { text, voice, encoding } = body as {
    text?: string;
    voice?: string;
    encoding?: string;
  };

  if (!text) {
    return NextResponse.json({ error: "text is required." }, { status: 400 });
  }

  try {
    const providerRes = await fetch(TTS_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TTS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appid: "clawplay",
        text: text.slice(0, 500),
        voice: voice ?? "BV001",
        encoding: encoding ?? "mp3",
        speed_ratio: 1.0,
        volume_ratio: 1.0,
        pitch_ratio: 1.0,
      }),
    });

    if (!providerRes.ok) {
      const err = await providerRes.text();
      return NextResponse.json({ error: "Provider error.", detail: err }, { status: 502 });
    }

    const data = await providerRes.json();
    analytics.quota.use(payload.userId, ABILITY, COST);
    return NextResponse.json({
      ...data,
      _quota: { used: COST, remaining: quotaResult.remaining },
    });
  } catch (err) {
    analytics.quota.error(payload.userId, ABILITY, "tts", (err as NodeJS.ErrnoException).code ?? "UNKNOWN");
    console.error("[ability/tts/synthesize]", err);
    return NextResponse.json({ error: "Failed to synthesize speech." }, { status: 500 });
  }
}
