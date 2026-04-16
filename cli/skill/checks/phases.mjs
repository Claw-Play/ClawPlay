#!/usr/bin/env node
// @ts-check

/**
 * Checks: W-PHASE, W-MM, I-PHASE, I-MERMAID
 * @module skill/checks/phases
 */

import { Severity } from '../types.mjs';
import { extractPhases, extractPhaseGraph, extractMermaid } from '../utils.mjs';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * @param {string} content
 * @param {string} [filePath]
 * @returns {Array<import('../types.mjs').LintIssue>}
 */
export function checkPhases(content, filePath) {
  const issues = [];
  const phases = extractPhases(content);
  const graph = extractPhaseGraph(content, phases);
  const diagrams = extractMermaid(content);

  // Check if references/workflow.md exists (alternative to inline Mermaid)
  let hasWorkflowMd = false;
  if (filePath) {
    const refPath = dirname(filePath) + '/references/workflow.md';
    hasWorkflowMd = existsSync(refPath);
  }

  // I-MERMAID: detected mermaid diagram
  if (diagrams.length > 0) {
    issues.push({
      code: 'I-MERMAID',
      severity: Severity.INFO,
      message: `检测到 ${diagrams.length} 个 Mermaid 流程图`,
    });
  } else if (hasWorkflowMd) {
    issues.push({
      code: 'I-MERMAID',
      severity: Severity.INFO,
      message: '检测到 references/workflow.md（Mermaid 流程图位于独立文件）',
    });
  }

  if (phases.length === 0) {
    // No phases detected — skip phase-specific checks
    return issues;
  }

  const phaseNames = new Set(phases.map((p) => p.name));

  // I-PHASE: phase count info
  const diagramSuggestion = hasWorkflowMd
    ? '确保 references/workflow.md 包含完整状态流转图'
    : 'clawplay skill diagram <path>';
  issues.push({
    code: 'I-PHASE',
    severity: Severity.INFO,
    message: `检测到 ${phases.length} 个 phase`,
    suggestion: phases.length >= 3 ? diagramSuggestion : undefined,
  });

  // W-PHASE: check for init entry phase
  if (!phaseNames.has('init')) {
    issues.push({
      code: 'W-PHASE',
      severity: Severity.WARN,
      message: '建议包含 init 入口阶段（## Phase init）',
      suggestion: hasWorkflowMd ? '更新 references/workflow.md 添加 init 节点' : 'clawplay skill diagram <path>',
    });
  }

  // W-PHASE: check for at least one terminal state
  const hasTerminal = graph.some((p) => p.isTerminal);
  if (!hasTerminal) {
    issues.push({
      code: 'W-PHASE',
      severity: Severity.WARN,
      message: '未检测到终态（缺少 "Turn 结束" 或 "→ [*]" 标记）',
      suggestion: hasWorkflowMd ? '更新 references/workflow.md 添加终态' : 'clawplay skill diagram <path>',
    });
  }

  // W-PHASE: suggest mermaid if phase count >= 3 and no diagram (and no references/workflow.md)
  if (phases.length >= 3 && diagrams.length === 0 && !hasWorkflowMd) {
    issues.push({
      code: 'W-PHASE',
      severity: Severity.WARN,
      message: `检测到 ${phases.length} 个 phase，建议添加 Mermaid 流程图提升 Agent 理解准确性`,
      suggestion: 'clawplay skill diagram <path>',
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
  allRefs.add('init'); // init is the entry point

  for (const p of phases) {
    if (!allRefs.has(p.name) && p.name !== 'init') {
      issues.push({
        code: 'W-PHASE',
        severity: Severity.WARN,
        message: `phase "${p.name}" 未被其他 phase 引用，可能是孤立状态`,
        phase: p.name,
        line: p.line + 1,
        suggestion: hasWorkflowMd ? '更新 references/workflow.md 中的节点引用' : 'clawplay skill diagram <path>',
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
