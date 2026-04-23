import { NextRequest, NextResponse } from "next/server";
import { buildClearCookieHeader } from "@/lib/auth";
import { getAuthFromCookies } from "@/lib/auth";
import { analytics } from "@/lib/analytics";
import { getPublicOrigin } from "@/lib/request-origin";

function getSafeRedirectPath(value: string | null): string | null {
  if (!value || !value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromCookies();
  if (auth) {
    analytics.user.logout(auth.userId);
  }

  const explicitFrom = getSafeRedirectPath(request.nextUrl.searchParams.get("from"));
  let fallbackFrom: string | null = null;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      fallbackFrom = getSafeRedirectPath(`${refererUrl.pathname}${refererUrl.search}`);
    } catch {}
  }

  const redirectUrl = new URL("/login", getPublicOrigin(request));
  const from = explicitFrom ?? fallbackFrom;
  if (from) {
    redirectUrl.searchParams.set("from", from);
  }
  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("Set-Cookie", buildClearCookieHeader());
  return response;
}
