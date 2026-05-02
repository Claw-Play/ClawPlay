// @ts-check

/**
 * @typedef {{ value?: string|number, path?: string, msg?: string }} Vars
 * @typedef {"indexUsage"|"indexCommands"|"indexUnknown"|"lintUsage"|"lintError"|"diagramUsage"|"diagramRequiresToken"|"diagramDone"|"diagramSaved"|"diagramTip"} Key
 */

export function detectLang() {
  const locale = `${process.env.CLAWPLAY_LANG ?? ""}${process.env.LANG ?? ""}${process.env.LC_ALL ?? ""}`;
  return /zh/i.test(locale) ? "zh" : "en";
}

/**
 * @param {Key} key
 * @param {Vars} [vars]
 */
export function t(key, vars = {}) {
  const lang = detectLang();
  const text = {
    zh: {
      indexUsage: "用法: clawplay skill <lint|diagram> <path> [--json]",
      indexCommands: [
        "命令:",
        "  lint     检查 SKILL.md 质量（frontmatter、phase、bash、prompt）",
        "  diagram  从 phase 标题生成 Mermaid stateDiagram-v2 代码块",
      ],
      indexUnknown: /** @param {string} subcmd */ (subcmd) => `❌ 未知子命令: ${subcmd}`,
      lintUsage: "用法: clawplay skill lint <path-to-SKILL.md> [--json]",
      lintError: /** @param {string} msg */ (msg) => `❌ lint: ${msg}`,
      diagramUsage: "用法: clawplay skill diagram <path-to-SKILL.md>",
      diagramRequiresToken: "需要 CLAWPLAY_TOKEN（无需额外 API key）。",
      diagramDone: "✅ 已生成 Mermaid 流程图",
      diagramSaved: /** @param {string} path */ (path) => `📄 保存至: ${path}`,
      diagramTip: "提示: 将以下内容复制到 SKILL.md 中即可：",
    },
    en: {
      indexUsage: "Usage: clawplay skill <lint|diagram> <path> [--json]",
      indexCommands: [
        "Commands:",
        "  lint     Check SKILL.md quality (frontmatter, phase, bash, prompt)",
        "  diagram  Generate Mermaid stateDiagram-v2 from phase titles",
      ],
      indexUnknown: /** @param {string} subcmd */ (subcmd) => `❌ Unknown subcommand: ${subcmd}`,
      lintUsage: "Usage: clawplay skill lint <path-to-SKILL.md> [--json]",
      lintError: /** @param {string} msg */ (msg) => `❌ lint: ${msg}`,
      diagramUsage: "Usage: clawplay skill diagram <path-to-SKILL.md>",
      diagramRequiresToken: "Requires CLAWPLAY_TOKEN (no extra API keys needed).",
      diagramDone: "✅ Generated Mermaid diagram",
      diagramSaved: /** @param {string} path */ (path) => `📄 Saved to: ${path}`,
      diagramTip: "Tip: copy the following into SKILL.md:",
    },
  }[lang];

  const value = text[key];
  return typeof value === "function" ? value(String(vars.value ?? vars.path ?? vars.msg ?? "")) : value;
}
