import { NextRequest, NextResponse } from "next/server";
import { buildClearCookieHeader } from "@/lib/auth";
import { getAuthFromCookies } from "@/lib/auth";
import { analytics } from "@/lib/analytics";

export async function POST(request: NextRequest) {
  const auth = await getAuthFromCookies();
  if (auth) {
    analytics.user.logout(auth.userId);
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.search = "";
  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("Set-Cookie", buildClearCookieHeader());
  return response;
}
