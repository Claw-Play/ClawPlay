import { NextRequest, NextResponse } from "next/server";
import { getXAuthUrl } from "@/lib/oauth";

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64url");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("base64url");
}

export async function GET(request: NextRequest) {
  const redirect = request.nextUrl.searchParams.get("redirect") ?? "/dashboard";
  const state = Buffer.from(redirect).toString("base64url");

  try {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const url = getXAuthUrl(state, codeChallenge, request.nextUrl.origin);

    const response = NextResponse.redirect(url);
    // Store code_verifier in a short-lived cookie (5 min)
    response.cookies.set("x_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("[auth/x]", err);
    return NextResponse.redirect(
      new URL("/login?error=x_config", request.nextUrl.origin)
    );
  }
}
