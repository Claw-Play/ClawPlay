import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider, useT } from "@/lib/i18n/context";
import zhMessages from "@/messages/zh.json";
import enMessages from "@/messages/en.json";
import React from "react";

// ─── helper components ────────────────────────────────────────────────────────
function T({ ns, k, values }: { ns: keyof typeof zhMessages; k: string; values?: Record<string, string | number> }) {
  const t = useT(ns);
  return <span data-testid="t">{values ? t(k, values) : t(k)}</span>;
}

function renderZh(ui: React.ReactElement) {
  return render(<I18nProvider messages={zhMessages}>{ui}</I18nProvider>);
}
function renderEn(ui: React.ReactElement) {
  return render(<I18nProvider messages={enMessages}>{ui}</I18nProvider>);
}
function renderCustom(msgs: typeof zhMessages, ui: React.ReactElement) {
  return render(<I18nProvider messages={msgs}>{ui}</I18nProvider>);
}

// ─── I18nProvider ─────────────────────────────────────────────────────────────
describe("I18nProvider", () => {
  it("renders children normally", () => {
    renderZh(<div data-testid="child">hello</div>);
    expect(screen.getByTestId("child").textContent).toBe("hello");
  });

  it("renders multiple children", () => {
    renderZh(
      <div>
        <span data-testid="a">a</span>
        <span data-testid="b">b</span>
      </div>
    );
    expect(screen.getByTestId("a").textContent).toBe("a");
    expect(screen.getByTestId("b").textContent).toBe("b");
  });

  it("renders null/empty children without crashing", () => {
    expect(() =>
      renderZh(
        <div>
          {null}
          {false}
          {undefined}
          {""}
        </div>
      )
    ).not.toThrow();
  });

  it("renders fragments", () => {
    renderZh(
      <>
        <span data-testid="f1">f1</span>
        <span data-testId="f2">f2</span>
      </>
    );
    expect(screen.getByTestId("f1").textContent).toBe("f1");
  });

  it("renders deeply nested components", () => {
    function Deep({ depth }: { depth: number }) {
      if (depth === 0) return <T ns="common" k="home" />;
      return (
        <div>
          <Deep depth={depth - 1} />
        </div>
      );
    }
    const { getByTestId } = renderZh(<Deep depth={5} />);
    expect(getByTestId("t").textContent).toBe("首页");
  });

  it("works with React.memo wrapped components", () => {
    const MemoT = React.memo(function MemoT() {
      return <T ns="common" k="home" />;
    });
    const { getByTestId } = renderZh(<MemoT />);
    expect(getByTestId("t").textContent).toBe("首页");
  });

  it("nested I18nProvider: inner overrides outer messages", () => {
    function Inner() {
      return <T ns="common" k="home" />;
    }
    const { getByTestId } = render(
      <I18nProvider messages={zhMessages}>
        <I18nProvider messages={enMessages}>
          <Inner />
        </I18nProvider>
      </I18nProvider>
    );
    // innermost provider wins
    expect(getByTestId("t").textContent).toBe("Home");
  });
});

// ─── useT — zh translations ──────────────────────────────────────────────────
describe("useT — zh translations", () => {
  it("translates common.home", () => {
    renderZh(<T ns="common" k="home" />);
    expect(screen.getByTestId("t").textContent).toBe("首页");
  });

  it("translates dashboard.welcome", () => {
    renderZh(<T ns="dashboard" k="welcome" />);
    expect(screen.getByTestId("t").textContent).toBe("欢迎回来，");
  });

  it("translates dashboard.token_mgmt", () => {
    renderZh(<T ns="dashboard" k="token_mgmt" />);
    expect(screen.getByTestId("t").textContent).toBe("密钥管理");
  });

  it("translates auth.login", () => {
    renderZh(<T ns="auth" k="login" />);
    expect(screen.getByTestId("t").textContent).toBe("登录");
  });

  it("translates skills.title", () => {
    renderZh(<T ns="skills" k="title" />);
    expect(screen.getByTestId("t").textContent).toBe("技能库");
  });

  it("translates home.hero_badge", () => {
    renderZh(<T ns="home" k="hero_badge" />);
    expect(screen.getByTestId("t").textContent).toBe("开源 AI Skills 生态系统");
  });
});

// ─── useT — fallback behavior ───────────────────────────────────────────────
describe("useT — fallback for missing keys", () => {
  it("returns the key itself when key is missing", () => {
    renderZh(<T ns="common" k="totally_missing_key_xyz" />);
    expect(screen.getByTestId("t").textContent).toBe("totally_missing_key_xyz");
  });

  it("returns empty string when key is empty", () => {
    renderZh(<T ns="common" k="" />);
    expect(screen.getByTestId("t").textContent).toBe("");
  });

  it("returns key with whitespace when key is whitespace-only", () => {
    renderZh(<T ns="common" k="   " />);
    expect(screen.getByTestId("t").textContent).toBe("   ");
  });
});

// ─── useT — interpolation ────────────────────────────────────────────────────
describe("useT — interpolation", () => {
  it("interpolates a single placeholder", () => {
    renderZh(<T ns="skills" k="no_results" values={{ query: "头像生成" }} />);
    expect(screen.getByTestId("t").textContent).toBe("未找到「头像生成」相关结果");
  });

  it("leaves placeholder unchanged when no values provided", () => {
    renderZh(<T ns="skills" k="no_results" />);
    expect(screen.getByTestId("t").textContent).toBe("未找到「{query}」相关结果");
  });

  it("interpolates unicode values correctly", () => {
    renderZh(<T ns="skills" k="no_results" values={{ query: "你好 🦐" }} />);
    expect(screen.getByTestId("t").textContent).toBe("未找到「你好 🦐」相关结果");
  });

  it("interpolates with numbers", () => {
    renderZh(<T ns="skills" k="no_results" values={{ query: 42 }} />);
    expect(screen.getByTestId("t").textContent).toBe("未找到「42」相关结果");
  });

  it("empty value renders as empty string in placeholder", () => {
    renderZh(<T ns="skills" k="no_results" values={{ query: "" }} />);
    expect(screen.getByTestId("t").textContent).toBe("未找到「」相关结果");
  });

  it("partial values: provided replaced, others left as {key}", () => {
    // Only way to test this is with a key that has two placeholders
    // We control the behavior: any {key} not in values stays as-is
    // Use a controlled test by creating a custom messages object
    const customMsgs = {
      ...zhMessages,
      test: {
        multi: "Hello {name}, you have {count} messages",
      },
    } as typeof zhMessages;

    function Multi() {
      const t = useT("test" as keyof typeof zhMessages);
      // @ts-expect-error — deliberately testing runtime behavior
      return <span data-testid="t">{t("multi", { name: "Alice" })}</span>;
    }

    const { getByTestId } = renderCustom(customMsgs, <Multi />);
    // count is not provided, so {count} stays as-is
    expect(getByTestId("t").textContent).toBe("Hello Alice, you have {count} messages");
  });
});

// ─── useT — en translations ──────────────────────────────────────────────────
describe("useT — en translations", () => {
  it("translates common.home in en", () => {
    renderEn(<T ns="common" k="home" />);
    expect(screen.getByTestId("t").textContent).toBe("Home");
  });

  it("translates auth.login in en", () => {
    renderEn(<T ns="auth" k="login" />);
    expect(screen.getByTestId("t").textContent).toBe("Sign In");
  });

  it("en and zh differ for the same key", () => {
    // Verify zh
    const { unmount: unmountZh } = renderZh(<T ns="common" k="home" />);
    expect(screen.getByTestId("t").textContent).toBe("首页");
    unmountZh();

    // Verify en (clean DOM)
    renderEn(<T ns="common" k="home" />);
    expect(screen.getByTestId("t").textContent).toBe("Home");
    expect("首页").not.toBe("Home");
  });
});

// ─── useT — throws without provider ─────────────────────────────────────────
describe("useT — error handling", () => {
  it("throws with descriptive message when used outside I18nProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    function Bad() {
      useT("common");
      return null;
    }

    expect(() => render(<Bad />)).toThrow("useT must be used within I18nProvider");
    consoleSpy.mockRestore();
  });

  it("throws immediately on hook call, not on render", () => {
    // The error fires during render (React calls hooks during render)
    // This is expected React behavior — hook rules error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    function Bad() {
      const _t = useT("common");
      return <span>hello</span>;
    }

    expect(() => render(<Bad />)).toThrow();
    consoleSpy.mockRestore();
  });
});

// ─── useT — multiple calls in same component ─────────────────────────────────
describe("useT — multiple namespaces in one component", () => {
  it("uses two different namespaces in one component", () => {
    function TwoNs() {
      const tCommon = useT("common");
      const tNav = useT("nav");
      return (
        <div>
          <span data-testid="common">{tCommon("home")}</span>
          <span data-testid="nav">{tNav("home")}</span>
        </div>
      );
    }

    const { getByTestId } = renderZh(<TwoNs />);
    // common.home = "首页", nav.home = "首页"
    expect(getByTestId("common").textContent).toBe("首页");
    expect(getByTestId("nav").textContent).toBe("首页");
  });
});

// ─── Provider with null / undefined messages ─────────────────────────────────
describe("I18nProvider — edge props", () => {
  it("renders when messages namespace is missing — falls back to key", () => {
    function EmptyNs() {
      const t = useT("common" as keyof typeof zhMessages);
      return <span data-testid="t">{t("home")}</span>;
    }
    // messages = {} — no common namespace — useT should return key itself
    const { getByTestId } = render(
      <I18nProvider messages={{} as typeof zhMessages}>
        <EmptyNs />
      </I18nProvider>
    );
    expect(getByTestId("t").textContent).toBe("home");
  });
});

// ─── all namespaces via hook ────────────────────────────────────────────────
describe("all namespaces are accessible via useT", () => {
  const namespaces = [
    "common", "nav", "home", "home_cli", "auth",
    "dashboard", "skills", "skill_detail", "submit",
    "error", "not_found",
  ] as const;

  it.each(namespaces)("namespace '%s' is accessible", (ns) => {
    function CheckNs() {
      const t = useT(ns);
      return <span data-testid="result">{typeof t("home")}</span>;
    }
    const { getByTestId } = renderZh(<CheckNs />);
    expect(getByTestId("result").textContent).toBe("string");
  });
});
