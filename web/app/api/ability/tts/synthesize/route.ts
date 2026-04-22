import { NextRequest, NextResponse } from "next/server";
import { authenticateClawplayToken } from "@/lib/token-auth";
import { checkQuota, incrementQuota, ABILITY_COSTS } from "@/lib/redis";
import { analytics } from "@/lib/analytics";
import { getT } from "@/lib/i18n";

const TTS_API_URL = "https://openspeech.bytedance.com/api/v3/tts";
const TTS_API_KEY = process.env.ARK_TTS_API_KEY ?? "";
const ABILITY = "tts.synthesize";
const COST = ABILITY_COSTS[ABILITY] ?? 5;

/** Proxy TTS synthesis through ClawPlay (quota-protected) */
export async function POST(request: NextRequest) {
  const t = await getT("errors");

  const auth = await authenticateClawplayToken(request);
  if (!auth) {
    return NextResponse.json({ error: t("authorization_required") }, { status: 401 });
  }

  const quotaCheck = await checkQuota(auth.userId, ABILITY);
  if (!quotaCheck.allowed) {
    analytics.quota.exceeded(auth.userId, ABILITY, quotaCheck.remaining ?? 0, quotaCheck.remaining ?? 0);
    return NextResponse.json(
      { error: t("quota_exceeded"), reason: quotaCheck.reason, remaining: quotaCheck.remaining },
      { status: 429 }
    );
  }

  if (!TTS_API_KEY) {
    return NextResponse.json({ error: t("tts_not_configured") }, { status: 503 });
  }

  const body = await request.json();
  const { text, voice, encoding } = body as {
    text?: string;
    voice?: string;
    encoding?: string;
  };

  if (!text) {
    return NextResponse.json({ error: t("text_required") }, { status: 400 });
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
      return NextResponse.json({ error: t("provider_error"), detail: err }, { status: 502 });
    }

    const data = await providerRes.json();
    const incr = await incrementQuota(auth.userId, COST);
    if (!incr.ok) {
      analytics.quota.exceeded(auth.userId, ABILITY, quotaCheck.remaining ?? 0, quotaCheck.remaining ?? 0);
      return NextResponse.json(
        { error: t("quota_exceeded"), remaining: 0 },
        { status: 429 }
      );
    }

    analytics.quota.use(auth.userId, ABILITY, COST);
    return NextResponse.json({
      ...data,
      _quota: { used: COST, remaining: incr.remaining ?? 0 },
    });
  } catch (err) {
    analytics.quota.error(auth.userId, ABILITY, "tts", (err as NodeJS.ErrnoException).code ?? "UNKNOWN");
    console.error("[ability/tts/synthesize]", err);
    return NextResponse.json({ error: t("tts_failed") }, { status: 500 });
  }
}
