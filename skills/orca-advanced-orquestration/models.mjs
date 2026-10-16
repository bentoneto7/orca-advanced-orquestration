// Model routing. config/models.json is the table; this file only reads it.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEDGER_DEFAULTS, SIZE_CLASSES } from './ledger.mjs';

export const MODELS_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../config/models.json');
const ORDER = ['light', 'medium', 'heavy'];

export function loadModels(path = MODELS_PATH) {
  const table = JSON.parse(readFileSync(path, 'utf8'));
  if (!table || typeof table !== 'object' || !table.agents) throw new Error('models table is missing agents');
  return table;
}

function rank(tier) {
  const index = ORDER.indexOf(tier);
  return index < 0 ? 0 : index;
}

function higher(a, b) {
  return rank(a) >= rank(b) ? a : b;
}

// Coordinator override (--tier) wins. Otherwise size is the floor and hints only raise it.
export function classifyTier({ size, files, text, tier } = {}) {
  if (SIZE_CLASSES.includes(tier)) return tier;
  let level = SIZE_CLASSES.includes(size) ? size : 'light';
  const hay = String(text || '').toLowerCase();
  if (/\bdebug|\bbug\b/.test(hay)) level = higher(level, 'medium');
  if (/\breview\b/.test(hay)) level = higher(level, 'medium');
  if (/\barchitect/.test(hay)) level = 'heavy';
  const count = Number(files);
  if (Number.isFinite(count)) {
    if (count >= 20) level = 'heavy';
    else if (count >= 6) level = higher(level, 'medium');
  }
  return level;
}

export function escalateTier(tier) {
  if (tier === 'light') return 'medium';
  if (tier === 'medium') return 'heavy';
  return 'heavy';
}

export function renderArgs(argv, { model, effort } = {}) {
  if (!Array.isArray(argv)) return [];
  const out = [];
  for (const token of argv) {
    if (String(token).includes('{effort}') && (effort == null || effort === '')) continue;
    out.push(String(token).replaceAll('{model}', model ?? '').replaceAll('{effort}', effort ?? ''));
  }
  return out;
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

// Quota and token cost per ai+model. Rows without a model stay out of this map.
export function estimateModelCosts(rows, opts = {}) {
  const decay = opts.decay ?? LEDGER_DEFAULTS.decay;
  const groups = new Map();
  for (const row of rows) {
    if (!row?.ai || typeof row.model !== 'string' || !row.model) continue;
    const key = `${row.ai}\0${row.model}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const estimates = {};
  for (const [key, samples] of groups) {
    const [ai, model] = key.split('\0');
    const quotaDeltas = [];
    const tokenSamples = [];
    for (const sample of samples) {
      if (sample.quotaBefore == null || sample.quotaAfter == null) continue;
      if (sample.quotaAfter < sample.quotaBefore) continue;
      quotaDeltas.push(sample.quotaAfter - sample.quotaBefore);
      if (sample.tokens != null) tokenSamples.push(sample.tokens);
    }
    const quota = weightedAverage(quotaDeltas, decay, null);
    const tokens = weightedAverage(tokenSamples, decay, null);
    if (!estimates[ai]) estimates[ai] = {};
    estimates[ai][model] = {
      quota: quota.value,
      tokens: tokens.value,
      quotaSamples: quota.samples,
      tokenSamples: tokens.samples,
    };
  }
  return estimates;
}

function successStats(rows, ai, tier, model) {
  const samples = rows.filter((row) => row.ai === ai && row.tier === tier && row.model === model && typeof row.ok === 'boolean');
  if (!samples.length) return { samples: 0, rate: null };
  const ok = samples.filter((row) => row.ok).length;
  return { samples: samples.length, rate: ok / samples.length };
}

function catalog(agent) {
  const entries = [];
  const seen = new Set();
  for (const tier of ORDER) {
    const entry = agent.tiers?.[tier];
    if (!entry?.model || seen.has(entry.model)) continue;
    seen.add(entry.model);
    entries.push(entry);
  }
  return entries;
}

export function chooseModel({ table, ai, tier, rows = [], estimates = {} }) {
  const minRate = table?.success?.minRate ?? 0.8;
  const minSamples = table?.success?.minSamples ?? 3;
  const agent = table?.agents?.[ai];
  if (!agent?.tiers?.[tier]) {
    return {
      ai,
      tier,
      model: null,
      effort: null,
      args: [],
      fallback: agent ? 'unknown-tier' : 'unknown-ai',
      samples: 0,
      rate: null,
    };
  }
  const fallback = agent.tiers[tier];
  const ranked = catalog(agent).map((entry) => {
    const hist = estimates?.[ai]?.[entry.model];
    const price = hist && hist.quotaSamples > 0 ? hist.quota : entry.cost ?? 0;
    return { ...entry, price, ...successStats(rows, ai, tier, entry.model) };
  });
  const acceptable = ranked.filter((entry) => entry.samples >= minSamples && entry.rate >= minRate);
  const picked = acceptable.length
    ? acceptable.slice().sort((a, b) => a.price - b.price || String(a.model).localeCompare(String(b.model)))[0]
    : null;
  // One model id can sit on every tier (effort changes). Keep this tier's effort unless a different id won.
  const chosen = picked && picked.model !== fallback.model ? picked : fallback;
  const scored = picked || chosen;
  return {
    ai,
    tier,
    model: chosen.model,
    effort: chosen.effort ?? null,
    cost: chosen.cost ?? null,
    price: scored.price ?? chosen.cost ?? 0,
    args: renderArgs(agent.argv, chosen),
    fallback: picked ? null : 'default-tier',
    samples: scored.samples ?? 0,
    rate: scored.rate ?? null,
  };
}

// A model id that is not in the table for this AI uses the tier default.
export function resolveModel(table, ai, tier, modelId) {
  const route = chooseModel({ table, ai, tier, rows: [], estimates: {} });
  if (!route.model) return route;
  const known = catalog(table.agents[ai] || {}).some((entry) => entry.model === modelId);
  if (modelId && !known) {
    return { ...route, requested: modelId, fallback: 'unknown-model' };
  }
  return route;
}
