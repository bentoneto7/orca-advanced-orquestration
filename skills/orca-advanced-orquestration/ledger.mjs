// Append-only usage ledger and per-task pick for /orca-advanced-orquestration.
// Path: $ORCA_USAGE_LEDGER or ~/.orca-advanced/usage.jsonl
// Lines are JSON objects: ai, task, size, quotaBefore, quotaAfter, optional tokens.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const KNOWN_AIS = ['claude', 'codex', 'cursor', 'grok', 'antigravity', 'muse'];
export const SIZE_CLASSES = ['light', 'medium', 'heavy'];

// Recent rows weigh more. Empty history uses the quota defaults (points of the worst window).
export const LEDGER_DEFAULTS = {
  decay: 0.7,
  quotaCost: { light: 1, medium: 3, heavy: 8 },
  tokenCost: { light: 2000, medium: 8000, heavy: 20000 },
  museHeadroom: 40,
};

export function resolveLedgerPath(env = process.env, home = homedir()) {
  const fromEnv = env.ORCA_USAGE_LEDGER;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  return join(home, '.orca-advanced', 'usage.jsonl');
}

export function parseLedger(text) {
  const rows = [];
  let skipped = 0;
  for (const rawLine of String(text).split(/\n/)) {
    const line = rawLine.replace(/\r$/, '').trim();
    if (!line) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      skipped += 1;
      continue;
    }
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      skipped += 1;
      continue;
    }
    if (!KNOWN_AIS.includes(row.ai) || typeof row.task !== 'string' || !row.task || !SIZE_CLASSES.includes(row.size)) {
      skipped += 1;
      continue;
    }
    const quotaBefore = numberOrNull(row.quotaBefore);
    const quotaAfter = numberOrNull(row.quotaAfter);
    const tokens = numberOrNull(row.tokens);
    rows.push({
      ai: row.ai,
      task: row.task,
      size: row.size,
      quotaBefore,
      quotaAfter,
      ...(tokens == null ? {} : { tokens }),
      ...(typeof row.ts === 'string' ? { ts: row.ts } : {}),
    });
  }
  return { rows, skipped };
}

export function readLedger(path) {
  if (!path || !existsSync(path)) return { rows: [], skipped: 0 };
  return parseLedger(readFileSync(path, 'utf8'));
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function resolveQuotaBefore({ explicit, previousAfter, quotaAfter }) {
  const given = numberOrNull(explicit);
  if (given != null) return given;
  if (previousAfter != null) return previousAfter;
  return quotaAfter;
}

export function previousQuotaAfter(rows, ai) {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].ai === ai && rows[i].quotaAfter != null) return rows[i].quotaAfter;
  }
  return null;
}

export function buildRecord(fields) {
  const ai = fields.ai;
  const task = typeof fields.task === 'string' ? fields.task.trim() : '';
  const size = fields.size;
  if (!KNOWN_AIS.includes(ai)) throw new Error(`record: unknown ai '${ai ?? ''}'`);
  if (!task || /[\r\n]/.test(task)) throw new Error('record: task id is required');
  if (!SIZE_CLASSES.includes(size)) throw new Error(`record: size must be ${SIZE_CLASSES.join('|')}`);
  const quotaBefore = numberOrNull(fields.quotaBefore);
  const quotaAfter = numberOrNull(fields.quotaAfter);
  const tokens = numberOrNull(fields.tokens);
  const row = {
    ts: fields.ts || new Date().toISOString(),
    ai,
    task,
    size,
    quotaBefore,
    quotaAfter,
  };
  if (tokens != null) row.tokens = tokens;
  return row;
}

export function appendLedger(path, row) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(row)}\n`, 'utf8');
}

function weightedAverage(values, decay, fallback) {
  if (!values.length) return { value: fallback, samples: 0 };
  let weightSum = 0;
  let total = 0;
  values.forEach((value, index) => {
    const weight = decay ** (values.length - 1 - index);
    weightSum += weight;
    total += value * weight;
  });
  return { value: weightSum ? total / weightSum : fallback, samples: values.length };
}

export function estimateCosts(rows, opts = {}) {
  const decay = opts.decay ?? LEDGER_DEFAULTS.decay;
  const quotaCost = opts.quotaCost ?? LEDGER_DEFAULTS.quotaCost;
  const tokenCost = opts.tokenCost ?? LEDGER_DEFAULTS.tokenCost;
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.ai}\0${row.size}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const estimates = {};
  for (const ai of KNOWN_AIS) {
    estimates[ai] = {};
    for (const size of SIZE_CLASSES) {
      const samples = groups.get(`${ai}\0${size}`) ?? [];
      const quotaDeltas = [];
      const tokenSamples = [];
      for (const sample of samples) {
        if (sample.quotaBefore == null || sample.quotaAfter == null) continue;
        if (sample.quotaAfter < sample.quotaBefore) continue; // window reset, not a cost
        quotaDeltas.push(sample.quotaAfter - sample.quotaBefore);
        if (sample.tokens != null) tokenSamples.push(sample.tokens);
      }
      const quota = weightedAverage(quotaDeltas, decay, quotaCost[size]);
      const tokens = weightedAverage(tokenSamples, decay, tokenCost[size]);
      estimates[ai][size] = {
        quota: quota.value,
        tokens: tokens.value,
        quotaSamples: quota.samples,
        tokenSamples: tokens.samples,
      };
    }
  }
  return estimates;
}

function canTake(agent, size) {
  if (!agent || agent.status === 'excluded') return false;
  if (size === 'heavy') return agent.status === 'normal';
  if (size === 'medium') return agent.status === 'normal' || agent.status === 'light/medium' || agent.status === 'no meter';
  if (size === 'light') return agent.status === 'normal' || agent.status === 'light/medium' || agent.status === 'review only' || agent.status === 'no meter';
  return false;
}

export function parseTaken(value) {
  const taken = {};
  if (value == null || value === true || value === '') return taken;
  for (const part of String(value).split(',')) {
    const [name, count] = part.split('=');
    const ai = (name || '').trim();
    const n = Number(count);
    if (!ai || !Number.isFinite(n) || n < 0) continue;
    taken[ai] = n;
  }
  return taken;
}

// agents[].headroom is already net of the 15% claude/codex reserve (buildReport).
// The 35% cap drops an AI already at that share of this wave when another eligible AI is under it.
export function pickNext({ agents, estimates, size, coordinator, taken = {}, capPercent = 35, capMinAgents = 3, museHeadroom = LEDGER_DEFAULTS.museHeadroom }) {
  if (!SIZE_CLASSES.includes(size)) throw new Error(`next: size must be ${SIZE_CLASSES.join('|')}`);
  const ranked = [];
  for (const agent of agents) {
    if (!agent || agent.name === coordinator) continue;
    if (!canTake(agent, size)) continue;
    const headroom = typeof agent.headroom === 'number' ? agent.headroom : (agent.name === 'muse' ? museHeadroom : null);
    if (headroom == null) continue;
    const cost = estimates?.[agent.name]?.[size]?.quota ?? LEDGER_DEFAULTS.quotaCost[size];
    const projected = headroom - cost;
    if (projected <= 0) continue;
    ranked.push({
      name: agent.name,
      projected,
      headroom,
      cost,
      status: agent.status,
    });
  }
  ranked.sort((a, b) => b.projected - a.projected || a.name.localeCompare(b.name));
  const withQuota = agents.filter((agent) => agent && agent.status !== 'excluded').length;
  const totalTaken = Object.values(taken).reduce((sum, n) => sum + n, 0);
  let order = ranked;
  let capApplied = false;
  if (withQuota >= capMinAgents && totalTaken > 0) {
    const share = (name) => (100 * (taken[name] || 0)) / totalTaken;
    const under = ranked.filter((agent) => share(agent.name) < capPercent);
    if (under.length && under.length < ranked.length) {
      order = under;
      capApplied = true;
    }
  }
  return {
    next: order[0]?.name ?? null,
    fallback: order.slice(1).map((agent) => agent.name),
    order: order.map((agent) => agent.name),
    projected: order,
    capApplied,
  };
}

export function formatPick(pick) {
  const next = pick.next ?? 'nobody';
  const fallback = pick.fallback.length ? pick.fallback.join(', ') : 'none';
  const projected = pick.projected.length
    ? pick.projected.map((agent) => `${agent.name} ${round1(agent.projected)} (headroom ${round1(agent.headroom)} - cost ${round1(agent.cost)})`).join(' | ')
    : 'none';
  return `Next: ${next}\nFallback: ${fallback}\nProjected: ${projected}`;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

export function formatRecord(row) {
  const before = row.quotaBefore == null ? '?' : row.quotaBefore;
  const after = row.quotaAfter == null ? '?' : row.quotaAfter;
  const tokens = row.tokens == null ? '' : ` tokens ${row.tokens}`;
  return `Recorded: ${row.ai} ${row.task} ${row.size} quota ${before}->${after}${tokens}`;
}
