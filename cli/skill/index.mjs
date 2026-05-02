#!/usr/bin/env node
// @ts-check

/**
 * Skill tool subcommand dispatcher.
 * Usage: clawplay skill <lint|diagram> <path> [--json]
 *
 * @module skill/index
 */

import { t } from './i18n.mjs';

const subcmd = process.argv[2];

if (!subcmd) {
  console.error(t('indexUsage'));
  console.error('');
  for (const line of t('indexCommands')) {
    console.error(line);
  }
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
  console.error(t('indexUnknown', { value: subcmd }));
  console.error(t('indexUsage'));
  process.exit(1);
}
