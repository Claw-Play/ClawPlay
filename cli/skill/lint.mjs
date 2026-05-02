#!/usr/bin/env node
// @ts-check

/**
 * Main lint orchestrator.
 * @module skill/lint
 */

import { readSkillFile, parseFrontmatter } from './utils.mjs';
import { Severity, hasErrors, countBySeverity } from './types.mjs';
import { checkFrontmatter, usesClawplay } from './checks/frontmatter.mjs';
import { checkPhases } from './checks/phases.mjs';
import { checkBash } from './checks/bash.mjs';
import { checkPrompts } from './checks/prompts.mjs';
import { detectLang, t } from './i18n.mjs';

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const filePath = process.argv[2];
if (!filePath) {
  console.error(t('lintUsage'));
  process.exit(1);
}

const isJson = process.argv.includes('--json');

try {
  const { content, file } = readSkillFile(filePath);
  const result = runLint(content, file);

  if (isJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    printReport(result);
  }

  process.exit(hasErrors(result) ? 1 : 0);
} catch (err) {
  if (isJson) {
    process.stdout.write(JSON.stringify({ error: err.message }, null, 2) + '\n');
  } else {
    console.error(t('lintError', { msg: err.message }));
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Lint runner
// ---------------------------------------------------------------------------

/**
 * @param {string} content
 * @param {string} file
 * @returns {import('./types.mjs').LintResult}
 */
export function runLint(content, file) {
  const fm = parseFrontmatter(content);
  const clawplayDetected = usesClawplay(content);

  /** @type {import('./types.mjs').LintIssue[]} */
  const allIssues = [];

  allIssues.push(...checkFrontmatter(content, fm, clawplayDetected));
  allIssues.push(...checkPhases(content, file));
  allIssues.push(...checkBash(content));
  allIssues.push(...checkPrompts(content));

  const stats = countBySeverity(allIssues);

  return {
    file,
    passed: stats.errors === 0,
    results: allIssues,
    stats,
  };
}

// ---------------------------------------------------------------------------
// Formatted output
// ---------------------------------------------------------------------------

/**
 * @param {import('./types.mjs').LintResult} result
 */
function printReport(result) {
  const { file, stats, results } = result;
  const icon = result.passed ? '✅' : '❌';
  const status = result.passed ? 'PASSED' : 'FAILED';

  console.log(`\n${icon} lint ${file}\n`);

  // Group by severity
  const errors = results.filter((i) => i.severity === Severity.ERROR);
  const warnings = results.filter((i) => i.severity === Severity.WARN);
  const infos = results.filter((i) => i.severity === Severity.INFO);

  // Print errors first
  for (const issue of errors) {
    const loc = issue.line ? ` (line ${issue.line})` : issue.phase ? ` [${issue.phase}]` : '';
    console.log(`  ✗ ${issue.code}: ${issue.message}${loc}`);
  }

  // Print warnings
  for (const issue of warnings) {
    const loc = issue.line ? ` (line ${issue.line})` : issue.phase ? ` [${issue.phase}]` : '';
    console.log(`  ⚠ ${issue.code}: ${issue.message}${loc}`);
  }

  // Print infos with suggestions
  for (const issue of infos) {
    const loc = issue.line ? ` (line ${issue.line})` : '';
    if (issue.suggestion) {
      console.log(`  💡 ${issue.code}: ${issue.message}${loc}`);
      console.log(`     → 运行 '${issue.suggestion}' 生成`);
    } else {
      console.log(`  💡 ${issue.code}: ${issue.message}${loc}`);
    }
  }

  if (results.length === 0) {
    console.log('  （无任何问题）');
  }

  console.log(`\n  ${stats.errors} errors, ${stats.warnings} warnings, ${stats.infos} infos`);
  console.log(`  ${icon} ${status}（errors = ${stats.errors}，退出码 ${result.passed ? 0 : 1}）\n`);
}
