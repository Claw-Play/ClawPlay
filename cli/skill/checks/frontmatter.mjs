#!/usr/bin/env node
// @ts-check

/**
 * Checks: E-FM*, W-FM*, W-DE*
 * @module skill/checks/frontmatter
 */

import { Severity } from '../types.mjs';

/**
 * Check frontmatter fields.
 * @param {string} content - Raw SKILL.md content
 * @param {Record<string, unknown>} fm - Parsed frontmatter
 * @param {boolean} usesClawplay - True if the file contains clawplay commands
 * @returns {Array<import('../types.mjs').LintIssue>}
 */
export function checkFrontmatter(content, fm, usesClawplay = false) {
  const issues = [];

  // E-FM1: name required (used by LLM)
  if (!fm.name) {
    issues.push({
      code: 'E-FM1',
      severity: Severity.ERROR,
      message: "name 字段缺失，LLM 无法识别 Skill 名称",
    });
  }

  // E-FM2: description required (used by LLM)
  if (!fm.description) {
    issues.push({
      code: 'E-FM2',
      severity: Severity.ERROR,
      message: "description 字段缺失，LLM 无法理解 Skill 用途",
    });
  }

  // W-FM3: emoji recommended
  const openclaw = (fm.metadata || {}).openclaw || {};
  if (!openclaw.emoji) {
    issues.push({
      code: 'W-FM3',
      severity: Severity.WARN,
      message: "emoji 字段缺失，目录展示将缺少图标",
    });
  }

  // W-FM4: requires recommended
  if (!openclaw.requires) {
    issues.push({
      code: 'W-FM4',
      severity: Severity.WARN,
      message: "requires 字段缺失，无法告知用户依赖",
    });
  }

  // W-DE1: requires.bins should include clawplay
  const req = openclaw.requires || {};
  const bins = req.bins || [];
  if (usesClawplay && !bins.includes('clawplay')) {
    issues.push({
      code: 'W-DE1',
      severity: Severity.WARN,
      message: 'requires.bins 应包含 "clawplay"（使用 clawplay 命令时）',
    });
  }

  // W-DE2: requires.env should include CLAWPLAY_TOKEN
  const envs = req.env || [];
  if (usesClawplay && !envs.includes('CLAWPLAY_TOKEN')) {
    issues.push({
      code: 'W-DE2',
      severity: Severity.WARN,
      message: 'requires.env 应包含 "CLAWPLAY_TOKEN"（使用 clawplay 命令时）',
    });
  }

  return issues;
}

/**
 * Detect whether this SKILL.md uses clawplay commands (and therefore needs deps).
 * @param {string} content
 * @returns {boolean}
 */
export function usesClawplay(content) {
  return /\bclawplay\b/.test(content);
}
