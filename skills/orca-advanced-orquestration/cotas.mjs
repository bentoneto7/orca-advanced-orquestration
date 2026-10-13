#!/usr/bin/env node
// Reads each AI's quota for /orca-advanced-orquestration (zero token cost).
// Usage: node cotas.mjs [--json] [file.json]   (without a file, runs `<cli> account list --json`)
// CLI: $ORCA_CLI_COMMAND, then `orca-ide`, then `orca` (first one that exists).
// Never prints emails, ids or credentials: only percentages, resets and weights.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Model names and relative capacities. Shares follow remaining quota (headroom x pace x capacity).
// Capacities are 1 so plan size does not park the wave on claude and codex.
export const CONFIG = {
  reservePercent: { claude: 15, codex: 15 },
  capacity: { claude: 1, codex: 1, cursor: 1, grok: 1, antigravity: 1 },
  museFactor: 0.7, // of the median cursor/grok weight; muse has no meter
  museFallbackWeight: 40,
  models: {
    antigravityDefault: 'gemini (default)',
    antigravityFallback: 'claude-sonnet-4-6',
  },
  shareCapPercent: 35,
  shareCapMinAgents: 3,
};

const AGENTS = ['claude', 'codex', 'cursor', 'grok', 'antigravity', 'muse'];

export function cliCandidates(env = process.env) {
  const list = [];
  const fromEnv = env.ORCA_CLI_COMMAND;
  if (typeof fromEnv === 'string' && fromEnv.trim()) list.push(fromEnv.trim());
  list.push('orca-ide', 'orca');
  return list;
}

export function pickCli(candidates, exists) {
  for (const cmd of candidates) {
    if (exists(cmd)) return cmd;
  }
  return null;
}

export function commandExists(cmd) {
  if (!cmd) return false;
  if (cmd.includes('/') || cmd.includes('\\')) return existsSync(cmd);
  const finder = process.platform === 'win32' ? 'where.exe' : 'which';
  const found = spawnSync(finder, [cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return found.status === 0 && Boolean(found.stdout && found.stdout.trim());
}

export function parseRateLimits(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('account list output is not JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('account list JSON must be an object');
  }
  const root = parsed.result ?? parsed;
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    throw new Error('account list JSON must be an object');
  }
  if (!Object.prototype.hasOwnProperty.call(root, 'rateLimits') || !root.rateLimits || typeof root.rateLimits !== 'object' || Array.isArray(root.rateLimits)) {
    throw new Error('account list JSON is missing rateLimits');
  }
  return root.rateLimits;
}

const when = (ms) => {
  if (!ms) return '?';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return `${mon} ${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// window: { usedPercent, windowMinutes, resetsAt } -> usage, % of time elapsed, pace (usage - time)
const windowOf = (w, now) => {
  if (!w || typeof w.usedPercent !== 'number') return null;
  const tot = (w.windowMinutes || 0) * 60000;
  const el = tot && w.resetsAt ? Math.min(100, Math.max(0, 100 * (1 - (w.resetsAt - now) / tot))) : null;
  return { usage: Math.round(w.usedPercent), elapsed: el == null ? null : Math.round(el), pace: el == null ? 0 : Math.round(w.usedPercent - el), reset: w.resetsAt, min: w.windowMinutes };
};

function roundShares(agents, cap) {
  const rows = agents.map((k) => ({ k, exact: Number(k.share) || 0 }));
  let used = 0;
  for (const row of rows) {
    row.floor = Math.floor(row.exact + 1e-9);
    row.frac = row.exact - row.floor;
    used += row.floor;
  }
  let left = 100 - used;
  const order = rows.filter((row) => row.exact > 0).sort((a, b) => b.frac - a.frac || a.k.name.localeCompare(b.k.name));
  for (const row of order) {
    if (left <= 0) break;
    row.floor += 1;
    left -= 1;
  }
  for (const row of rows) row.k.share = row.exact > 0 ? row.floor : 0;
  if (cap == null) return;
  const positive = agents.filter((k) => k.share > 0);
  if (positive.length < CONFIG.shareCapMinAgents) return;
  for (let guard = 0; guard < 1000; guard++) {
    const over = positive.filter((k) => k.share > cap).sort((a, b) => b.share - a.share);
    const under = positive.filter((k) => k.share < cap).sort((a, b) => a.share - b.share);
    if (!over.length || !under.length) break;
    over[0].share -= 1;
    under[0].share += 1;
  }
}

export function assignShares(agents) {
  const active = agents.filter((k) => (k.weight || 0) > 0);
  const total = active.reduce((s, k) => s + k.weight, 0);
  const capApplies = active.length >= CONFIG.shareCapMinAgents;
  if (!total) {
    for (const k of agents) k.share = 0;
    return;
  }
  for (const k of agents) k.share = ((k.weight || 0) / total) * 100;
  if (capApplies) {
    const cap = CONFIG.shareCapPercent;
    const locked = new Set();
    for (let n = 0; n < active.length; n++) {
      const over = active.filter((k) => !locked.has(k.name) && k.share > cap + 1e-6);
      if (!over.length) break;
      let excess = 0;
      for (const k of over) {
        excess += k.share - cap;
        k.share = cap;
        locked.add(k.name);
      }
      const open = active.filter((k) => !locked.has(k.name));
      if (!open.length) break;
      const openSum = open.reduce((s, k) => s + k.share, 0);
      if (openSum <= 0) break;
      for (const k of open) k.share += excess * (k.share / openSum);
    }
    const sum = active.reduce((s, k) => s + k.share, 0) || 1;
    for (const k of active) k.share *= 100 / sum;
  }
  for (const k of agents) if (!active.includes(k)) k.share = 0;
  roundShares(agents, capApplies ? CONFIG.shareCapPercent : null);
}

export function buildReport(rl, now = Date.now()) {
  const agents = [];
  const add = (name, plan, wins, extra = {}) => {
    const ws = wins.filter(Boolean);
    if (!ws.length) {
      agents.push({ name, plan, status: extra.status ?? 'no meter', weight: null, ...extra });
      return;
    }
    const worst = Math.max(...ws.map((x) => x.usage));
    const longest = ws.reduce((a, b) => ((b.min || 0) > (a.min || 0) ? b : a)); // weekly/monthly drives the pace
    const reserve = CONFIG.reservePercent[name] ?? 0;
    const headroom = Math.max(0, Math.min(...ws.map((x) => 100 - x.usage - (x === longest ? reserve : 0))));
    const factor = Math.min(1.5, Math.max(0.5, 1 - longest.pace / 50)); // ahead reduces, behind increases
    let status = worst >= 95 || headroom <= 0 ? 'excluded' : worst >= 80 ? 'review only' : worst >= 60 ? 'light/medium' : 'normal';
    if (extra.forceStatus) status = extra.forceStatus;
    const weight = status === 'excluded' ? 0 : Math.round(headroom * factor * (status === 'review only' ? 0.25 : 1) * (CONFIG.capacity[name] ?? 1));
    const excludedUntil = status === 'excluded' ? Math.max(...ws.filter((x) => x.usage >= 95).map((x) => x.reset || 0), longest.reset || 0) : null;
    agents.push({ name, plan, windows: ws, headroom, pace: longest.pace, status, weight, excludedUntil, ...extra });
  };

  const c = rl.claude, x = rl.codex, cu = rl.cursor, g = rl.grok, a = rl.antigravity;
  if (c?.status === 'ok') add('claude', '5h+weekly', [windowOf(c.session, now), windowOf(c.weekly, now)]);
  if (x?.status === 'ok') add('codex', x.session ? '5h+weekly' : 'weekly', [windowOf(x.session, now), windowOf(x.weekly, now)], { extraCredits: x.extraUsage?.enabled ? 'do not use' : undefined });
  if (cu?.status === 'ok') {
    const b = (n) => cu.buckets?.find((k) => k.name === n);
    add('cursor', 'monthly', [windowOf(b('Cursor Models') ?? cu.monthly, now)], { note: b('Other Models') ? `Other Models ${Math.round(b('Other Models').usedPercent)}%` : undefined });
  }
  if (g?.status === 'ok') add('grok', 'weekly', [windowOf(g.weekly, now)]);
  if (a?.status === 'ok') {
    const gem = a.buckets?.find((k) => /gemini/i.test(k.name));
    const cg = a.buckets?.find((k) => /claude|gpt/i.test(k.name));
    const wg = windowOf(gem, now), wc = windowOf(cg, now);
    const gemOk = wg && wg.usage < 95;
    add('antigravity', 'Starter weekly', [gemOk ? wg : wc], {
      model: gemOk ? CONFIG.models.antigravityDefault : wc && wc.usage < 95 ? CONFIG.models.antigravityFallback : null,
      gemini: wg,
      claudeGpt: wc,
      forceStatus: gemOk || (wc && wc.usage < 95) ? undefined : 'excluded',
    });
  }
  add('muse', 'no meter', [], { status: 'no meter' });

  const support = agents.filter((k) => ['cursor', 'grok'].includes(k.name) && k.weight > 0).map((k) => k.weight).sort((p, q) => p - q);
  const muse = agents.find((k) => k.name === 'muse');
  muse.weight = Math.round(CONFIG.museFactor * (support.length ? support[Math.floor(support.length / 2)] : CONFIG.museFallbackWeight));
  assignShares(agents);

  const active = agents.filter((k) => k.status !== 'excluded');
  const heavy = active.filter((k) => k.status === 'normal' && typeof k.headroom === 'number').sort((p, q) => q.headroom - p.headroom || q.weight - p.weight)[0] ?? null;

  const fmt = (k) => {
    if (!k.windows) return `${k.name} no meter -> ${k.share}% (scoped tasks)`;
    const ws = k.windows.map((w) => `${w.usage}%${w.min <= 300 ? ' 5h' : w.min <= 10080 ? ' wk' : ' mo'}`).join(' / ');
    const pc = k.pace > 0 ? `+${k.pace}` : `${k.pace}`;
    let s = `${k.name} ${ws} (pace ${pc}, reset ${when(Math.max(...k.windows.map((w) => w.reset || 0)))}) ${k.status} -> ${k.share}%`;
    if (k.name === 'antigravity') s += ` [gemini ${k.gemini ? k.gemini.usage + '% reset ' + when(k.gemini.reset) : '?'}; claude/gpt ${k.claudeGpt ? k.claudeGpt.usage + '%' : '?'}; model ${k.model ?? 'none'}]`;
    if (k.status === 'excluded') s = `${k.name} no quota until ${when(k.excludedUntil)} -> 0%`;
    if (k.extraCredits) s += ' [extra credits: do not use]';
    return s;
  };

  const byName = Object.fromEntries(agents.map((k) => [k.name, k]));
  const suggested = AGENTS.filter((name) => byName[name]).map((name) => `${name} ${byName[name].share}%`).join(' | ');
  const capNote = `cap ${CONFIG.shareCapPercent}% when ${CONFIG.shareCapMinAgents}+ AIs have quota`;
  const lines = [
    `Quotas (${when(now)}): ` + agents.map(fmt).join(' | '),
    `Suggested share: ${suggested} (${capNote}; coordinator plans/reviews only)`,
    `Heavy: ${heavy?.name ?? 'nobody with normal status - split into medium tasks'} | 15% reserve on claude/codex | pace = usage - elapsed time of the window (+ ahead)`,
  ];
  return {
    generatedAt: when(now),
    agents,
    heavy: heavy?.name ?? null,
    shareCapPercent: CONFIG.shareCapPercent,
    suggestedShare: Object.fromEntries(AGENTS.filter((name) => byName[name]).map((name) => [name, byName[name].share])),
    text: lines.join('\n'),
  };
}

function loadRateLimits(file) {
  if (file) return parseRateLimits(readFileSync(file, 'utf8'));
  const cmd = pickCli(cliCandidates(), commandExists);
  if (!cmd) {
    throw new Error('no Orca CLI found (tried ORCA_CLI_COMMAND, orca-ide, orca)');
  }
  let raw;
  try {
    raw = execFileSync(cmd, ['account', 'list', '--json'], { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const code = e && e.status != null ? e.status : 'unknown';
    throw new Error(`\`${cmd} account list --json\` failed (exit ${code})`);
  }
  return parseRateLimits(raw);
}

function unavailable(detail) {
  console.error(`cotas: warning: ${detail}. Not using a silent default; treat every AI as 60-80% until account list --json returns an object with rateLimits.`);
  console.log('Quotas: unavailable (orca account list failed). Use the Orca Usage panel and treat everyone as 60-80%.');
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

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const file = args.find((a) => !a.startsWith('--'));
  let rl;
  try {
    rl = loadRateLimits(file);
  } catch (e) {
    unavailable(e && e.message ? e.message : String(e));
    process.exit(0);
  }
  const report = buildReport(rl);
  if (asJson) {
    console.log(JSON.stringify({
      generatedAt: report.generatedAt,
      agents: report.agents,
      heavy: report.heavy,
      shareCapPercent: report.shareCapPercent,
      suggestedShare: report.suggestedShare,
    }, null, 2));
    return;
  }
  console.log(report.text);
}

if (invokedDirectly()) main();
