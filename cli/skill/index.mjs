#!/usr/bin/env node
// @ts-check

/**
 * Skill tool subcommand dispatcher.
 * Usage: clawplay skill <lint|diagram> <path> [--json]
 *
 * @module skill/index
 */

const subcmd = process.argv[2];

if (!subcmd) {
  console.error('Usage: clawplay skill <lint|diagram> <path> [--json]');
  console.error('');
  console.error('Commands:');
  console.error('  lint     检查 SKILL.md 质量（frontmatter、phase、bash、prompt）');
  console.error('  diagram  从 phase 标题生成 Mermaid stateDiagram-v2 代码块');
  process.exit(1);
}

if (subcmd === 'lint') {
  // Remove 'skill' and 'lint' from argv so lint.mjs sees correct path args
  process.argv.splice(0, 3, 'node', 'lint.mjs', ...process.argv.slice(3));
  await import('./lint.mjs');
} else if (subcmd === 'diagram') {
  process.argv.splice(0, 3, 'node', 'diagram.mjs', ...process.argv.slice(3));
  await import('./diagram.mjs');
} else {
  console.error(`❌ Unknown subcommand: ${subcmd}`);
  console.error('Usage: clawplay skill <lint|diagram> <path> [--json]');
  process.exit(1);
}
