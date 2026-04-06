#!/usr/bin/env node
// @ts-check

/**
 * Checks: W-PROMPT1~3
 * @module skill/checks/prompts
 */

import { Severity } from '../types.mjs';

/**
 * @param {string} content
 * @returns {Array<import('../types.mjs').LintIssue>}
 */
export function checkPrompts(content) {
  const issues = [];

  // Find all --prompt arguments in bash/code blocks
  const promptRe = /--prompt\s+("([^"]*)"|'([^']*)'|([^\s\n]+))/g;
  let match;
  while ((match = promptRe.exec(content)) !== null) {
    const full = match[0];
    const quoted = match[2] || match[3]; // content inside quotes
    const bare = match[4]; // unquoted arg
    const value = quoted !== undefined ? quoted : bare;
    const lineIdx = content.substring(0, match.index).split('\n').length;
    const lineNo = lineIdx; // 1-based

    // W-PROMPT1: empty prompt
    if (!value || value.trim() === '') {
      issues.push({
        code: 'W-PROMPT1',
        severity: Severity.WARN,
        message: '--prompt 参数为空',
        line: lineNo,
      });
    }

    // W-PROMPT2: CLAWPLAY_TOKEN in prompt (security)
    if (value && /CLAWPLAY_TOKEN/i.test(value)) {
      issues.push({
        code: 'W-PROMPT2',
        severity: Severity.WARN,
        message: '--prompt 中不应包含 CLAWPLAY_TOKEN（Token 不应暴露在 Prompt 中）',
        line: lineNo,
      });
    }
  }

  // W-PROMPT3: clawplay image generate without --quality
  const generateRe = /clawplay\s+image\s+generate/g;
  const hasQualityRe = /--quality\s+\S+/;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (generateRe.test(line) && !hasQualityRe.test(line)) {
      // Check if next few lines contain --quality
      const block = lines.slice(i, Math.min(i + 5, lines.length)).join('\n');
      if (!hasQualityRe.test(block)) {
        issues.push({
          code: 'W-PROMPT3',
          severity: Severity.WARN,
          message: '建议为 --quality 指定分辨率以控制输出大小（如 --quality 2K）',
          line: i + 1,
        });
      }
    }
  }

  return issues;
}
