import { NextRequest } from "next/server";

function normalizeHost(value: string): string {
  return value.split(",")[0].trim();
}

/**
 * Resolve the public app origin for redirects and OAuth callbacks.
 *
 * Preference order:
 * 1. Explicit BASE_URL env var
 * 2. Forwarded host/proto headers from the reverse proxy
 */
export function getPublicOrigin(request: NextRequest): string {
  const configuredBaseUrl = process.env.BASE_URL;
  if (configuredBaseUrl) {
    try {
      return new URL(configuredBaseUrl).origin;
    } catch {
      // Ignore malformed values and fall through to forwarded headers.
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const proto =
      forwardedProto?.split(",")[0].trim() ||
      (normalizeHost(host).startsWith("localhost") || normalizeHost(host).startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${proto}://${normalizeHost(host)}`;
  }

  throw new Error("Unable to resolve public origin; set BASE_URL or forward Host/X-Forwarded-Proto headers");
}
