import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './cotas.mjs';
import {
  LEDGER_DEFAULTS,
  appendLedger,
  buildRecord,
  estimateCosts,
  parseLedger,
  pickNext,
  readLedger,
  resolveLedgerPath,
  resolveQuotaBefore,
} from './ledger.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cotasPath = join(here, 'cotas.mjs');
const spreadPath = join(here, 'fixtures/account-spread.json');
const samplePath = join(here, 'fixtures/ledger-sample.jsonl');
const spentPath = join(here, 'fixtures/ledger-cursor-spent.jsonl');

const team = [
  { name: 'claude', status: 'normal', headroom: 70 },
  { name: 'codex', status: 'normal', headroom: 60 },
  { name: 'cursor', status: 'normal', headroom: 90 },
  { name: 'grok', status: 'excluded', headroom: 0 },
  { name: 'antigravity', status: 'normal', headroom: 40 },
  { name: 'muse', status: 'no meter' },
];

test('ledger parser keeps finished tasks and skips broken lines', () => {
  const { rows, skipped } = parseLedger(readFileSync(samplePath, 'utf8'));
  assert.equal(skipped, 2);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].ai, 'cursor');
  assert.equal(rows[0].task, 'T1');
  assert.equal(rows[0].size, 'heavy');
  assert.equal(rows[0].quotaBefore, 10);
  assert.equal(rows[0].quotaAfter, 20);
  assert.equal(rows[0].tokens, 1000);
  assert.equal(rows[2].tokens, undefined);
  assert.equal(readLedger(join(here, 'fixtures/missing-ledger.jsonl')).rows.length, 0);
});

test('ORCA_USAGE_LEDGER overrides the default ledger path', () => {
  assert.equal(resolveLedgerPath({ ORCA_USAGE_LEDGER: '  /tmp/usage.jsonl  ' }, '/home/someone'), '/tmp/usage.jsonl');
  assert.equal(resolveLedgerPath({}, '/home/someone'), '/home/someone/.orca-advanced/usage.jsonl');
});

test('decay estimate weighs the newest task more, and an empty ledger uses defaults', () => {
  const { rows } = parseLedger(readFileSync(samplePath, 'utf8'));
  const costs = estimateCosts(rows, { decay: LEDGER_DEFAULTS.decay });
  // cursor heavy deltas 10 then 2. weights 0.7 and 1 -> (7 + 2) / 1.7
  assert.ok(Math.abs(costs.cursor.heavy.quota - (9 / 1.7)) < 1e-9);
  assert.ok(costs.cursor.heavy.quota < 6);
  assert.equal(costs.cursor.heavy.quotaSamples, 2);
  const tokens = (1000 * 0.7 + 5000) / 1.7;
  assert.ok(Math.abs(costs.cursor.heavy.tokens - tokens) < 1e-9);
  assert.equal(costs.grok.light.quota, 1);
  const empty = estimateCosts([]);
  assert.equal(empty.cursor.heavy.quota, CONFIG.defaultQuotaCost.heavy);
  assert.equal(empty.cursor.heavy.quotaSamples, 0);
  assert.equal(empty.muse.light.quota, LEDGER_DEFAULTS.quotaCost.light);
});

test('quota before falls back to the previous after, then to the live after', () => {
  const { rows } = parseLedger(readFileSync(samplePath, 'utf8'));
  assert.equal(resolveQuotaBefore({ explicit: '4', previousAfter: 22, quotaAfter: 30 }), 4);
  assert.equal(resolveQuotaBefore({ explicit: 0, previousAfter: 22, quotaAfter: 30 }), 0);
  assert.equal(resolveQuotaBefore({ previousAfter: 22, quotaAfter: 30 }), 22);
  assert.equal(resolveQuotaBefore({ quotaAfter: 30 }), 30);
  assert.equal(rows[1].quotaAfter, 22);
});

test('next pick skips an AI out of quota, honors the wave cap, and uses defaults on an empty ledger', () => {
  const empty = estimateCosts([]);
  const open = pickNext({
    agents: team,
    estimates: empty,
    size: 'heavy',
    coordinator: 'claude',
    capPercent: CONFIG.shareCapPercent,
    capMinAgents: CONFIG.shareCapMinAgents,
  });
  assert.equal(open.next, 'cursor');
  assert.deepEqual(open.order, ['cursor', 'codex', 'antigravity']);
  assert.equal(open.order.includes('claude'), false);
  assert.equal(open.order.includes('grok'), false);

  const capped = pickNext({
    agents: team,
    estimates: empty,
    size: 'heavy',
    coordinator: 'claude',
    taken: { cursor: 2, codex: 1, antigravity: 1 },
    capPercent: CONFIG.shareCapPercent,
    capMinAgents: CONFIG.shareCapMinAgents,
  });
  assert.equal(capped.capApplied, true);
  assert.equal(capped.next, 'codex');
  assert.equal(capped.order.includes('cursor'), false);

  const spent = estimateCosts([{ ai: 'cursor', task: 'T0', size: 'heavy', quotaBefore: 0, quotaAfter: 95 }]);
  const pricedOut = pickNext({
    agents: team,
    estimates: spent,
    size: 'heavy',
    coordinator: 'claude',
  });
  assert.equal(pricedOut.order.includes('cursor'), false);
  assert.equal(pricedOut.next, 'codex');
});

test('record appends one JSON line and next rereads it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
  const ledger = join(dir, 'usage.jsonl');
  writeFileSync(ledger, '{"ai":"grok","task":"T0","size":"light","quotaBefore":1,"quotaAfter":2}\n');
  const recorded = spawnSync(process.execPath, [
    cotasPath, 'record',
    '--ai', 'cursor',
    '--task', 'T4',
    '--size', 'heavy',
    '--tokens', '1500',
    '--quota-before', '3',
    '--account', spreadPath,
    '--ledger', ledger,
  ], { encoding: 'utf8' });
  assert.equal(recorded.status, 0, recorded.stderr);
  assert.match(recorded.stdout, /Recorded: cursor T4 heavy quota 3->0 tokens 1500/);
  const text = readFileSync(ledger, 'utf8');
  assert.match(text, /"task":"T0"/);
  const lines = text.trim().split('\n');
  assert.equal(lines.length, 2);
  const row = JSON.parse(lines[1]);
  assert.equal(row.ai, 'cursor');
  assert.equal(row.quotaBefore, 3);
  assert.equal(row.quotaAfter, 0);
  assert.equal(row.tokens, 1500);
  assert.equal(row.task.includes('\n'), false);

  const fresh = join(dir, 'empty.jsonl');
  const first = spawnSync(process.execPath, [
    cotasPath, 'next',
    '--size', 'heavy',
    '--coordinator', 'claude',
    '--account', spreadPath,
    '--ledger', fresh,
  ], { encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /^Next: cursor/m);
  assert.match(first.stdout, /Fallback:/);

  const blocked = spawnSync(process.execPath, [
    cotasPath, 'next',
    '--size', 'heavy',
    '--coordinator', 'claude',
    '--account', spreadPath,
    '--ledger', spentPath,
  ], { encoding: 'utf8' });
  assert.equal(blocked.status, 0, blocked.stderr);
  assert.match(blocked.stdout, /^Next: nobody/m);

  const missing = spawnSync(process.execPath, [cotasPath, 'next', '--size', 'heavy', '--account', spreadPath], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /coordinator/);

  appendLedger(ledger, buildRecord({ ai: 'muse', task: 'T5', size: 'light', quotaBefore: null, quotaAfter: null }));
  assert.equal(readLedger(ledger).rows.at(-1).ai, 'muse');
});
