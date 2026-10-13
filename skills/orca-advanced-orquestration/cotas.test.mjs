import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assignShares, buildReport, cliCandidates, CONFIG, parseRateLimits, pickCli } from './cotas.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cotasPath = join(here, 'cotas.mjs');
const spreadPath = join(here, 'fixtures/account-spread.json');
const thinPath = join(here, 'fixtures/account-thin.json');
const badPath = join(here, 'fixtures/account-bad-shape.json');
const NOW = 1_700_000_000_000;

function reportFrom(path) {
  return buildReport(parseRateLimits(readFileSync(path, 'utf8')), NOW);
}

test('CLI candidates prefer ORCA_CLI_COMMAND, then orca-ide, then orca', () => {
  assert.deepEqual(cliCandidates({}), ['orca-ide', 'orca']);
  assert.deepEqual(cliCandidates({ ORCA_CLI_COMMAND: '  /opt/orca  ' }), ['/opt/orca', 'orca-ide', 'orca']);
  assert.equal(pickCli(['/missing', 'orca-ide', 'orca'], (cmd) => cmd === 'orca'), 'orca');
  assert.equal(pickCli(['/opt/orca', 'orca-ide', 'orca'], (cmd) => cmd === '/opt/orca'), '/opt/orca');
  assert.equal(pickCli(['/missing', 'orca-ide', 'orca'], () => false), null);
});

test('parseRateLimits rejects a JSON shape without rateLimits', () => {
  assert.throws(() => parseRateLimits(readFileSync(badPath, 'utf8')), /rateLimits/);
  assert.throws(() => parseRateLimits('not-json'), /not JSON/);
  assert.throws(() => parseRateLimits('[]'), /must be an object/);
});

test('suggested shares cap any AI at 35% when 3 or more have quota', () => {
  const agents = [
    { name: 'cursor', weight: 100 },
    { name: 'grok', weight: 10 },
    { name: 'claude', weight: 10 },
    { name: 'codex', weight: 10 },
  ];
  assignShares(agents);
  assert.equal(agents.reduce((sum, agent) => sum + agent.share, 0), 100);
  assert.equal(agents.find((agent) => agent.name === 'cursor').share, CONFIG.shareCapPercent);
  for (const agent of agents) assert.ok(agent.share <= CONFIG.shareCapPercent);
});

test('the 35% cap is lifted when fewer than 3 AIs have quota', () => {
  const agents = [
    { name: 'cursor', weight: 100 },
    { name: 'muse', weight: 10 },
  ];
  assignShares(agents);
  assert.equal(agents.reduce((sum, agent) => sum + agent.share, 0), 100);
  assert.ok(agents.find((agent) => agent.name === 'cursor').share > CONFIG.shareCapPercent);
});

test('spread fixture: heavy work is the most headroom, shares stay inside the cap', () => {
  const report = reportFrom(spreadPath);
  assert.equal(report.heavy, 'cursor');
  assert.equal(Object.values(report.suggestedShare).reduce((sum, share) => sum + share, 0), 100);
  for (const share of Object.values(report.suggestedShare)) assert.ok(share <= CONFIG.shareCapPercent);
  assert.match(report.text, /Suggested share:/);
  assert.match(report.text, new RegExp(CONFIG.models.antigravityFallback.replace(/[.]/g, '\\.')));
  assert.equal(report.suggestedShare.cursor, CONFIG.shareCapPercent);
});

test('thin fixture: one AI with quota can take more than 35%', () => {
  const report = reportFrom(thinPath);
  assert.ok(report.suggestedShare.cursor > CONFIG.shareCapPercent);
  assert.equal(report.suggestedShare.claude, 0);
  assert.equal(report.suggestedShare.codex, 0);
  assert.equal(report.heavy, 'cursor');
});

test('CLI prints a stderr warning instead of hiding a bad payload', () => {
  const bad = spawnSync(process.execPath, [cotasPath, badPath], { encoding: 'utf8' });
  assert.equal(bad.status, 0);
  assert.match(bad.stderr, /cotas: warning:/);
  assert.match(bad.stderr, /rateLimits/);
  assert.match(bad.stdout, /Quotas: unavailable/);
  assert.doesNotMatch(bad.stdout, /Suggested share:/);

  const text = spawnSync(process.execPath, [cotasPath, join(here, 'fixtures/account-spread.json')], { encoding: 'utf8' });
  assert.equal(text.status, 0);
  assert.equal(text.stderr, '');
  assert.match(text.stdout, /Suggested share:/);
});

test('ORCA_CLI_COMMAND is executed, and a missing one falls through to orca-ide', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cotas-cli-'));
  const fixture = join(dir, 'out.json');
  writeFileSync(fixture, readFileSync(spreadPath));
  const script = `#!/bin/sh\ncat '${fixture}'\n`;
  const envBin = join(dir, 'from-env');
  const ideBin = join(dir, 'orca-ide');
  writeFileSync(envBin, script);
  writeFileSync(ideBin, script);
  chmodSync(envBin, 0o755);
  chmodSync(ideBin, 0o755);

  const fromEnv = spawnSync(process.execPath, [cotasPath], {
    encoding: 'utf8',
    env: { ...process.env, ORCA_CLI_COMMAND: envBin, PATH: `${dir}:/usr/bin:/bin` },
  });
  assert.equal(fromEnv.status, 0, fromEnv.stderr);
  assert.match(fromEnv.stdout, /Suggested share:/);

  const fallback = spawnSync(process.execPath, [cotasPath], {
    encoding: 'utf8',
    env: { ...process.env, ORCA_CLI_COMMAND: join(dir, 'missing'), PATH: `${dir}:/usr/bin:/bin` },
  });
  assert.equal(fallback.status, 0, fallback.stderr);
  assert.match(fallback.stdout, /Suggested share:/);
  assert.doesNotMatch(fallback.stderr, /cotas: warning:/);
});
