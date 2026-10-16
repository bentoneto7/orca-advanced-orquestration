import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENTS, buildReport, parseRateLimits, pickSuccessor } from './cotas.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cotasPath = join(here, 'cotas.mjs');
const spreadPath = join(here, 'fixtures/account-spread.json');
const thinPath = join(here, 'fixtures/account-thin.json');
const NOW = 1_700_000_000_000;
const agentsFrom = (path) => buildReport(parseRateLimits(readFileSync(path, 'utf8')), NOW).agents;

test('without a user choice, the successor is the metered AI with the best status and most headroom', () => {
  const s = pickSuccessor(agentsFrom(spreadPath), { outgoing: 'claude' });
  assert.equal(s.successor, 'cursor');
  assert.equal(s.reason, 'most headroom');
  assert.ok(!s.alternatives.includes('claude'), 'the outgoing coordinator is never suggested');
  assert.equal(s.alternatives.at(-1), 'muse', 'muse has no meter and is the last resort');
});

test('the user choice always wins, for any of the six AIs', () => {
  const agents = agentsFrom(spreadPath);
  for (const name of AGENTS) {
    const s = pickSuccessor(agents, { outgoing: name === 'claude' ? 'codex' : 'claude', requested: name });
    assert.equal(s.successor, name);
    assert.equal(s.reason, 'user choice');
  }
});

test('a chosen AI without quota is still promoted, with a warning', () => {
  const agents = agentsFrom(thinPath);
  const s = pickSuccessor(agents, { outgoing: 'claude', requested: 'codex' });
  assert.equal(s.successor, 'codex');
  assert.match(s.warnings.join(' '), /no quota until/);
});

test('only claude and codex keep the browser; others get the Chrome warning', () => {
  const agents = agentsFrom(spreadPath);
  assert.ok(!pickSuccessor(agents, { requested: 'codex' }).warnings.some((w) => /Chrome/.test(w)));
  assert.ok(pickSuccessor(agents, { requested: 'grok' }).warnings.some((w) => /Chrome/.test(w)));
});

test('unknown agent names are rejected', () => {
  assert.throws(() => pickSuccessor(agentsFrom(spreadPath), { requested: 'gpt' }), /must be one of/);
  const bad = spawnSync(process.execPath, [cotasPath, 'successor', '--account', spreadPath, '--to', 'gpt'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
});

test('the snapshot prints a Successor line and the subcommand honours --to', () => {
  const snap = spawnSync(process.execPath, [cotasPath, spreadPath], { encoding: 'utf8' });
  assert.match(snap.stdout, /^Successor: cursor \| then /m);
  const chosen = spawnSync(process.execPath, [cotasPath, 'successor', '--account', spreadPath, '--from', 'claude', '--to', 'muse'], { encoding: 'utf8' });
  assert.equal(chosen.status, 0, chosen.stderr);
  assert.match(chosen.stdout, /^Successor: muse \(user choice/m);
});
