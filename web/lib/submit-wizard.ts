// ── Types ──────────────────────────────────────────────────────────────────

export type ComposeAbility = "image" | "llm" | "vision";
export type ComposeModule = "profile_pack" | "starter_examples" | "submission_notes";

// ── Metadata ──────────────────────────────────────────────────────────────

export const ABILITY_META: Record<ComposeAbility, { title: string; description: string; command: string }> = {
  image: {
    title: "IMAGE",
    description: "Generate reference art, avatar variations, or visual deliverables for the Skill.",
    command: "`clawplay image generate`",
  },
  llm: {
    title: "LLM",
    description: "Write summaries, structured outputs, prompts, and user-facing copy.",
    command: "`clawplay llm generate`",
  },
  vision: {
    title: "VISION",
    description: "Inspect screenshots or user photos and turn them into structured inputs.",
    command: "`clawplay vision analyze`",
  },
};

export const MODULE_META: Record<ComposeModule, { title: string; description: string }> = {
  profile_pack: {
    title: "Profile Pack",
    description: "Collect profile fields and stage confirmations before writing final artifacts.",
  },
  starter_examples: {
    title: "Starter Examples",
    description: "Embed example prompts and expected outputs so creators can start faster.",
  },
  submission_notes: {
    title: "Submission Notes",
    description: "Add authoring notes, constraints, and review-ready guidance to the draft.",
  },
};

// ── Guide Builder ──────────────────────────────────────────────────────────

export function buildGuideContent(
  abilities: ComposeAbility[],
  modules: ComposeModule[],
): string {
  const sections: string[] = [];

  // ── Section 1: Selected Abilities ──────────────────────────────────────
  sections.push("=== 选中的平台能力 (Platform Abilities) ===\n");
  if (abilities.length === 0) {
    sections.push("（未选择任何能力）\n");
  } else {
    for (const ability of abilities) {
      const meta = ABILITY_META[ability];
      sections.push(`【${meta.title}】`);
      sections.push(`  说明：${meta.description}`);
      sections.push(`  命令：${meta.command}`);
      sections.push("");
    }
  }

  // ── Section 2: Selected Modules ────────────────────────────────────────
  sections.push("=== 选中的支撑模块 (Support Modules) ===\n");
  if (modules.length === 0) {
    sections.push("（未选择任何模块）\n");
  } else {
    for (const mod of modules) {
      const meta = MODULE_META[mod];
      sections.push(`【${meta.title}】`);
      sections.push(`  说明：${meta.description}`);
      sections.push("");
    }
  }

  // ── Section 3: SKILL.md Format Guide ───────────────────────────────────
  sections.push("=== SKILL.md 文档格式约束 ===\n");
  sections.push("1. Frontmatter 必需字段：");
  sections.push("   - name: Skill 名称");
  sections.push("   - description: 简要描述");
  sections.push("   - metadata.clawdbot.emoji: 图标 emoji");
  sections.push("   - metadata.clawdbot.requires.bins: 依赖的命令列表");
  sections.push("");
  sections.push("2. 章节结构建议：");
  sections.push("   - 如果你的 Skill 有明显状态流转，可用 `## Phase {name}` 组织内容");
  sections.push("   - Phase 名称建议使用 snake_case（如 init、awaiting_input）");
  sections.push("   - Mermaid 流程图可以辅助说明状态，但不是硬性要求");
  sections.push("");
  sections.push("3. 可选补充章节：");
  sections.push("   - ## When to Use（使用场景）");
  sections.push("   - ## Workflow（工作流步骤）");
  sections.push("   - ## Commands（CLI 命令说明）");
  sections.push("   - ## Notes（补充说明）");
  sections.push("   - ## Flow（Mermaid 状态机图，可选）");
  sections.push("");

  // ── Section 4: CLI Command Reference ───────────────────────────────────
  sections.push("=== CLI 命令参考 ===\n");
  if (abilities.length === 0) {
    sections.push("（未选择能力，暂无命令参考）\n");
  } else {
    for (const ability of abilities) {
      const meta = ABILITY_META[ability];
      sections.push(`- ${meta.command}：${meta.description}`);
    }
    sections.push("");
  }

  // ── Section 5: Best Practices ──────────────────────────────────────────
  sections.push("=== 多模态最佳实践提示 ===\n");
  if (abilities.includes("image")) {
    sections.push("【Image 图片生成】");
    sections.push("  - 明确指定图片风格（写实、卡通、像素等）");
    sections.push("  - 提供参考图或详细文字描述");
    sections.push("  - 指定输出尺寸和格式要求");
    sections.push("");
  }
  if (abilities.includes("vision")) {
    sections.push("【Vision 视觉分析】");
    sections.push("  - 明确告知用户需要提供截图或照片");
    sections.push("  - 结构化的输出格式（JSON/表格）");
    sections.push("  - 对输入图片进行前置校验（格式、大小）");
    sections.push("");
  }
  if (abilities.includes("llm")) {
    sections.push("【LLM 文本生成】");
    sections.push("  - 使用清晰的 system prompt 约束输出格式");
    sections.push("  - 分步骤引导用户提供信息");
    sections.push("  - 输出结构化内容便于后续处理");
    sections.push("");
  }

  // ── Section 6: Directory Structure ─────────────────────────────────────
  sections.push("=== 电子档案目录结构 ===\n");
  sections.push("建议的 Skill 仓库目录结构：");
  sections.push("  your-skill/");
  sections.push("  ├── SKILL.md           # 主描述文件");
  sections.push("  ├── references/        # 参考材料（可选）");
  sections.push("  │   └── workflow.md    # 工作流文档");
  sections.push("  └── assets/            # 静态资源（可选）");
  sections.push("      └── diagram.png    # 流程图截图");
  sections.push("");

  // ── Section 7: Minimum Valid Set Rules ─────────────────────────────────
  sections.push("=== 状态机最小有效集规则 ===\n");
  sections.push("1. 必须至少有一个入口节点：`[*] --> {phase_name}`");
  sections.push("2. 必须至少有一个出口节点：`{phase_name} --> [*]`");
  sections.push("3. 每个非终态节点必须至少有一条出边");
  sections.push("4. 禁止重复边（相同起点和终点的边不能出现多次）");
  sections.push("5. 状态节点名称必须与 Phase 名称一致");
  sections.push("6. 边必须有条件标签（`: 条件说明`）");
  sections.push("");

  return sections.join("\n");
}

// ── Format Validation ──────────────────────────────────────────────────────

export interface SkillMdValidation {
  errors: string[];
  warnings: string[];
}

/**
 * Lightweight client-side format validation for SKILL.md content.
 * Checks only the minimal required frontmatter structure.
 * Reused by both Step 3 (instant client check) and /api/skills/validate.
 */
export function validateSkillMdFormat(content: string): SkillMdValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || !content.trim()) {
    errors.push("SKILL.md content is empty.");
    return { errors, warnings };
  }

  // ── Frontmatter ────────────────────────────────────────────────────────
  const hasFrontmatter = /^---\s*\n/.test(content);
  if (!hasFrontmatter) {
    errors.push("Missing frontmatter block (`---`). SKILL.md must start with frontmatter.");
  } else {
    // Try to find a name field in frontmatter
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (match) {
      const fm = match[1];
      if (!/^name:\s*./m.test(fm)) {
        errors.push("Frontmatter is missing the `name` field.");
      }
      if (!/^description:\s*./m.test(fm)) {
        errors.push("Frontmatter is missing a `description` field.");
      }
    } else {
      errors.push("Frontmatter block is not properly closed (`---`).");
    }
  }

  return { errors, warnings };
}

/**
 * Extract the `name` field from SKILL.md frontmatter.
 * Returns the parsed name, or empty string if not found.
 */
export function parseSkillNameFromMd(content: string): string {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return "";
  const fm = match[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  return nameMatch ? nameMatch[1].trim() : "";
}
