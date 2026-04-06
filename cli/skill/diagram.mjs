#!/usr/bin/env node
// @ts-check

/**
 * Mermaid stateDiagram-v2 generator from SKILL.md.
 * Uses LLM via `clawplay llm generate` (no extra API keys needed).
 *
 * CLI usage: clawplay skill diagram <path-to-SKILL.md>
 * Requires: CLAWPLAY_TOKEN (no additional API keys)
 *
 * Module usage: import { generateDiagram } from './diagram.mjs'
 *
 * @module skill/diagram
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: clawplay skill diagram <path-to-SKILL.md>');
    console.error('');
    console.error('Requires CLAWPLAY_TOKEN (no extra API keys needed).');
    process.exit(1);
  }

  try {
    const resolved = resolve(filePath);
    const { content } = readSkillFile(resolved);
    const outputPath = await generateDiagram(content, resolved);
    console.log('');
    console.log('✅ 已生成 Mermaid 流程图');
    console.log(`📄 保存至: ${outputPath}`);
    console.log('');
    console.log('提示: 将以下内容复制到 SKILL.md 中即可：');
    console.log('---8<---');
    const saved = readFileSync(outputPath, 'utf-8');
    console.log(saved);
    console.log('---8<---');
  } catch (err) {
    console.error(`❌ diagram: ${err.message}`);
    process.exit(1);
  }
}

// Run only if this is the main module
if (process.argv[1]?.endsWith('diagram.mjs')) {
  main();
}

// ---------------------------------------------------------------------------
// File utilities
// ---------------------------------------------------------------------------

/** @param {string} path */
function readSkillFile(path) {
  return { content: readFileSync(path, 'utf-8'), file: path };
}

// ---------------------------------------------------------------------------
// Phase extraction (supports new + legacy formats)
// ---------------------------------------------------------------------------

/**
 * @param {string} content
 * @returns {Array<{ name: string, startLine: number, content: string }>}
 */
function extractPhaseSections(content) {
  const lines = content.split('\n');
  const sections = [];

  // New: ## Phase {name} or ## 状态 {name}
  const newRe = /^##\s+(?:Phase|状态)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/;
  // Legacy: ## {name} 分支
  const legacyRe = /^##\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+分支\s*$/;

  let currentPhase = null;
  let currentStartLine = 0;
  let currentLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(newRe) || line.match(legacyRe);

    if (m) {
      if (currentPhase !== null) {
        sections.push({ name: currentPhase, startLine: currentStartLine, content: currentLines.join('\n').trim() });
      }
      currentPhase = m[1];
      currentStartLine = i + 1;
      currentLines = [];
    } else if (currentPhase !== null) {
      currentLines.push(line);
    }
  }

  if (currentPhase !== null) {
    sections.push({ name: currentPhase, startLine: currentStartLine, content: currentLines.join('\n').trim() });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Call clawplay llm generate
// ---------------------------------------------------------------------------

/**
 * @param {string} prompt
 * @returns {string} - Raw LLM text output
 */
function callLLMGenerate(prompt) {
  // Escape double quotes for shell
  const escapedPrompt = prompt.replace(/"/g, '\\"');
  try {
    const result = execSync(`clawplay llm generate --prompt "${escapedPrompt}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (err) {
    const stderr = err.stderr ?? '';
    if (stderr.includes('CLAWPLAY_TOKEN')) {
      throw new Error('CLAWPLAY_TOKEN 未设置。请运行：clawplay setup');
    }
    throw new Error(`LLM 调用失败: ${stderr || err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Mermaid extraction + validation
// ---------------------------------------------------------------------------

/**
 * @param {string} raw - Raw LLM output
 * @returns {string} - Cleaned ```mermaid block
 */
function extractMermaidBlock(raw) {
  const match = raw.match(/```mermaid\n?([\s\S]*?)```/);
  if (!match) {
    throw new Error('LLM 未返回有效的 Mermaid 代码块，请重试');
  }

  let diagram = match[1].trim();

  // Ensure stateDiagram-v2
  if (!diagram.startsWith('stateDiagram-v2')) {
    diagram = 'stateDiagram-v2\n' + diagram;
  }

  // Ensure entry node exists
  if (!/\[\\*]\s*-->/.test(diagram)) {
    throw new Error('LLM 输出缺少入口节点 [*] -->，请重试');
  }

  // Clean: strip text descriptions from state node definitions
  const lines = diagram.split('\n');
  const cleaned = lines.map((line) => {
    const t = line.trim();
    if (
      t === '' ||
      t.startsWith('stateDiagram-v2') ||
      t.startsWith('--') ||
      t.startsWith('note for')
    ) {
      return line;
    }
    // state_node: description → strip description
    return line.replace(/\s*:\s*[^\n-]+(\s*-->.*)?$/, '$1');
  });

  return '```mermaid\n' + cleaned.join('\n') + '\n```';
}

// ---------------------------------------------------------------------------
// Core diagram generator
// ---------------------------------------------------------------------------

/**
 * Generate Mermaid and save to {skillDir}/references/workflow.md.
 * @param {string} content - SKILL.md content
 * @param {string} skillFilePath - Absolute path to SKILL.md
 * @returns {Promise<string>} - Output file path
 */
export async function generateDiagram(content, skillFilePath) {
  const sections = extractPhaseSections(content);

  if (sections.length === 0) {
    throw new Error('未检测到任何 phase（## Phase {name} / ## 状态 {name}），无法生成流程图');
  }

  // Build LLM prompt
  const phaseBlocks = sections
    .map((s) => `## Phase ${s.name} (line ${s.startLine})\n${s.content}`)
    .join('\n\n');

  const prompt = [
    '你是一个 Skill 流程图生成专家。请根据以下 SKILL.md 文档中的 phase 定义，生成 Mermaid stateDiagram-v2 格式的状态机流程图。',
    '',
    '## 规则（必须严格遵守）',
    '',
    '1. 入口节点: [*] --> {第一个 phase 名称}',
    '2. 终态节点: {phase_name} --> [*]',
    '3. 状态节点: 只写 phase ID（slug 格式，如 init，awaiting_desc），不要在节点内写文字描述',
    '4. 边（Transition）: 所有边都加条件标签，格式为 phase_a --> phase_b: 条件说明',
    '5. 唯一入口: 确保图有且只有一个入口 [*] -->',
    '6. 连通性: 每个节点（除终态外）至少有一条出边',
    '7. 不要重复边: 相同起点和终点的边不要出现多次',
    '',
    '## Phase 定义',
    '',
    phaseBlocks,
    '',
    '## 输出要求',
    '',
    '只输出 ```mermaid 代码块，不要输出任何解释文字。',
  ].join('\n');

  // Call LLM via clawplay relay
  const rawOutput = callLLMGenerate(prompt);

  // Validate and extract mermaid block
  const mermaid = extractMermaidBlock(rawOutput);

  // Write to references/workflow.md
  const skillDir = dirname(skillFilePath);
  const outputDir = join(skillDir, 'references');
  const outputPath = join(outputDir, 'workflow.md');

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, mermaid, 'utf-8');

  return outputPath;
}
