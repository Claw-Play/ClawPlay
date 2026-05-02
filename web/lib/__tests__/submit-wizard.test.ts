import { describe, it, expect } from "vitest";
import {
  buildGuideContent,
  parseSkillNameFromMd,
  validateSkillMdFormat,
} from "@/lib/submit-wizard";

describe("validateSkillMdFormat", () => {
  it("returns errors for empty content", () => {
    const result = validateSkillMdFormat("");
    expect(result.errors).toContain("SKILL.md content is empty.");
  });

  it("returns errors for whitespace-only content", () => {
    const result = validateSkillMdFormat("   \n  ");
    expect(result.errors).toContain("SKILL.md content is empty.");
  });

  it("requires frontmatter, name, and description", () => {
    const result = validateSkillMdFormat(`# Title`);
    expect(result.errors).toContain("Missing frontmatter block (`---`). SKILL.md must start with frontmatter.");

    const missingName = validateSkillMdFormat(`---\ndescription: Demo\n---\n# Title`);
    expect(missingName.errors).toContain("Frontmatter is missing the `name` field.");

    const missingDescription = validateSkillMdFormat(`---\nname: Demo\n---\n# Title`);
    expect(missingDescription.errors).toContain("Frontmatter is missing a `description` field.");
  });

  it("detects unclosed frontmatter block", () => {
    const result = validateSkillMdFormat(`---\nname: Demo\ndescription: Demo\n`);
    expect(result.errors).toContain("Frontmatter block is not properly closed (`---`).");
  });

  it("does not warn about Phase or recommended sections anymore", () => {
    const result = validateSkillMdFormat(`---\nname: Demo\ndescription: Demo\n---\n# Title`);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe("parseSkillNameFromMd", () => {
  it("extracts name from valid frontmatter", () => {
    const name = parseSkillNameFromMd(`---\nname: My Skill\ndescription: Cool\n---\n# Content`);
    expect(name).toBe("My Skill");
  });

  it("trims whitespace from name", () => {
    const name = parseSkillNameFromMd(`---\nname:   Spaced Name   \ndescription: Cool\n---\n# Content`);
    expect(name).toBe("Spaced Name");
  });

  it("returns empty string when no frontmatter", () => {
    expect(parseSkillNameFromMd("# No frontmatter")).toBe("");
  });

  it("returns empty string when name field is missing", () => {
    expect(parseSkillNameFromMd(`---\ndescription: Only desc\n---`)).toBe("");
  });
});

describe("buildGuideContent", () => {
  it("handles empty abilities and modules", () => {
    const guide = buildGuideContent([], []);
    expect(guide).toContain("未选择任何能力");
    expect(guide).toContain("未选择任何模块");
    expect(guide).toContain("暂无命令参考");
  });

  it("includes ability-specific sections", () => {
    const guide = buildGuideContent(["image", "vision", "llm"], []);
    expect(guide).toContain("Image 图片生成");
    expect(guide).toContain("Vision 视觉分析");
    expect(guide).toContain("LLM 文本生成");
  });

  it("includes ability commands in reference section", () => {
    const guide = buildGuideContent(["image"], []);
    expect(guide).toContain("clawplay image generate");
  });

  it("includes module sections when selected", () => {
    const guide = buildGuideContent([], ["profile_pack", "starter_examples", "submission_notes"]);
    expect(guide).toContain("Profile Pack");
    expect(guide).toContain("Starter Examples");
    expect(guide).toContain("Submission Notes");
  });

  it("describes Phase and section structure as optional guidance", () => {
    const guide = buildGuideContent(["llm"], ["submission_notes"]);
    expect(guide).toContain("可选补充章节");
    expect(guide).not.toContain("必须包含的章节");
    expect(guide).not.toContain("章节必须按 Phase");
  });
});
