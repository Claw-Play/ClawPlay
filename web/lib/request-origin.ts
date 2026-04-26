import { NextRequest } from "next/server";

function normalizeHost(value: string): string {
  return value.split(",")[0].trim();
}

function isPrivateHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host.startsWith("localhost/") ||
    /^127\./.test(host) ||
    host === "::1" ||
    host.endsWith(".local")
  );
}

function buildOriginFromHost(host: string, forwardedProto: string | null): string {
  const normalizedHost = normalizeHost(host);
  const forwardedProtoValue = forwardedProto?.split(",")[0].trim().toLowerCase();
  const proto = isPrivateHost(normalizedHost)
    ? (forwardedProtoValue ?? "http")
    : "https";
  return `${proto}://${normalizedHost}`;
}

function getConfiguredPublicOrigin(): string | null {
  const configuredBaseUrl = process.env.BASE_URL;
  if (!configuredBaseUrl) return null;
  try {
    return new URL(configuredBaseUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Resolve the public app origin for redirects and OAuth callbacks.
 *
 * Preference order:
 * 1. Forwarded host/proto headers from the reverse proxy
 * 2. Explicit BASE_URL env var (useful when the app only sees an internal host)
 * 3. Raw Host header for local dev / fallback
 */
export function getPublicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return buildOriginFromHost(forwardedHost, forwardedProto);
  }

  const configuredOrigin = getConfiguredPublicOrigin();
  const host = request.headers.get("host");
  if (host) {
    const normalizedHost = normalizeHost(host);
    if (isPrivateHost(normalizedHost) && configuredOrigin) {
      return configuredOrigin;
    }
    return buildOriginFromHost(host, forwardedProto);
  }

  if (configuredOrigin) return configuredOrigin;

  throw new Error("Unable to resolve public origin; set BASE_URL or forward Host/X-Forwarded-Proto headers");
}
