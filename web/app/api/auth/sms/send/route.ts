import { NextRequest, NextResponse } from "next/server";
import { sendSmsCode } from "@/lib/sms";

const PHONE_RE = /^1[3-9]\d{9}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body as { phone?: string };

    if (!phone || !PHONE_RE.test(phone)) {
      return NextResponse.json(
        { error: "请输入有效的中国大陆手机号。" },
        { status: 400 }
      );
    }

    await sendSmsCode(phone);

    return NextResponse.json({ message: "验证码已发送，请在10分钟内使用。" });
  } catch (err) {
    console.error("[auth/sms/send]", err);
    return NextResponse.json({ error: "短信发送失败，请稍后重试。" }, { status: 500 });
  }
}
