#!/usr/bin/env node
// @ts-check

/**
 * Checks: W-PHASE, W-MM, I-PHASE, I-MERMAID
 * @module skill/checks/phases
 */

import { Severity } from '../types.mjs';
import { extractPhases, extractPhaseGraph, extractMermaid } from '../utils.mjs';

/**
 * @param {string} content
 * @returns {Array<import('../types.mjs').LintIssue>}
 */
export function checkPhases(content) {
  const issues = [];
  const phases = extractPhases(content);
  const graph = extractPhaseGraph(content, phases);
  const diagrams = extractMermaid(content);

  // I-MERMAID: detected mermaid diagram
  if (diagrams.length > 0) {
    issues.push({
      code: 'I-MERMAID',
      severity: Severity.INFO,
      message: `检测到 ${diagrams.length} 个 Mermaid 流程图`,
    });
  }

  if (phases.length === 0) {
    // No phases detected — skip phase-specific checks
    return issues;
  }

  // I-PHASE: phase count info
  issues.push({
    code: 'I-PHASE',
    severity: Severity.INFO,
    message: `检测到 ${phases.length} 个 phase`,
    suggestion: phases.length >= 3 ? 'clawplay skill diagram <path>' : undefined,
  });

  // W-PHASE: check for init entry phase
  const phaseNames = new Set(phases.map((p) => p.name));
  if (!phaseNames.has('init')) {
    issues.push({
      code: 'W-PHASE',
      severity: Severity.WARN,
      message: '建议包含 init 入口阶段（## Phase init）',
      suggestion: 'clawplay skill diagram <path>',
    });
  }

  // W-PHASE: check for at least one terminal state
  const hasTerminal = graph.some((p) => p.isTerminal);
  if (!hasTerminal) {
    issues.push({
      code: 'W-PHASE',
      severity: Severity.WARN,
      message: '未检测到终态（缺少 "Turn 结束" 或 "→ [*]" 标记）',
      suggestion: 'clawplay skill diagram <path>',
    });
  }

  // W-PHASE: suggest mermaid if phase count >= 3 and no diagram
  if (phases.length >= 3 && diagrams.length === 0) {
    issues.push({
      code: 'W-PHASE',
      severity: Severity.WARN,
      message: `检测到 ${phases.length} 个 phase，建议添加 Mermaid 流程图提升 Agent 理解准确性`,
      suggestion: `clawplay skill diagram <path>`,
    });
  }

  // W-PHASE: isolated phases (referenced nowhere)
  const allRefs = new Set();
  for (const p of graph) {
    for (const target of p.outgoing) allRefs.add(target);
  }
  for (const p of graph) {
    if (p.isTerminal) allRefs.add(p.name);
  }
  // Also mark init as referenced (it's the entry point)
  allRefs.add('init');

  for (const p of phases) {
    if (!allRefs.has(p.name) && p.name !== 'init') {
      issues.push({
        code: 'W-PHASE',
        severity: Severity.WARN,
        message: `phase "${p.name}" 未被其他 phase 引用，可能是孤立状态`,
        phase: p.name,
        line: p.line + 1, // convert char index to 1-based line
        suggestion: 'clawplay skill diagram <path>',
      });
    }
  }

  // W-MM: Mermaid node ↔ phase header consistency
  if (diagrams.length > 0) {
    const mermaidNodes = new Set();
    for (const d of diagrams) {
      for (const n of d.nodes) {
        if (n !== '[*]') mermaidNodes.add(n);
      }
    }

    for (const node of mermaidNodes) {
      if (!phaseNames.has(node)) {
        issues.push({
          code: 'W-MM',
          severity: Severity.WARN,
          message: `Mermaid 图中的节点 [${node}] 在文档中未找到对应 phase`,
          suggestion: 'clawplay skill diagram <path>',
        });
      }
    }

    for (const p of phases) {
      if (!mermaidNodes.has(p.name)) {
        issues.push({
          code: 'W-MM',
          severity: Severity.WARN,
          message: `phase "${p.name}" 在 Mermaid 图中未找到对应节点`,
          line: p.line + 1,
          suggestion: 'clawplay skill diagram <path>',
        });
      }
    }

    // W-MM: disconnected nodes in mermaid
    const mermaidEdgeTargets = new Set();
    for (const d of diagrams) {
      for (const e of d.edges) {
        if (e.from) mermaidEdgeTargets.add(e.from);
      }
    }
    const orphaned = [...mermaidNodes].filter(
      (n) => !mermaidEdgeTargets.has(n) && n !== '[*]' && !mermaidNodes.has(n)
    );
    if (orphaned.length > 0) {
      issues.push({
        code: 'W-MM',
        severity: Severity.WARN,
        message: `Mermaid 图检测到 ${orphaned.length} 个孤立节点，请检查连通性`,
        suggestion: 'clawplay skill diagram <path>',
      });
    }
  }

  return issues;
}
