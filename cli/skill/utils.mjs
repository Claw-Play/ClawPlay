#!/usr/bin/env node
// @ts-check

/**
 * ClawPlay Skill Lint — Shared Utilities
 * @module skill/utils
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Phase header detection
// Supports: ## Phase {name}  and  ## 状态 {name}
// ---------------------------------------------------------------------------

/**
 * Regex matches phase headers:
 *   ## Phase {name}          (new EN)
 *   ## 状态 {name}          (new ZH)
 *   ## {name} 分支           (legacy)
 * Captures the phase name.
 */
export const PHASE_HEADER_RE = /^##\s+(?:Phase|状态\s+)?([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+分支)?\s*$/gm;

/** Regex matches "→ target_phase: condition text" inside phase content */
const TRANSITION_RE = /→\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^\n]+)/g;

/** Regex matches "Turn 结束" or "→ [*]" (terminal markers) */
const TERMINAL_RE = /Turn\s*结束|→\s*\[\*\]/;

/**
 * Extract all phase headers from SKILL.md content.
 * @param {string} content
 * @returns {Array<{ name: string, line: number }>}
 */
export function extractPhases(content) {
  const phases = [];
  let match;
  PHASE_HEADER_RE.lastIndex = 0;
  while ((match = PHASE_HEADER_RE.exec(content)) !== null) {
    phases.push({ name: match[1], line: match.index });
  }
  return phases;
}

/**
 * Given all phase headers (with their line indices), extract the outgoing
 * transitions for each phase by scanning the text between this header and
 * the next one.
 *
 * @param {string} content
 * @param {Array<{ name: string, line: number }>} phases
 * @returns {Array<{ name: string, line: number, outgoing: string[], conditions: string[], isTerminal: boolean }>}
 */
export function extractPhaseGraph(content, phases) {
  const lines = content.split('\n');
  const result = [];

  for (let i = 0; i < phases.length; i++) {
    const { name, line } = phases[i];
    // Line number is the character index; convert to 0-based line index
    const startLineIdx = content.substring(0, line).split('\n').length - 1;
    const endLineIdx =
      i + 1 < phases.length
        ? content.substring(0, phases[i + 1].line).split('\n').length - 1
        : lines.length;

    const block = lines.slice(startLineIdx, endLineIdx).join('\n');

    // Collect transitions: "→ target_phase: condition text"
    const outgoing = [];
    const conditions = [];
    let tMatch;
    TRANSITION_RE.lastIndex = 0;
    while ((tMatch = TRANSITION_RE.exec(block)) !== null) {
      outgoing.push(tMatch[1]);
      conditions.push(tMatch[2].trim());
    }

    const isTerminal = TERMINAL_RE.test(block) || outgoing.length === 0;

    result.push({ name, line, outgoing, conditions, isTerminal });
  }

  return result;
}

/**
 * Extract all ## Phase / ## 状态 names referenced anywhere in the content
 * (not just headers — transitions also reference phase names).
 * @param {string} content
 * @returns {Set<string>}
 */
export function extractAllPhaseRefs(content) {
  const refs = new Set();
  const re = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    refs.add(m[1]);
  }
  return refs;
}

// ---------------------------------------------------------------------------
// Mermaid extraction
// ---------------------------------------------------------------------------

/**
 * Extract all ```mermaid blocks from the content.
 * @param {string} content
 * @returns {Array<{ type: string, nodes: string[], edges: string[], raw: string }>}
 */
export function extractMermaid(content) {
  const diagrams = [];
  const blockRe = /```mermaid\n?([\s\S]*?)```/gi;
  let match;

  while ((match = blockRe.exec(content)) !== null) {
    const raw = match[1].trim();
    const nodes = [...raw.matchAll(/^\s*([a-zA-Z_][a-zA-Z0-9_]*|\[\*\])\s*$/gm)].map((m) => m[1]);
    const edges = [...raw.matchAll(/-->\s*(?:([a-zA-Z_][a-zA-Z0-9_]*)(\s*:\s*[^\n]+)?)?/g)].map((m) => ({
      from: m[1] || null,
      label: (m[2] || '').trim(),
    }));
    diagrams.push({ type: 'stateDiagram-v2', nodes, edges, raw });
  }

  return diagrams;
}

// ---------------------------------------------------------------------------
// Bash block extraction
// ---------------------------------------------------------------------------

/**
 * Extract all ```bash code blocks with their line numbers.
 * @param {string} content
 * @returns {Array<{ code: string, startLine: number, endLine: number }>}
 */
export function extractBashBlocks(content) {
  const blocks = [];
  const lines = content.split('\n');
  const re = /^```bash\s*$/;

  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      const startLine = i + 1; // 1-based
      const endLineIdx = i + 1;
      let j = i + 1;
      while (j < lines.length && !lines[j].startsWith('```')) j++;
      const code = lines.slice(i + 1, j).join('\n');
      blocks.push({ code, startLine, endLine: j });
      i = j;
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Frontmatter parsing (no external dependencies)
// Supports: inline JSON  { name: "...", ... }
//          and YAML      name: "..."
// ---------------------------------------------------------------------------

/**
 * @param {string} content
 * @returns {Record<string, unknown>}
 */
export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const raw = match[1].trim();

  // Inline JSON format: --- { "name": "..." } ---
  if (raw.startsWith('{')) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  // YAML format
  return parseYamlFrontmatter(raw);
}

/**
 * Minimal YAML frontmatter parser — handles top-level keys and
 * metadata.openclaw.requires structure used by SKILL.md.
 * @param {string} raw
 * @returns {Record<string, unknown>}
 */
function parseYamlFrontmatter(raw) {
  const result = {};
  const lines = raw.split('\n');

  for (const line of lines) {
    // Top-level key:   name: value
    // Nested key:      metadata: { inline json }
    // Depth-2 key:     openclaw: { inline json }
    // Depth-3 key:     requires: { inline json }
    const topRe = /^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/;

    // Check indentation: top-level has no leading whitespace
    if (!line.startsWith(' ')) {
      const m = line.match(topRe);
      if (!m) continue;
      const [, key, rest] = m;
      result[key] = parseYamlValue(rest.trim());
    } else {
      // Indented — determine depth
      const leadingSpaces = line.match(/^(\s*)/)[1].length;
      if (leadingSpaces === 2 || leadingSpaces === 4) {
        const inner = line.trim();
        const m = inner.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
        if (!m) continue;
        const [, key, rest] = m;
        const value = parseYamlValue(rest.trim());

        if (leadingSpaces === 2) {
          // e.g. "  metadata: { ... }"
          if (!result.metadata) result.metadata = {};
          result.metadata[key] = value;
        } else if (leadingSpaces === 4 && result.metadata) {
          // e.g. "    openclaw: { ... }"  inside metadata block
          if (!result.metadata[key]) result.metadata[key] = {};
          result.metadata[key] = { ...result.metadata[key], ...(typeof value === 'object' ? value : {}) };
        }
      }
    }
  }

  return result;
}

/**
 * Parse a YAML scalar value (string, boolean, null, array, inline object).
 * @param {string} raw
 * @returns {unknown}
 */
function parseYamlValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (raw === '') return null;

  // Array: [a, b, c]
  if (raw.startsWith('[')) {
    try {
      return JSON.parse(raw.replace(/'/g, '"'));
    } catch {
      return [];
    }
  }

  // Inline object: { a: b }
  if (raw.startsWith('{')) {
    try {
      return JSON.parse(raw.replace(/'/g, '"'));
    } catch {
      return {};
    }
  }

  // Quoted string
  if (/^["']/.test(raw)) {
    return raw.slice(1, -1);
  }

  return raw;
}

// ---------------------------------------------------------------------------
// File reading
// ---------------------------------------------------------------------------

/**
 * Read a SKILL.md file from disk.
 * @param {string} path
 * @returns {{ content: string, file: string }}
 */
export function readSkillFile(path) {
  const resolved = resolve(path);
  const content = readFileSync(resolved, 'utf-8');
  return { content, file: resolved };
}
