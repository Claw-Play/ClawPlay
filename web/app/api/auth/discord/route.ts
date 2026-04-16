import { NextRequest, NextResponse } from "next/server";
import { getDiscordAuthUrl } from "@/lib/oauth";

export async function GET(request: NextRequest) {
  const redirect = request.nextUrl.searchParams.get("redirect") ?? "/dashboard";
  const state = Buffer.from(redirect).toString("base64url");

  try {
    const url = getDiscordAuthUrl(state, request.nextUrl.origin);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[auth/discord]", err);
    return NextResponse.redirect(
      new URL("/login?error=discord_config", request.nextUrl.origin)
    );
  }
}
