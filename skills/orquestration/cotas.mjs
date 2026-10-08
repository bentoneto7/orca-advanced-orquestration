#!/usr/bin/env node
// Leitura de cota de cada IA para o /orquestration (custo zero de tokens).
// Uso: node cotas.mjs [--json] [arquivo.json]   (sem arquivo, roda `orca account list --json`)
// Nao imprime e-mails, ids nem credenciais: so percentuais, resets e pesos.
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
  console.log('Cotas: indisponivel (orca account list falhou). Use o painel Usage do Orca e trate todos como 60-80%.');
  process.exit(0);
}

const now = Date.now();
const RESERVA = { claude: 15, codex: 15 }; // reserva para revisao/coordenacao critica
const CAPACIDADE = { claude: 3, codex: 3, cursor: 1, grok: 1, antigravity: 0.3 }; // tamanho relativo do plano
const hora = (ms) => {
  if (!ms) return '?';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
// janela: { usedPercent, windowMinutes, resetsAt } -> uso, % do tempo decorrido, ritmo (uso - tempo)
const janela = (w) => {
  if (!w || typeof w.usedPercent !== 'number') return null;
  const tot = (w.windowMinutes || 0) * 60000;
  const dec = tot && w.resetsAt ? Math.min(100, Math.max(0, 100 * (1 - (w.resetsAt - now) / tot))) : null;
  return { uso: Math.round(w.usedPercent), tempo: dec == null ? null : Math.round(dec), ritmo: dec == null ? 0 : Math.round(w.usedPercent - dec), reset: w.resetsAt, min: w.windowMinutes };
};

const agentes = [];
const add = (nome, plano, jan, extra = {}) => {
  const js = jan.filter(Boolean);
  if (!js.length) return agentes.push({ nome, plano, status: extra.status ?? 'sem medidor', peso: null, ...extra });
  const pior = Math.max(...js.map((x) => x.uso));
  const longa = js.reduce((a, b) => ((b.min || 0) > (a.min || 0) ? b : a)); // semanal/mensal manda no ritmo
  const reserva = RESERVA[nome] ?? 0;
  const folga = Math.max(0, Math.min(...js.map((x) => 100 - x.uso - (x === longa ? reserva : 0))));
  const fator = Math.min(1.5, Math.max(0.5, 1 - longa.ritmo / 50)); // adiantado reduz, atrasado aumenta
  let status = pior >= 95 || folga <= 0 ? 'excluido' : pior >= 80 ? 'so revisao' : pior >= 60 ? 'leve/media' : 'normal';
  if (extra.forcarStatus) status = extra.forcarStatus;
  const peso = status === 'excluido' ? 0 : Math.round(folga * fator * (status === 'so revisao' ? 0.25 : 1) * (CAPACIDADE[nome] ?? 1));
  const resetExcl = status === 'excluido' ? Math.max(...js.filter((x) => x.uso >= 95).map((x) => x.reset || 0), longa.reset || 0) : null;
  agentes.push({ nome, plano, janelas: js, folga, ritmo: longa.ritmo, status, peso, resetExcl, ...extra });
};

const c = rl.claude, x = rl.codex, cu = rl.cursor, g = rl.grok, a = rl.antigravity;
if (c?.status === 'ok') add('claude', '5h+semanal', [janela(c.session), janela(c.weekly)]);
if (x?.status === 'ok') add('codex', x.session ? '5h+semanal' : 'semanal', [janela(x.session), janela(x.weekly)], { creditosExtras: x.extraUsage?.enabled ? 'nao usar' : undefined });
if (cu?.status === 'ok') {
  const b = (n) => cu.buckets?.find((k) => k.name === n);
  add('cursor', 'mensal', [janela(b('Cursor Models') ?? cu.monthly)], { obs: b('Other Models') ? `Other Models ${Math.round(b('Other Models').usedPercent)}%` : undefined });
}
if (g?.status === 'ok') add('grok', 'semanal', [janela(g.weekly)]);
if (a?.status === 'ok') {
  const gem = a.buckets?.find((k) => /gemini/i.test(k.name));
  const cg = a.buckets?.find((k) => /claude|gpt/i.test(k.name));
  const jg = janela(gem), jc = janela(cg);
  const gemOk = jg && jg.uso < 95;
  // Starter: no maximo 1 task curta por onda; sem cota Gemini, roda com --model claude-sonnet-4-6
  add('antigravity', 'Starter semanal', [gemOk ? jg : jc], { modelo: gemOk ? 'gemini (padrao)' : jc && jc.uso < 95 ? 'claude-sonnet-4-6' : null, gemini: jg, claudeGpt: jc, forcarStatus: gemOk || (jc && jc.uso < 95) ? undefined : 'excluido' });
}
add('muse', 'sem medidor', [], { status: 'sem medidor' });

// Muse sem medidor: peso = mediana dos apoios com cota, tasks limitadas
const apoio = agentes.filter((k) => ['cursor', 'grok'].includes(k.nome) && k.peso > 0).map((k) => k.peso).sort((p, q) => p - q);
const muse = agentes.find((k) => k.nome === 'muse');
muse.peso = Math.round(0.7 * (apoio.length ? apoio[Math.floor(apoio.length / 2)] : 40)); // sem medidor: 70% da mediana dos apoios
const soma = agentes.reduce((s, k) => s + (k.peso || 0), 0) || 1;
for (const k of agentes) k.parte = Math.round((100 * (k.peso || 0)) / soma);
const ativos = agentes.filter((k) => k.status !== 'excluido');
const pesado = ativos.filter((k) => ['claude', 'codex'].includes(k.nome) && k.status === 'normal').sort((p, q) => q.peso - p.peso)[0]
  ?? ativos.filter((k) => k.status === 'normal' && k.nome !== 'antigravity' && k.nome !== 'muse').sort((p, q) => q.peso - p.peso)[0];

if (asJson) { console.log(JSON.stringify({ geradoEm: hora(now), agentes, pesado: pesado?.nome ?? null }, null, 2)); process.exit(0); }

const fmt = (k) => {
  if (!k.janelas) return `${k.nome} sem medidor -> ${k.parte}% (tasks limitadas)`;
  const js = k.janelas.map((w) => `${w.uso}%${w.min <= 300 ? ' 5h' : w.min <= 10080 ? ' sem' : ' mes'}`).join(' / ');
  const rit = k.ritmo > 0 ? `+${k.ritmo}` : `${k.ritmo}`;
  let s = `${k.nome} ${js} (ritmo ${rit}, reset ${hora(Math.max(...k.janelas.map((w) => w.reset || 0)))}) ${k.status} -> ${k.parte}%`;
  if (k.nome === 'antigravity') s += ` [gemini ${k.gemini ? k.gemini.uso + '% reset ' + hora(k.gemini.reset) : '?'}; claude/gpt ${k.claudeGpt ? k.claudeGpt.uso + '%' : '?'}; modelo ${k.modelo ?? 'nenhum'}; max 1 task curta/onda]`;
  if (k.status === 'excluido') s = `${k.nome} sem cota ate ${hora(k.resetExcl)} -> 0%`;
  if (k.creditosExtras) s += ' [creditos extras: nao usar]';
  return s;
};
console.log(`Cotas (${hora(now)}): ` + agentes.map(fmt).join(' | '));
console.log(`Pesado: ${pesado?.nome ?? 'ninguem com status normal - quebre em tasks medias'} | Reserva de 15% em claude/codex | ritmo = uso - tempo decorrido da janela (+ adiantado)`);
