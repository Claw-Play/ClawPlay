import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/oauth";

export async function GET(request: NextRequest) {
  const redirect = request.nextUrl.searchParams.get("redirect") ?? "/dashboard";
  const state = Buffer.from(redirect).toString("base64url");

  try {
    const url = getGoogleAuthUrl(state, request.nextUrl.origin);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[auth/google]", err);
    return NextResponse.redirect(
      new URL("/login?error=google_config", request.nextUrl.origin)
    );
  }
}
