import { NextRequest, NextResponse } from "next/server";
import { sendSmsCode } from "@/lib/sms";
import { analytics } from "@/lib/analytics";
import { getT } from "@/lib/i18n";

const PHONE_RE = /^1[3-9]\d{9}$/;

export async function POST(request: NextRequest) {
  try {
    const t = await getT("errors");
    const body = await request.json();
    const { phone } = body as { phone?: string };

    if (!phone || !PHONE_RE.test(phone)) {
      return NextResponse.json(
        { error: t("phone_required") },
        { status: 400 }
      );
    }

    await sendSmsCode(phone);
    analytics.user.smsSend(phone);

    return NextResponse.json({ message: t("sms_sent") });
  } catch (err) {
    console.error("[auth/sms/send]", err);
    const t = await getT("errors");
    return NextResponse.json({ error: t("sms_send_failed") }, { status: 500 });
  }
}
