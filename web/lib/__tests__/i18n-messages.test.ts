/**
 * Unit tests for lib/i18n/index.ts — getMessages fallback and key interpolation.
 * Note: getLocaleFromCookies / getT require Next.js request context and are tested via E2E.
 */
import { describe, it, expect } from "vitest";
import { getMessages } from "@/lib/i18n/index";

describe("getMessages", () => {
  it("returns zh messages for locale 'zh'", () => {
    const msgs = getMessages("zh");
    expect(msgs).toBeDefined();
    expect(msgs.common.home).toBe("首页");
  });

  it("returns en messages for locale 'en'", () => {
    const msgs = getMessages("en");
    expect(msgs).toBeDefined();
    expect(msgs.common.home).toBe("Home");
  });

  it("falls back to zh for unknown locale", () => {
    const msgs = getMessages("fr");
    expect(msgs.common.home).toBe("首页");
  });

  it("falls back to zh when locale is undefined", () => {
    const msgs = getMessages(undefined);
    expect(msgs.common.home).toBe("首页");
  });

  it("has all expected top-level namespaces", () => {
    const msgs = getMessages("en");
    expect(msgs.common).toBeDefined();
    expect(msgs.home).toBeDefined();
    expect(msgs.auth).toBeDefined();
    expect(msgs.skills).toBeDefined();
    expect(msgs.admin).toBeDefined();
  });

  it("en and zh have consistent namespace structure", () => {
    const en = getMessages("en");
    const zh = getMessages("zh");
    expect(Object.keys(en)).toEqual(Object.keys(zh));
  });
});

describe("message key interpolation (mirrors getT implementation)", () => {
  // Mirror the actual interpolation logic from lib/i18n/index.ts
  function interpolate(str: string, values?: Record<string, string | number>): string {
    if (!values) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
  }

  it("replaces {key} placeholders with provided values", () => {
    const template = "{count} submission(s) awaiting review";
    const result = interpolate(template, { count: "5" });
    expect(result).toBe("5 submission(s) awaiting review");
  });

  it("replaces multiple placeholders", () => {
    const template = "{start}–{end} of {total} logs";
    const result = interpolate(template, { start: "1", end: "10", total: "100" });
    expect(result).toBe("1–10 of 100 logs");
  });

  it("leaves placeholder if value is not provided", () => {
    const template = "{count} submission(s) awaiting review";
    const result = interpolate(template, {});
    expect(result).toBe("{count} submission(s) awaiting review");
  });

  it("handles numeric values in interpolation", () => {
    const template = "Showing {start} to {end}";
    const result = interpolate(template, { start: 1, end: 50 });
    expect(result).toBe("Showing 1 to 50");
  });

  it("handles special regex chars in values without breaking replacement", () => {
    const template = "Path: {path}";
    const result = interpolate(template, { path: "https://example.com?foo=bar&baz=1" });
    expect(result).toBe("Path: https://example.com?foo=bar&baz=1");
  });
});
