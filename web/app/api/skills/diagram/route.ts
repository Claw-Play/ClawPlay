import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { extractPhaseDescriptions } from "@cli/skill/diagram.mjs";

// ---------------------------------------------------------------------------
// Inline helpers from diagram.mjs (not exported)
// ---------------------------------------------------------------------------

/**
 * @param {string} content
 * @returns {Array<{ name: string, startLine: number, content: string }>}
 */
function extractPhaseSections(content: string) {
  const lines = content.split("\n");
  const sections = [];
  const newRe = /^##\s+(?:Phase|状态)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/;
  const legacyRe = /^##\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+分支\s*$/;

  let currentPhase = null;
  let currentStartLine = 0;
  let currentLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(newRe) || line.match(legacyRe);
    if (m) {
      if (currentPhase !== null) {
        sections.push({
          name: currentPhase,
          startLine: currentStartLine,
          content: currentLines.join("\n").trim(),
        });
      }
      currentPhase = m[1];
      currentStartLine = i + 1;
      currentLines = [];
    } else if (currentPhase !== null) {
      currentLines.push(line);
    }
  }

  if (currentPhase !== null) {
    sections.push({
      name: currentPhase,
      startLine: currentStartLine,
      content: currentLines.join("\n").trim(),
    });
  }

  return sections;
}

/** Error codes thrown by parseMermaidBlock */
type BlockErrorCode = "no_block" | "empty_block" | "no_entry_node";

/**
 * @param {string} raw
 * @returns {{ mermaid: string } | never}
 * @throws {{ code: BlockErrorCode }} on parse failure
 */
function parseMermaidBlock(raw: string): { mermaid: string } {
  // Try both with and without newline after the language tag
  let match = raw.match(/```mermaid\n([\s\S]*?)```/);
  if (!match) {
    match = raw.match(/```mermaid\s+([\s\S]*?)```/);
  }
  if (!match) {
    throw { code: "no_block" as BlockErrorCode };
  }

  // Strip the opening ```mermaid (and any trailing whitespace) from the captured content
  let diagram = match[1]
    .replace(/^mermaid\s*/, "") // remove "mermaid" followed by whitespace on first line
    .trim();

  if (!diagram) {
    throw { code: "empty_block" as BlockErrorCode };
  }

  if (!diagram.startsWith("stateDiagram-v2")) {
    diagram = "stateDiagram-v2\n" + diagram;
  } else {
    // LLM already included stateDiagram-v2 — deduplicate if it appears again
    diagram = diagram.replace(/^stateDiagram-v2\r?\n/, "");
    diagram = "stateDiagram-v2\n" + diagram;
  }

  if (!/\[*]\s*-->/.test(diagram)) {
    throw { code: "no_entry_node" as BlockErrorCode };
  }

  const lines = diagram.split("\n");
  const cleaned = lines
    .map((line) => {
      const t = line.trim();
      if (
        t === "" ||
        t.startsWith("stateDiagram-v2") ||
        t.startsWith("note for")
      ) {
        return line;
      }
      if (!t.includes("-->") && t.includes(":")) {
        return "    ";
      }
      return line.trimEnd();
    })
    .filter((line) => line.trim() !== "");

  return { mermaid: "```mermaid\n" + cleaned.join("\n") + "\n```" };
}

// ---------------------------------------------------------------------------
// POST /api/skills/diagram
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { skillMdContent } = await request.json();
  if (!skillMdContent || typeof skillMdContent !== "string") {
    return NextResponse.json(
      { error: "skillMdContent is required" },
      { status: 400 }
    );
  }

  const t = await getT("submit");

  try {
    const sections = extractPhaseSections(skillMdContent);
    if (sections.length === 0) {
      return NextResponse.json(
        { error: t("diagram_no_phases") },
        { status: 422 }
      );
    }

    const phaseDescriptions = extractPhaseDescriptions(skillMdContent);
    const descTable =
      Array.from(phaseDescriptions.entries())
        .map(([name, desc]) => `  - ${name}: ${desc}`)
        .join("\n") || "  (无描述，请从 phase 内容中推断)";

    const phaseBlocks = sections
      .map((s) => `## Phase ${s.name} (line ${s.startLine})\n${s.content}`)
      .join("\n\n");

    const prompt = [
      "你是一个 Skill 流程图生成专家。请根据以下 SKILL.md 文档中的 phase 定义，生成 Mermaid stateDiagram-v2 格式的状态机流程图。",
      "",
      "## Phase 状态含义参考（用于生成边的条件说明）",
      "",
      descTable,
      "",
      "## 规则（必须严格遵守）",
      "",
      "1. 入口节点: [*] --> {第一个 phase 名称}",
      "2. 终态节点: {phase_name} --> [*]",
      "3. 状态节点: 只写 phase ID（slug 格式，如 init，awaiting_desc），不写任何描述文字",
      "4. 边（Transition）: 所有边都加条件标签，格式为 `phase_a --> phase_b : 条件说明`；条件说明参考上面的 Phase 状态含义",
      "5. 唯一入口: 确保图有且只有一个入口 [*] -->",
      "6. 连通性: 每个节点（除终态外）至少有一条出边",
      "7. 不要重复边: 相同起点和终点的边不要出现多次",
      "",
      "## Phase 定义",
      "",
      phaseBlocks,
      "",
      "## 输出要求",
      "",
      "只输出 ```mermaid 代码块，不要输出任何解释文字。",
    ].join("\n");

    // Call relay via fetch (no exec)
    const apiUrl =
      process.env.CLAWPLAY_API_URL ||
      (request.nextUrl.protocol === "https:"
        ? "https://" + request.headers.get("host")
        : "http://localhost:3000");

    const res = await fetch(`${apiUrl}/api/ability/llm/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CLAWPLAY_TOKEN}`,
      },
      body: JSON.stringify({ prompt, maxTokens: 800, temperature: 0.3 }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `LLM 调用失败: ${err}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 502 });
    }

    const raw = data.text?.trim();
    if (!raw) {
      return NextResponse.json(
        { error: t("diagram_llm_empty") },
        { status: 502 }
      );
    }

    let mermaid: string;
    try {
      mermaid = parseMermaidBlock(raw).mermaid;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "no_block") {
        return NextResponse.json({ error: t("diagram_no_block") }, { status: 500 });
      }
      if (code === "empty_block") {
        return NextResponse.json({ error: t("diagram_empty_block") }, { status: 500 });
      }
      if (code === "no_entry_node") {
        return NextResponse.json({ error: t("diagram_no_entry_node") }, { status: 500 });
      }
      throw err;
    }

    return NextResponse.json({ mermaid });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
