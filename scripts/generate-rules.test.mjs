import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderRules } from './generate-rules.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('Grok and Cursor rules are generated from equipe-orca.md', () => {
  const equipe = readFileSync(join(root, 'config/equipe-orca.md'), 'utf8');
  const { grok, cursor } = renderRules(equipe);
  assert.equal(readFileSync(join(root, 'config/grok-rules-orca-equipe.md'), 'utf8'), grok);
  assert.equal(readFileSync(join(root, 'config/cursor-rules-orca-equipe.mdc'), 'utf8'), cursor);
  assert.match(grok, /ORCA_CLI_COMMAND/);
  assert.match(grok, /ORCA_DEV_REPO_ROOT/);
  assert.match(grok, /docker mcp gateway run --profile orca/);
  assert.match(grok, /docker mcp secret set/);
  assert.match(cursor, /^---\ndescription:.*ORCA_\*/);
  assert.doesNotMatch(cursor, /alwaysApply/);
  assert.match(cursor, /docker mcp gateway run --profile orca/);
});
