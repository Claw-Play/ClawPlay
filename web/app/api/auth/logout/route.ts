import { NextRequest, NextResponse } from "next/server";
import { buildClearCookieHeader } from "@/lib/auth";
import { getAuthFromCookies } from "@/lib/auth";
import { analytics } from "@/lib/analytics";

function normalizeHost(value: string): string {
  return value.split(",")[0].trim();
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromCookies();
  if (auth) {
    analytics.user.logout(auth.userId);
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.search = "";
  // Ensure redirect URL uses the external host from proxy headers
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    redirectUrl.host = normalizeHost(forwardedHost);
  }
  if (forwardedProto) {
    // Use first token from comma-separated list (multi-proxy scenario)
    redirectUrl.protocol = forwardedProto.split(",")[0].trim().toLowerCase().replace(/:$/, "");
    if (!redirectUrl.protocol.endsWith(":")) {
      redirectUrl.protocol += ":";
    }
  }
  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("Set-Cookie", buildClearCookieHeader());
  return response;
}
