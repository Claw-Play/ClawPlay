#!/usr/bin/env node
// @ts-check

/**
 * Checks: W-BASH1~4
 * @module skill/checks/bash
 */

import { Severity } from '../types.mjs';
import { extractBashBlocks } from '../utils.mjs';

/**
 * @param {string} content
 * @returns {Array<import('../types.mjs').LintIssue>}
 */
export function checkBash(content) {
  const issues = [];
  const blocks = extractBashBlocks(content);

  if (blocks.length === 0) return issues;

  for (const block of blocks) {
    const { code, startLine, endLine } = block;
    const lines = code.split('\n');

    // W-BASH1: missing set -euo pipefail
    if (!/set\s+-euo\s+pipefail/.test(code) && !/set\s+-[a-z]+\s+pipefail/.test(code)) {
      issues.push({
        code: 'W-BASH1',
        severity: Severity.WARN,
        message: '建议在 bash 代码块顶部添加 set -euo pipefail',
        line: startLine,
      });
    }

    // Check each line for patterns
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNo = startLine + i + 1; // 1-based
      const trimmed = line.trim();

      // W-BASH2: file write without mkdir -p
      const writeMatch = trimmed.match(/^(\w+)\s*(?:>|>>)\s*([^&|]+)/);
      if (writeMatch) {
        const targetPath = writeMatch[2].trim();
        // Check if mkdir -p appears before this write
        const precedingCode = lines.slice(0, i).join('\n');
        if (!/mkdir\s+-p/.test(precedingCode) && !targetPath.startsWith('/dev/')) {
          // Only warn for absolute-looking paths or ~ paths
          if (targetPath.startsWith('/') || targetPath.startsWith('~')) {
            issues.push({
              code: 'W-BASH2',
              severity: Severity.WARN,
              message: `写文件 "${targetPath}" 前应先 mkdir -p`,
              line: lineNo,
            });
          }
        }
      }

      // W-BASH3: clawplay output with relative path
      if (/\bclawplay\b.*--output\s+(\S+)/.test(trimmed)) {
        const m = trimmed.match(/--output\s+(\S+)/);
        if (m) {
          const path = m[1];
          if (!path.startsWith('/') && !path.startsWith('$') && !path.startsWith('~')) {
            issues.push({
              code: 'W-BASH3',
              severity: Severity.WARN,
              message: `--output 建议使用绝对路径或 ~ 展开路径，当前：${path}`,
              line: lineNo,
            });
          }
        }
      }

      // W-BASH4: critical command without exit check
      const criticalCmds = ['clawplay', 'curl', 'npm', 'pnpm', 'node'];
      for (const cmd of criticalCmds) {
        const re = new RegExp(`\\b${cmd}\\b(?!\\s*\\|)(?!.*\\|\\|)(?!.*&&)(?!.*;\\s*exit)`);
        if (re.test(trimmed) && !/\|\|/.test(trimmed) && !/&&/.test(trimmed)) {
          // Only warn if it's a statement on its own line (not in a pipe or condition)
          if (/^\s*\S/.test(trimmed) && !/^\s*#/.test(trimmed)) {
            issues.push({
              code: 'W-BASH4',
              severity: Severity.WARN,
              message: `关键命令 "${cmd}" 后建议检查退出码（添加 || exit 1）`,
              line: lineNo,
            });
          }
        }
      }
    }
  }

  return issues;
}
