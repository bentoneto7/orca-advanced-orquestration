import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWN_AIS, SIZE_CLASSES } from './ledger.mjs';
import {
  BUNDLED_MODELS_PATH,
  chooseModel,
  classifyTier,
  escalateTier,
  estimateModelCosts,
  loadModels,
  renderArgs,
  resolveModel,
  resolveModelsPath,
} from './models.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cotasPath = join(here, 'cotas.mjs');
const spreadPath = join(here, 'fixtures/account-spread.json');

const table = {
  success: { minRate: 0.8, minSamples: 3 },
  agents: {
    cursor: {
      argv: ['--model', '{model}'],
      tiers: {
        light: { model: 'small', effort: 'low', cost: 1 },
        medium: { model: 'mid', effort: 'medium', cost: 3 },
        heavy: { model: 'big', effort: 'high', cost: 8 },
      },
    },
    codex: {
      argv: ['-m', '{model}', '-c', 'model_reasoning_effort={effort}'],
      tiers: {
        light: { model: 'c-small', effort: 'low', cost: 1 },
        medium: { model: 'c-mid', effort: 'medium', cost: 3 },
        heavy: { model: 'c-big', effort: 'high', cost: 8 },
      },
    },
  },
};

function heavyRows(model, oks, quota = 1) {
  return oks.map((ok, index) => ({
    ai: 'cursor',
    task: `T${index}`,
    size: 'heavy',
    tier: 'heavy',
    model,
    ok,
    quotaBefore: 0,
    quotaAfter: quota,
  }));
}

test('tier classification uses size as a floor and lets the coordinator override', () => {
  assert.equal(classifyTier({ size: 'light' }), 'light');
  assert.equal(classifyTier({ size: 'light', text: 'debug the parser' }), 'medium');
  assert.equal(classifyTier({ size: 'light', text: 'review the diff' }), 'medium');
  assert.equal(classifyTier({ size: 'heavy', text: 'review the diff' }), 'heavy');
  assert.equal(classifyTier({ size: 'light', text: 'architecture of the API' }), 'heavy');
  assert.equal(classifyTier({ size: 'light', files: 6 }), 'medium');
  assert.equal(classifyTier({ size: 'light', files: 20 }), 'heavy');
  assert.equal(classifyTier({ size: 'light', text: 'architecture', tier: 'light' }), 'light');
});

test('escalation steps one tier and stops at heavy', () => {
  assert.equal(escalateTier('light'), 'medium');
  assert.equal(escalateTier('medium'), 'heavy');
  assert.equal(escalateTier('heavy'), 'heavy');
});

test('models path prefers ORCA_MODELS_PATH, then the user copy, else the bundled table', () => {
  const home = '/home/someone';
  const userCopy = join(home, '.orca-advanced', 'models.json');
  assert.equal(resolveModelsPath({ ORCA_MODELS_PATH: '  /tmp/models.json  ' }, home, () => false), '/tmp/models.json');
  assert.equal(resolveModelsPath({}, home, (path) => path === userCopy), userCopy);
  assert.equal(resolveModelsPath({ ORCA_MODELS_PATH: '   ' }, home, () => false), BUNDLED_MODELS_PATH);
  assert.equal(resolveModelsPath({}, home, () => false), BUNDLED_MODELS_PATH);
});

test('routing table lookup and CLI argv templates', () => {
  const live = loadModels(BUNDLED_MODELS_PATH);
  assert.match(live.note, /Adding a new LLM/);
  assert.equal(live.success.minRate, 0.8);
  assert.equal(live.success.minSamples, 3);
  for (const ai of KNOWN_AIS) {
    assert.ok(live.agents[ai], ai);
    for (const tier of SIZE_CLASSES) assert.ok(live.agents[ai].tiers[tier].model, `${ai} ${tier}`);
    assert.ok(live.agents[ai].argv.some((token) => token.includes('{model}')));
  }
  assert.deepEqual(live.agents.claude.argv, ['--model', '{model}']);
  assert.equal(live.agents.codex.argv[0], '-m');
  assert.ok(live.agents.codex.argv.some((token) => token.includes('{effort}')));
  assert.ok(live.agents.cursor.argv.includes('--model'));
  assert.equal(live.agents.grok.tiers.heavy.model, 'grok-4.6');
  assert.deepEqual(renderArgs(table.agents.codex.argv, table.agents.codex.tiers.heavy), ['-m', 'c-big', '-c', 'model_reasoning_effort=high']);
});

test('picker prefers the cheapest model with an acceptable success rate, else the tier default', () => {
  const cheap = heavyRows('small', [true, true, true], 1);
  const preferred = chooseModel({
    table,
    ai: 'cursor',
    tier: 'heavy',
    rows: cheap,
    estimates: estimateModelCosts(cheap),
  });
  assert.equal(preferred.model, 'small');
  assert.equal(preferred.fallback, null);
  assert.deepEqual(preferred.args, ['--model', 'small']);

  const priceyCheap = heavyRows('small', [true, true, true], 10);
  const priceyBig = heavyRows('big', [true, true, true], 2).map((row, index) => ({ ...row, task: `B${index}` }));
  const both = [...priceyCheap, ...priceyBig];
  const cheaperHistory = chooseModel({
    table,
    ai: 'cursor',
    tier: 'heavy',
    rows: both,
    estimates: estimateModelCosts(both),
  });
  assert.equal(cheaperHistory.model, 'big');

  const weak = heavyRows('small', [true, true, false], 1);
  const rejected = chooseModel({
    table,
    ai: 'cursor',
    tier: 'heavy',
    rows: weak,
    estimates: estimateModelCosts(weak),
  });
  assert.equal(rejected.model, 'big');
  assert.equal(rejected.fallback, 'default-tier');

  const few = heavyRows('small', [true, true], 1);
  assert.equal(chooseModel({ table, ai: 'cursor', tier: 'heavy', rows: few, estimates: estimateModelCosts(few) }).model, 'big');
  assert.equal(chooseModel({ table, ai: 'cursor', tier: 'heavy', rows: [], estimates: {} }).model, 'big');

  const shared = {
    success: { minRate: 0.8, minSamples: 3 },
    agents: {
      grok: {
        argv: ['--model', '{model}', '--reasoning-effort', '{effort}'],
        tiers: {
          light: { model: 'grok-4.6', effort: 'low', cost: 1 },
          medium: { model: 'grok-4.6', effort: 'high', cost: 3 },
          heavy: { model: 'grok-4.6', effort: 'xhigh', cost: 6 },
        },
      },
    },
  };
  const sharedRows = [0, 1, 2].map((index) => ({
    ai: 'grok', task: `G${index}`, size: 'heavy', tier: 'heavy', model: 'grok-4.6', ok: true, quotaBefore: 0, quotaAfter: 1,
  }));
  const kept = chooseModel({ table: shared, ai: 'grok', tier: 'heavy', rows: sharedRows, estimates: estimateModelCosts(sharedRows) });
  assert.equal(kept.model, 'grok-4.6');
  assert.equal(kept.effort, 'xhigh');
  assert.deepEqual(kept.args, ['--model', 'grok-4.6', '--reasoning-effort', 'xhigh']);
  assert.equal(kept.fallback, null);
});

test('unknown AI and unknown model fall back', () => {
  const missing = chooseModel({ table, ai: 'nope', tier: 'light', rows: [] });
  assert.equal(missing.fallback, 'unknown-ai');
  assert.equal(missing.model, null);
  assert.deepEqual(missing.args, []);
  const unknown = resolveModel(table, 'cursor', 'heavy', 'not-a-model');
  assert.equal(unknown.fallback, 'unknown-model');
  assert.equal(unknown.model, 'big');
  assert.equal(unknown.requested, 'not-a-model');
});

test('next prints the tier, model, and launch args, and a retry steps up', () => {
  const live = loadModels(BUNDLED_MODELS_PATH);
  const dir = mkdtempSync(join(tmpdir(), 'models-'));
  const ledger = join(dir, 'usage.jsonl');
  writeFileSync(ledger, `${JSON.stringify({ ai: 'cursor', task: 'T1', size: 'light', tier: 'light', quotaBefore: 0, quotaAfter: 1, ok: false })}\n`);
  const raised = spawnSync(process.execPath, [
    cotasPath, 'next',
    '--size', 'light',
    '--title', 'architecture of the cache',
    '--coordinator', 'claude',
    '--account', spreadPath,
    '--ledger', join(dir, 'empty.jsonl'),
  ], { encoding: 'utf8', env: { ...process.env, ORCA_MODELS_PATH: BUNDLED_MODELS_PATH } });
  assert.equal(raised.status, 0, raised.stderr);
  assert.match(raised.stdout, /^Next: cursor/m);
  assert.match(raised.stdout, /^Tier: heavy/m);
  assert.match(raised.stdout, new RegExp(`^Model: ${live.agents.cursor.tiers.heavy.model}$`, 'm'));
  assert.match(raised.stdout, new RegExp(`^Args: --model ${live.agents.cursor.tiers.heavy.model}$`, 'm'));

  const retry = spawnSync(process.execPath, [
    cotasPath, 'next',
    '--size', 'light',
    '--retry-of', 'T1',
    '--coordinator', 'claude',
    '--account', spreadPath,
    '--ledger', ledger,
  ], { encoding: 'utf8', env: { ...process.env, ORCA_MODELS_PATH: BUNDLED_MODELS_PATH } });
  assert.equal(retry.status, 0, retry.stderr);
  assert.match(retry.stdout, /^Tier: medium/m);
  assert.match(retry.stdout, new RegExp(`^Model: ${live.agents.cursor.tiers.medium.model}$`, 'm'));
});

test('next warns and omits model args when the table is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'models-missing-'));
  const missing = join(dir, 'models.json');
  const result = spawnSync(process.execPath, [
    cotasPath, 'next',
    '--size', 'light',
    '--coordinator', 'claude',
    '--account', spreadPath,
    '--ledger', join(dir, 'empty.jsonl'),
  ], { encoding: 'utf8', env: { ...process.env, ORCA_MODELS_PATH: missing } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /cotas: warning:/);
  assert.match(result.stdout, /^Model: cli-default$/m);
  assert.match(result.stdout, /^Args: none$/m);
  assert.doesNotMatch(result.stdout, /--model/);
});
