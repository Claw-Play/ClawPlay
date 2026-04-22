/**
 * Unit tests for getPublicOrigin().
 * Verifies correct origin resolution across all code paths,
 * including nginx reverse-proxy scenarios (X-Forwarded-Host / X-Forwarded-Proto).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { getPublicOrigin } from "@/lib/request-origin";
import { makeRequest } from "./helpers/request";

describe("getPublicOrigin", () => {
  const originalBaseUrl = process.env.BASE_URL;

  afterEach(() => {
    if (originalBaseUrl !== undefined) {
      process.env.BASE_URL = originalBaseUrl;
    } else {
      delete process.env.BASE_URL;
    }
  });

  // ── BASE_URL env var ────────────────────────────────────────────────────────

  it("returns BASE_URL origin when set", () => {
    process.env.BASE_URL = "https://clawplay.shop";
    const req = makeRequest("GET", "/", {
      headers: { "X-Forwarded-Host": "malicious.com" },
    });
    expect(getPublicOrigin(req)).toBe("https://clawplay.shop");
  });

  it("falls back to forwarded headers when BASE_URL is malformed", () => {
    process.env.BASE_URL = "not-a-valid-url";
    const req = makeRequest("GET", "/", {
      proxyHost: "clawplay.shop",
      proxyProto: "https",
    });
    expect(getPublicOrigin(req)).toBe("https://clawplay.shop");
  });

  it("ignores forwarded headers when BASE_URL is set to a valid URL", () => {
    process.env.BASE_URL = "https://myapp.com";
    const req = makeRequest("GET", "/", {
      proxyHost: "clawplay.shop",
      proxyProto: "http",
    });
    expect(getPublicOrigin(req)).toBe("https://myapp.com");
  });

  // ── X-Forwarded-Host + X-Forwarded-Proto ────────────────────────────────────

  it("uses X-Forwarded-Host and X-Forwarded-Proto from proxy headers", () => {
    process.env.BASE_URL = "";
    delete process.env.BASE_URL;
    const req = makeRequest("GET", "/", {
      proxyHost: "clawplay.shop",
      proxyProto: "https",
    });
    expect(getPublicOrigin(req)).toBe("https://clawplay.shop");
  });

  it("infers https for non-localhost hosts when no X-Forwarded-Proto is provided", () => {
    delete process.env.BASE_URL;
    const req = makeRequest("GET", "/", {
      proxyHost: "clawplay.shop",
    });
    expect(getPublicOrigin(req)).toBe("https://clawplay.shop");
  });

  it("infers http for localhost hosts when no X-Forwarded-Proto is provided", () => {
    delete process.env.BASE_URL;
    const req = makeRequest("GET", "/", {
      proxyHost: "localhost",
    });
    expect(getPublicOrigin(req)).toBe("http://localhost");
  });

  it("infers http for 127.0.0.1 hosts when no X-Forwarded-Proto is provided", () => {
    delete process.env.BASE_URL;
    const req = makeRequest("GET", "/", {
      proxyHost: "127.0.0.1",
    });
    expect(getPublicOrigin(req)).toBe("http://127.0.0.1");
  });

  it("takes first value from comma-separated X-Forwarded-Proto", () => {
    delete process.env.BASE_URL;
    const req = makeRequest("GET", "/", {
      proxyHost: "clawplay.shop",
      proxyProto: "https, http",
    });
    expect(getPublicOrigin(req)).toBe("https://clawplay.shop");
  });

  // ── Host header fallback ──────────────────────────────────────────────────────

  it("uses Host header when no X-Forwarded-Host is set", () => {
    delete process.env.BASE_URL;
    const req = makeRequest("GET", "/");
    // makeRequest sets Host=localhost:3000, no X-Forwarded-Host
    expect(getPublicOrigin(req)).toBe("http://localhost:3000");
  });

  // ── Edge cases ───────────────────────────────────────────────────────────────

  it("strips path from X-Forwarded-Host (takes first value only)", () => {
    delete process.env.BASE_URL;
    const req = makeRequest("GET", "/", {
      proxyHost: "clawplay.shop, evil.com",
    });
    // normalizeHost splits on comma and trims
    expect(getPublicOrigin(req)).toBe("https://clawplay.shop");
  });

  it("throws when no BASE_URL and no Host header", () => {
    delete process.env.BASE_URL;
    const req = new Request("http://localhost:3000/", {
      method: "GET",
    });
    // Convert to NextRequest (it handles missing Host gracefully)
    const nextReq = new NextRequest(req.url, { headers: {} });
    expect(() => getPublicOrigin(nextReq)).toThrow();
  });
});
