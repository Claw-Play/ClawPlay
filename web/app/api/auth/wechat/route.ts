import { NextRequest, NextResponse } from "next/server";
import { getWechatAuthUrl } from "@/lib/wechat";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const redirect = request.nextUrl.searchParams.get("redirect") ?? "/dashboard";
    // state encodes the post-login redirect path; keep it URL-safe
    const state = Buffer.from(redirect).toString("base64url");
    const authUrl = getWechatAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[auth/wechat]", err);
    return NextResponse.json(
      { error: "WeChat OAuth not configured." },
      { status: 503 }
    );
  }
}
