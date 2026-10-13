#!/usr/bin/env node
// config/equipe-orca.md is the source of truth for the team rules.
// This writes the Grok rules file and the Cursor .mdc (no alwaysApply).
//   node scripts/generate-rules.mjs
//   node scripts/generate-rules.mjs --grok <path> --cursor <path>
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export const CURSOR_DESCRIPTION =
  'Zuuuw team in Orca - how to take calls from the coordinator. Applies only when an ORCA_* environment variable is set.';

export function renderRules(equipeMarkdown) {
  const body = String(equipeMarkdown).replace(/\r/g, '').replace(/\s+$/, '') + '\n';
  const grok = body;
  const cursor = `---\ndescription: ${CURSOR_DESCRIPTION}\n---\n\n${body}`;
  return { grok, cursor };
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

export function writeDerivedRules(grokPath, cursorPath, equipeMarkdown) {
  const { grok, cursor } = renderRules(equipeMarkdown);
  mkdirSync(dirname(grokPath), { recursive: true });
  mkdirSync(dirname(cursorPath), { recursive: true });
  writeFileSync(grokPath, grok);
  writeFileSync(cursorPath, cursor);
}

if (invokedDirectly()) {
  const equipe = readFileSync(join(repoRoot, 'config/equipe-orca.md'), 'utf8');
  writeDerivedRules(
    argValue('--grok') ?? join(repoRoot, 'config/grok-rules-orca-equipe.md'),
    argValue('--cursor') ?? join(repoRoot, 'config/cursor-rules-orca-equipe.mdc'),
    equipe,
  );
}
