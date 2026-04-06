#!/usr/bin/env node
// @ts-check

/**
 * ClawPlay Skill Lint — Shared Types
 * @module skill/types
 */

// ---------------------------------------------------------------------------
// Severity levels
// ---------------------------------------------------------------------------
export const Severity = {
  ERROR: 'error', // Lint failed — blocks submission (affects exit code)
  WARN: 'warn',   // Suggestion — does NOT affect exit code
  INFO: 'info',   // Reference info — does NOT affect exit code
};

// ---------------------------------------------------------------------------
// Core data structures
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} LintIssue
 * @property {string} code       - Error code, e.g. E-FM1, W-BASH1, I-PHASE
 * @property {string} severity   - 'error' | 'warn' | 'info'
 * @property {string} message   - Human-readable description
 * @property {number} [line]    - Line number in source file (1-based)
 * @property {string} [phase]   - Associated phase name
 * @property {string} [suggestion] - Suggested fix command
 */

/**
 * @typedef {Object} LintResult
 * @property {string} file
 * @property {boolean} passed    - errors === 0
 * @property {LintIssue[]} results
 * @property {{ errors: number, warnings: number, infos: number }} stats
 */

/**
 * @typedef {Object} PhaseInfo
 * @property {string} name         - Phase name (slug, e.g. 'init')
 * @property {number} line        - Line number where ## Phase {name} appears
 * @property {string[]} outgoing  - Phase names this phase transitions to
 * @property {boolean} isTerminal  - True if this is a terminal state
 * @property {string} condition   - Human-readable condition text (e.g. '目录为空')
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @param {LintResult} result */
export function hasErrors(result) {
  return result.stats.errors > 0;
}

/** @param {LintIssue[]} issues */
export function countBySeverity(issues) {
  return issues.reduce(
    (acc, i) => {
      acc[i.severity === 'error' ? 'errors' : i.severity === 'warn' ? 'warnings' : 'infos']++;
      return acc;
    },
    { errors: 0, warnings: 0, infos: 0 }
  );
}
