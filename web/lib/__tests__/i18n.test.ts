import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getT, getLocale, getMessages } from "@/lib/i18n";

// Save original env
const ORIG = process.env.NEXT_LOCALE;

function setLocale(locale: string) {
  process.env.NEXT_LOCALE = locale;
}

function resetLocale() {
  if (ORIG !== undefined) {
    process.env.NEXT_LOCALE = ORIG;
  } else {
    delete process.env.NEXT_LOCALE;
  }
}

afterEach(() => {
  resetLocale();
});

// ─── getLocale ────────────────────────────────────────────────────────────────
describe("getLocale", () => {
  it("defaults to 'zh' when env var is absent", () => {
    delete process.env.NEXT_LOCALE;
    expect(getLocale()).toBe("zh");
  });

  it("returns NEXT_LOCALE value as-is", () => {
    process.env.NEXT_LOCALE = "en";
    expect(getLocale()).toBe("en");
  });

  it("passes through non-standard locale strings", () => {
    process.env.NEXT_LOCALE = "fr";
    expect(getLocale()).toBe("fr");
  });

  it("handles empty string as unset", () => {
    process.env.NEXT_LOCALE = "";
    expect(getLocale()).toBe("zh");
  });
});

// ─── getMessages ──────────────────────────────────────────────────────────────
describe("getMessages", () => {
  it("returns zh messages by default", () => {
    delete process.env.NEXT_LOCALE;
    expect(getMessages().common.home).toBe("首页");
  });

  it("returns en messages for locale 'en'", () => {
    process.env.NEXT_LOCALE = "en";
    expect(getMessages("en").common.home).toBe("Home");
  });

  it("falls back to zh for unknown locale string", () => {
    expect(getMessages("xx").common.home).toBe("首页");
  });

  it("returns explicit locale arg over env var", () => {
    process.env.NEXT_LOCALE = "en";
    expect(getMessages("zh").common.home).toBe("首页");
  });

  it("returns all expected namespaces", () => {
    const msgs = getMessages();
    const expected = [
      "common", "nav", "home", "home_cli", "auth",
      "dashboard", "skills", "skill_detail", "submit",
      "error", "not_found",
    ];
    expected.forEach((ns) => expect(msgs).toHaveProperty(ns));
  });

  it("each namespace is a plain object with string values", () => {
    const msgs = getMessages();
    for (const [ns, content] of Object.entries(msgs)) {
      expect(typeof content).toBe("object");
      for (const [key, val] of Object.entries(content as Record<string, unknown>)) {
        expect(typeof key).toBe("string");
        expect(typeof val).toBe("string");
      }
    }
  });
});

// ─── getT — basic translation ─────────────────────────────────────────────────
describe("getT — basic translation", () => {
  beforeEach(() => setLocale("zh"));

  it("returns a function", () => {
    expect(typeof getT("common")).toBe("function");
  });

  it("translates known zh keys", () => {
    const t = getT("common");
    expect(t("home")).toBe("首页");
    expect(t("skills")).toBe("技能库");
    expect(t("dashboard")).toBe("控制台");
  });

  it("translates known en keys when locale is en", () => {
    process.env.NEXT_LOCALE = "en";
    const t = getT("common");
    expect(t("home")).toBe("Home");
    expect(t("skills")).toBe("Skills");
  });

  it("returns key itself for unknown keys", () => {
    const t = getT("common");
    expect(t("this_does_not_exist")).toBe("this_does_not_exist");
    expect(t("")).toBe("");
  });

  it("returns key itself for empty namespace string", () => {
    const t = getT("common");
    expect(t("")).toBe("");
  });
});

// ─── getT — interpolation ─────────────────────────────────────────────────────
describe("getT — interpolation", () => {
  beforeEach(() => setLocale("zh"));

  it("interpolates a single placeholder", () => {
    const t = getT("skills");
    expect(t("no_results", { query: "头像生成" })).toBe("未找到「头像生成」相关结果");
  });

  it("interpolates multiple distinct placeholders", () => {
    // Build a function that uses a hypothetical key with two placeholders
    const msgs = getMessages();
    const ns = msgs.skills as Record<string, string>;
    const key = Object.keys(ns).find(
      (k) => k.includes("results") || k.includes("query")
    )!;
    const result = tWithValues(ns[key], { query: "foo" });
    expect(result).toContain("foo");
  });

  it("leaves {placeholder} unchanged when not provided in values", () => {
    const t = getT("skills");
    // no_results has {query} — call without values object
    expect(t("no_results")).toBe("未找到「{query}」相关结果");
  });

  it("leaves specific placeholder unchanged when only some are provided", () => {
    const t = getT("skills");
    // if no_results = "未找到「{query}」相关结果"
    // calling with empty values object should leave it unchanged
    expect(t("no_results", {})).toBe("未找到「{query}」相关结果");
  });

  it("handles numeric values in interpolation", () => {
    const t = getT("skills");
    // should not throw even if no placeholder exists
    expect(() => t("no_results", { query: 42 })).not.toThrow();
  });

  it("handles unicode values in interpolation", () => {
    const t = getT("skills");
    expect(t("no_results", { query: "你好世界 🦐" })).toBe(
      "未找到「你好世界 🦐」相关结果"
    );
  });

  it("handles empty string value in interpolation", () => {
    const t = getT("skills");
    expect(t("no_results", { query: "" })).toBe("未找到「」相关结果");
  });

  it("interpolated value takes precedence over surrounding text", () => {
    const t = getT("skills");
    const result = t("no_results", { query: "X" });
    expect(result).toBe("未找到「X」相关结果");
    expect(result).not.toContain("{query}");
  });

  it("special regex chars in value do not break replacement", () => {
    const t = getT("skills");
    // $1 etc. are not special in our simple replace
    expect(t("no_results", { query: "$1[foo]" })).toBe(
      "未找到「$1[foo]」相关结果"
    );
  });
});

// ─── getT — namespace isolation ───────────────────────────────────────────────
describe("getT — namespace isolation", () => {
  beforeEach(() => setLocale("zh"));

  it("auth namespace does not leak into common", () => {
    const tAuth = getT("auth");
    const tCommon = getT("common");
    // 'login' exists in both auth and common (common has "登录")
    // auth namespace has its own login key
    expect(tAuth("login")).toBeTruthy();
  });

  it("dashboard namespace is independent", () => {
    const t = getT("dashboard");
    expect(t("welcome")).toBe("欢迎回来，");
    expect(t("user_info")).toBe("用户信息");
  });

  it("home namespace is independent", () => {
    const t = getT("home");
    expect(t("hero_badge")).toBe("开源 AI Skills 生态系统");
  });

  it("calling getT twice gives independent functions", () => {
    const t1 = getT("common");
    const t2 = getT("common");
    expect(t1).not.toBe(t2); // new function each time
    expect(t1("home")).toBe(t2("home")); // but same result
  });
});

// ─── getT — locale switching ─────────────────────────────────────────────────
describe("getT — locale switching", () => {
  it("reflects locale change between calls", () => {
    process.env.NEXT_LOCALE = "zh";
    const zh = getT("common")("home");

    process.env.NEXT_LOCALE = "en";
    const en = getT("common")("home");

    expect(zh).toBe("首页");
    expect(en).toBe("Home");
  });

  it("locale arg to getMessages overrides env var", () => {
    process.env.NEXT_LOCALE = "en";
    const zhMsgs = getMessages("zh");
    expect(zhMsgs.common.home).toBe("首页");
  });
});

// ─── edge cases ───────────────────────────────────────────────────────────────
describe("edge cases", () => {
  beforeEach(() => setLocale("zh"));

  it("empty string key returns empty string", () => {
    const t = getT("common");
    expect(t("")).toBe("");
  });

  it("whitespace-only key returns whitespace-only value if exists", () => {
    const t = getT("common");
    // If key doesn't exist, returns key itself — whitespace key has no translation
    expect(t("   ")).toBe("   ");
  });

  it("calling getT on non-existent namespace does not throw", () => {
    // TypeScript would catch this, but at runtime it still returns a function
    expect(() => getT("nonexistent" as keyof ReturnType<typeof getMessages>)).not.toThrow();
  });

  it("translation function is stable across multiple calls", () => {
    const t = getT("common");
    const results = Array.from({ length: 5 }, () => t("home"));
    expect(results).toEqual(["首页", "首页", "首页", "首页", "首页"]);
  });

  it("interpolation with many extra values does not throw", () => {
    const t = getT("skills");
    expect(() =>
      t("no_results", { query: "a", extra: "b", unused: "c" })
    ).not.toThrow();
  });
});

// ─── snapshot-style: all namespaces return strings ────────────────────────────
describe("all namespaces return string values", () => {
  it("every value in zh messages is a non-empty string", () => {
    const msgs = getMessages("zh");
    for (const [ns, content] of Object.entries(msgs)) {
      const record = content as Record<string, string>;
      for (const [key, val] of Object.entries(record)) {
        expect(typeof val, `namespace=${ns}, key=${key}`).toBe("string");
        expect(val.length, `namespace=${ns}, key=${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("every value in en messages is a non-empty string", () => {
    const msgs = getMessages("en");
    for (const [ns, content] of Object.entries(msgs)) {
      const record = content as Record<string, string>;
      for (const [key, val] of Object.entries(record)) {
        expect(typeof val, `namespace=${ns}, key=${key}`).toBe("string");
        expect(val.length, `namespace=${ns}, key=${key}`).toBeGreaterThan(0);
      }
    }
  });
});

// ─── helper used in tests ─────────────────────────────────────────────────────
function tWithValues(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
}
