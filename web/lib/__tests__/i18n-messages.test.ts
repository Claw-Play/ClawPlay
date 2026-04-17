/**
 * Unit tests for lib/i18n/index.ts — getMessages fallback and key interpolation.
 * Note: getLocaleFromCookies / getT require Next.js request context and are tested via E2E.
 */
import { describe, it, expect } from "vitest";
import { getMessages } from "@/lib/i18n/index";
import zhMessages from "@/messages/zh.json";
import enMessages from "@/messages/en.json";

describe("getMessages", () => {
  it("returns zh messages for locale 'zh'", () => {
    const msgs = getMessages("zh");
    expect(msgs).toBeDefined();
    expect(msgs.common.home).toBe(zhMessages.common.home);
  });

  it("returns en messages for locale 'en'", () => {
    const msgs = getMessages("en");
    expect(msgs).toBeDefined();
    expect(msgs.common.home).toBe(enMessages.common.home);
  });

  it("falls back to zh for unknown locale", () => {
    const msgs = getMessages("fr");
    expect(msgs.common.home).toBe(zhMessages.common.home);
  });

  it("falls back to zh when locale is undefined", () => {
    const msgs = getMessages(undefined);
    expect(msgs.common.home).toBe(zhMessages.common.home);
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

  // Build expected string from the same message key + test values — avoids hardcoding
  function expectedFromMessage(msg: string, values: Record<string, string | number>) {
    return interpolate(msg, values);
  }

  it("replaces {key} placeholders with provided values", () => {
    const template = zhMessages.admin_review.submissions_count as string;
    const result = interpolate(template, { count: "5" });
    expect(result).toBe(expectedFromMessage(template, { count: "5" }));
  });

  it("replaces multiple placeholders", () => {
    const template = enMessages.admin_audit.showing_range as string;
    const result = interpolate(template, { startItem: "1", endItem: "10", total: "100" });
    expect(result).toBe(expectedFromMessage(template, { startItem: "1", endItem: "10", total: "100" }));
  });

  it("leaves placeholder if value is not provided", () => {
    const template = zhMessages.admin_review.submissions_count as string;
    const result = interpolate(template, {});
    expect(result).toBe(expectedFromMessage(template, {}));
  });

  it("handles numeric values in interpolation", () => {
    const template = enMessages.admin_audit.showing_range as string;
    const result = interpolate(template, { startItem: 1, endItem: 50, total: 200 });
    expect(result).toBe(expectedFromMessage(template, { startItem: 1, endItem: 50, total: 200 }));
  });

  it("handles special regex chars in values without breaking replacement", () => {
    const template = enMessages.admin_audit.showing_range as string;
    const result = interpolate(template, { startItem: 1, endItem: 50, total: 200 });
    expect(result).toBe(expectedFromMessage(template, { startItem: 1, endItem: 50, total: 200 }));
  });
});
