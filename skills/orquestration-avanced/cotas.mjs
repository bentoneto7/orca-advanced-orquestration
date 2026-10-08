#!/usr/bin/env node
// Reads each AI's quota for /orquestration-avanced (zero token cost).
// Usage: node cotas.mjs [--json] [file.json]   (without a file, runs `orca account list --json`)
// Never prints emails, ids or credentials: only percentages, resets and weights.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const file = args.find((a) => !a.startsWith('--'));
let rl;
try {
  const raw = file ? readFileSync(file, 'utf8') : execSync('orca account list --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 });
  const j = JSON.parse(raw);
  rl = (j.result ?? j).rateLimits ?? {};
} catch (e) {
  console.log('Quotas: unavailable (orca account list failed). Use the Orca Usage panel and treat everyone as 60-80%.');
  process.exit(0);
}

const now = Date.now();
const RESERVE = { claude: 15, codex: 15 }; // reserve for critical review/coordination
const CAPACITY = { claude: 3, codex: 3, cursor: 1, grok: 1, antigravity: 0.3 }; // relative plan size
const when = (ms) => {
  if (!ms) return '?';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return `${mon} ${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
// window: { usedPercent, windowMinutes, resetsAt } -> usage, % of time elapsed, pace (usage - time)
const windowOf = (w) => {
  if (!w || typeof w.usedPercent !== 'number') return null;
  const tot = (w.windowMinutes || 0) * 60000;
  const el = tot && w.resetsAt ? Math.min(100, Math.max(0, 100 * (1 - (w.resetsAt - now) / tot))) : null;
  return { usage: Math.round(w.usedPercent), elapsed: el == null ? null : Math.round(el), pace: el == null ? 0 : Math.round(w.usedPercent - el), reset: w.resetsAt, min: w.windowMinutes };
};

const agents = [];
const add = (name, plan, wins, extra = {}) => {
  const ws = wins.filter(Boolean);
  if (!ws.length) return agents.push({ name, plan, status: extra.status ?? 'no meter', weight: null, ...extra });
  const worst = Math.max(...ws.map((x) => x.usage));
  const longest = ws.reduce((a, b) => ((b.min || 0) > (a.min || 0) ? b : a)); // weekly/monthly drives the pace
  const reserve = RESERVE[name] ?? 0;
  const headroom = Math.max(0, Math.min(...ws.map((x) => 100 - x.usage - (x === longest ? reserve : 0))));
  const factor = Math.min(1.5, Math.max(0.5, 1 - longest.pace / 50)); // ahead reduces, behind increases
  let status = worst >= 95 || headroom <= 0 ? 'excluded' : worst >= 80 ? 'review only' : worst >= 60 ? 'light/medium' : 'normal';
  if (extra.forceStatus) status = extra.forceStatus;
  const weight = status === 'excluded' ? 0 : Math.round(headroom * factor * (status === 'review only' ? 0.25 : 1) * (CAPACITY[name] ?? 1));
  const excludedUntil = status === 'excluded' ? Math.max(...ws.filter((x) => x.usage >= 95).map((x) => x.reset || 0), longest.reset || 0) : null;
  agents.push({ name, plan, windows: ws, headroom, pace: longest.pace, status, weight, excludedUntil, ...extra });
};

const c = rl.claude, x = rl.codex, cu = rl.cursor, g = rl.grok, a = rl.antigravity;
if (c?.status === 'ok') add('claude', '5h+weekly', [windowOf(c.session), windowOf(c.weekly)]);
if (x?.status === 'ok') add('codex', x.session ? '5h+weekly' : 'weekly', [windowOf(x.session), windowOf(x.weekly)], { extraCredits: x.extraUsage?.enabled ? 'do not use' : undefined });
if (cu?.status === 'ok') {
  const b = (n) => cu.buckets?.find((k) => k.name === n);
  add('cursor', 'monthly', [windowOf(b('Cursor Models') ?? cu.monthly)], { note: b('Other Models') ? `Other Models ${Math.round(b('Other Models').usedPercent)}%` : undefined });
}
if (g?.status === 'ok') add('grok', 'weekly', [windowOf(g.weekly)]);
if (a?.status === 'ok') {
  const gem = a.buckets?.find((k) => /gemini/i.test(k.name));
  const cg = a.buckets?.find((k) => /claude|gpt/i.test(k.name));
  const wg = windowOf(gem), wc = windowOf(cg);
  const gemOk = wg && wg.usage < 95;
  // Starter: at most 1 short task per wave; without Gemini quota, runs with --model claude-sonnet-4-6
  add('antigravity', 'Starter weekly', [gemOk ? wg : wc], { model: gemOk ? 'gemini (default)' : wc && wc.usage < 95 ? 'claude-sonnet-4-6' : null, gemini: wg, claudeGpt: wc, forceStatus: gemOk || (wc && wc.usage < 95) ? undefined : 'excluded' });
}
add('muse', 'no meter', [], { status: 'no meter' });

// Muse has no meter: weight = 70% of the median of the support agents with quota, scoped tasks
const support = agents.filter((k) => ['cursor', 'grok'].includes(k.name) && k.weight > 0).map((k) => k.weight).sort((p, q) => p - q);
const muse = agents.find((k) => k.name === 'muse');
muse.weight = Math.round(0.7 * (support.length ? support[Math.floor(support.length / 2)] : 40));
const total = agents.reduce((s, k) => s + (k.weight || 0), 0) || 1;
for (const k of agents) k.share = Math.round((100 * (k.weight || 0)) / total);
const active = agents.filter((k) => k.status !== 'excluded');
const heavy = active.filter((k) => ['claude', 'codex'].includes(k.name) && k.status === 'normal').sort((p, q) => q.weight - p.weight)[0]
  ?? active.filter((k) => k.status === 'normal' && k.name !== 'antigravity' && k.name !== 'muse').sort((p, q) => q.weight - p.weight)[0];

if (asJson) { console.log(JSON.stringify({ generatedAt: when(now), agents, heavy: heavy?.name ?? null }, null, 2)); process.exit(0); }

const fmt = (k) => {
  if (!k.windows) return `${k.name} no meter -> ${k.share}% (scoped tasks)`;
  const ws = k.windows.map((w) => `${w.usage}%${w.min <= 300 ? ' 5h' : w.min <= 10080 ? ' wk' : ' mo'}`).join(' / ');
  const pc = k.pace > 0 ? `+${k.pace}` : `${k.pace}`;
  let s = `${k.name} ${ws} (pace ${pc}, reset ${when(Math.max(...k.windows.map((w) => w.reset || 0)))}) ${k.status} -> ${k.share}%`;
  if (k.name === 'antigravity') s += ` [gemini ${k.gemini ? k.gemini.usage + '% reset ' + when(k.gemini.reset) : '?'}; claude/gpt ${k.claudeGpt ? k.claudeGpt.usage + '%' : '?'}; model ${k.model ?? 'none'}; max 1 short task/wave]`;
  if (k.status === 'excluded') s = `${k.name} no quota until ${when(k.excludedUntil)} -> 0%`;
  if (k.extraCredits) s += ' [extra credits: do not use]';
  return s;
};
console.log(`Quotas (${when(now)}): ` + agents.map(fmt).join(' | '));
console.log(`Heavy: ${heavy?.name ?? 'nobody with normal status - split into medium tasks'} | 15% reserve on claude/codex | pace = usage - elapsed time of the window (+ ahead)`);
