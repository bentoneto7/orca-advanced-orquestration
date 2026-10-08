---
name: orquestration
description: >-
  Equipe multi-IA da Zuuuw no Orca com gestao de creditos. Use quando o
  usuario digitar /orquestration, pedir para orquestrar, coordenar varios
  agentes, dividir uma tarefa entre IAs ou montar o board. Ao ser chamada, le a
  cota real de cada IA, quebra a tarefa e distribui entre as IAs com cota
  (claude, codex, cursor, grok, antigravity, muse) em paralelo, com peso pela
  folga de cada uma e expansao de subagentes. Carrega a skill orchestration do Orca.
---

# /orquestration - equipe multi-IA no Orca

## 0. Modo automatico (comportamento padrao)
Ao ser chamada, NAO pergunte como dividir. Execute direto:
1. Setup (secao 1) e leitura de cota (secao 2).
2. Decomponha a tarefa e monte o plano (secao 4), com as linhas Cotas e Cobertura.
3. Crie as tasks no board e dispare a Onda 1 em paralelo (secao 5).
4. Antes de cada onda, releia a cota e rebalanceie. Revise, integre e entregue (secoes 6 a 10).
Nunca pare para perguntar ao usuario: ele nao acompanha os workers. Na duvida, escolha a opcao mais segura e reversivel, registre no board e siga. Limites fixos na secao 9.

## 1. Setup
1. Carregue a skill `orchestration` e rode `orca skills get orchestration`.
2. Leia `AGENTS.md` / `CLAUDE.md` do projeto e respeite as regras dele (branches, deploy, dados reais).
3. Crie ou reutilize um Run: `orca orchestration run-create --json` (ou `run-use`).
4. Equipe padrao: `claude, codex, cursor, grok, antigravity, muse`. Uma IA so sai por falta de cota (secao 2) ou se o `worker-start` dela falhar duas vezes (deslogada). Registre no plano e redistribua.

## 2. Gestao de creditos (cota real + balanco saudavel)
Leitura de cota (custo zero de tokens), antes do plano e antes de CADA onda:
- `node <pasta desta skill>/cotas.mjs` -> imprime a linha `Cotas` pronta (uso por janela, ritmo, reset, status e parte de cada IA). `--json` para detalhes.
- Sem node: `orca account list --json` -> `result.rateLimits` (claude/codex: session 5h + weekly; cursor: monthly, bucket "Cursor Models"; grok: weekly; antigravity: buckets "Gemini Models" e "Claude and GPT models"). Antigravity tambem: `agy -p /usage --output-format json --print-timeout 20s`.
- Muse nao tem medidor. Nunca gaste tokens para medir cota (nada de prompt livre so para checar).

Status por IA (pior janela entre 5h, semanal ou mensal):
- < 60% normal: recebe trabalho pesado ou medio.
- 60-80% leve/media: so tasks leves e medias.
- >= 80% so revisao: nenhuma task pesada; so revisao e tasks curtas.
- >= 95% ou esgotada: excluida ate o reset. No plano: `sem cota ate <reset>`.

Divisao por folga (o padrao, nao sobra): a parte de cada IA e proporcional a `folga x ritmo x capacidade do plano`.
- Folga = 100 - uso, menos uma reserva de 15% na semana de claude e codex (guardada para revisao critica e coordenacao).
- Balanco saudavel (ritmo = uso - % do tempo ja decorrido da janela): adiantada (ritmo > 0) recebe menos; atrasada com folga recebe mais. Meta: nenhuma IA esgota antes do reset.
- Capacidade: claude e codex 3, cursor e grok 1, antigravity 0.3 (Starter: no maximo 1 task curta por onda), muse 70% da mediana de cursor e grok (sem medidor: tasks com escopo fechado).
- Quem tem mais folga trabalha mais e pega o pesado. Codex e o implementador pesado sempre que tiver mais folga que claude. Cursor, grok e muse com folga pegam implementacao de verdade (partes medias/pesadas em paralelo, com revisao cruzada), nao so sobras.
- Claude >= 80%: codex assume o trabalho pesado (e coordena, se a sessao for dele); claude so delega em mensagens curtas e revisa o critico. Revisao de trabalho critico continua com claude ou codex (o de mais folga), usando a reserva.
- Antigravity sem cota Gemini mas com folga em "Claude and GPT models": use `--model claude-sonnet-4-6` no `worker-start` (modelos: `agy models`). Nao use `gemini` (so API).
- Creditos extras ou pagos por uso (ex.: `extraUsage` do codex) nao contam como folga.

Modelo mais barato que resolve: `worker-start --model <id> --effort <low|medium|high>`. Task leve (doc, checklist, ajuste pontual) = modelo menor ou effort low; media = medium; pesada ou critica = padrao/high. No cursor, prefira os "Cursor Models" (bucket proprio) aos "Other Models".

Rate limit no meio do caminho: se um worker reportar erro de cota/rate limit, releia a cota, marque a IA como excluida ate o reset e reatribua a task na hora (`worker-start --retry-of`) para a proxima IA com mais folga, sem perguntar ao usuario.

## 3. Papeis e distribuicao
Toda execucao usa TODAS as IAs com cota: cada uma recebe pelo menos uma task, na proporcao da secao 2. Se a tarefa for pequena, quebre mais fino ou use os papeis fixos.

| Agente | Papel principal | Papel fixo (sempre cabe) |
|---|---|---|
| `claude` | Implementacao pesada ou coordenacao + integracao | Integracao final e revisao critica |
| `codex` | Implementacao pesada | Testes automatizados da entrega |
| `antigravity` | Pesquisa no codigo e leitura ampla | Mapa do codigo afetado (arquivos, riscos) |
| `grok` | Pesquisa web, revisao critica, implementacao media | Revisao cruzada cega de uma entrega |
| `cursor` | Front-end, UI, implementacao media/pesada | Revisao de UI/DX ou documentacao |
| `muse` | Implementacao com escopo fechado em paralelo | Scripts, fixes pontuais, checklist |

- Leitura de mais de ~20 arquivos: `antigravity` (se tiver cota) ou `grok`. Pesquisa externa: `grok`.
- Critico ou de arquitetura: o principal com mais folga, ou cursor/grok com revisao do principal.
- Rodizio: nao de mais de 2 tasks seguidas ao mesmo agente de apoio se outro com folga parecida estiver apto.

## 4. Formato do plano (escreva antes de disparar)
Salve no board; cada linha vira uma task. IDs hierarquicos mostram a expansao.

```
PLANO /orquestration - <titulo>
Coordenador: <claude|codex>   Profundidade de subagentes: <1|2>
Cotas: <linha do cotas.mjs: agente uso 5h/semanal (ritmo, reset) status -> parte%>

Onda 1 (paralelo)
  T1   antigravity  Mapa do codigo afetado                -> lista de arquivos + riscos
  T2   grok         Pesquisa externa                      -> 5-10 linhas com fontes
  T3   muse         Scripts/fixtures de teste             -> arquivos criados
Onda 2
  T4   codex        Implementacao principal   deps: T1,T2  [expansivel]
    T4.1 muse       Subparte de T4                         -> reporta a codex
  T5   cursor       Front-end / UI            deps: T1
  T6   grok         Modulo secundario         deps: T1
Onda 3 (revisao e integracao)
  T7   cursor       Revisao cruzada cega de T4   deps: T4
  T8   codex        Revisao cruzada cega de T5/T6
  T9   claude       Integracao final + relatorio (curto, reserva)

Cobertura: claude T9 | codex T4,T8 | antigravity T1 | grok T2,T6 | cursor T5,T7 | muse T3,T4.1
```
- Cobertura obrigatoria: cita todas as IAs; a excluida aparece como `sem cota ate <reset>`.
- Cada task: ID, agente, titulo, entrega, `deps` quando houver, `[expansivel]` se puder abrir subagentes, e `--model/--effort` quando for leve.
- Board: `orca orchestration task-create --spec "<spec>" --task-title "<ID> <titulo>" --display-name "<agente> - <ID> <titulo>" [--deps '["<id>"]'] [--parent <id>] --json`.

## 5. Disparo em paralelo
- Dispare a onda inteira junta: `orca orchestration worker-start --task <id> --agent <agente> [--model <id> --effort <nivel>] --worktree new-child --name <slug> --json`.
- Tasks so de leitura podem usar `--worktree current`.
- Ate 6 workers ao mesmo tempo; 4 se claude e codex estiverem ambos >= 80%.
- `--deps` so quando a task precisa do resultado de outra.
- Se `--agent grok` for recusado, use `orca worktree create --name <slug> --agent grok --prompt "<spec>"`.
- Acompanhe com `task-list`; leia cada saida com `worker-read` limitado (15 linhas).

## 6. Expansao de subagentes
Profundidade em Settings > Orchestration > Nested worker depth.
- Profundidade 1: so o coordenador abre workers; tasks `[expansivel]` viram tasks irmas.
- Profundidade 2: worker com task `[expansivel]` abre no maximo 2 filhos, com `--parent`, IDs `T<n>.<m>` e worktree propria. Filhos so de IAs com status normal ou leve/media, nunca claude se ele estiver >= 80%. Filhos reportam ao pai (15 linhas), o pai consolida uma vez, e filhos nao abrem netos.
- Antes de expandir, confira o limite de workers da secao 5; se passar, faca sozinho.

## 7. Economia de tokens
- Worker devolve no maximo 15 linhas: o que fez, arquivos, testes, riscos.
- Handoff curto: a spec leva so o necessario (arquivos, objetivo, criterio de pronto), sem colar arquivos grandes.
- Coordenador nao rele arquivos grandes; abre diffs so para decidir. Pesquisa pesada vai para antigravity ou grok.
- Versoes concorrentes so em decisao importante; o padrao e uma faz, outra revisa.

## 8. Revisao cruzada sem vies
- Todo trabalho e revisado por agente de OUTRO fornecedor (ex.: codex faz, cursor revisa; muse faz, grok revisa; cursor faz, codex revisa).
- O revisor nao sabe qual IA fez; aponta erros, nao elogia.

## 9. Autonomia total e limites fixos
- Todos rodam sem pedir aprovacao. Workers obedecem 100% ao coordenador, sem pedir confirmacao a ninguem.
- O coordenador resolve sozinho os gates de rotina (arquitetura, refatoracao, apagar codigo na worktree, migracao nova): decide, registra com `gate-create` + `gate-resolve` e segue.
- Limites fixos, que ninguem executa nem com ordem: merge ou push na main, deploy, acao em producao, apagar ou alterar dados reais, rodar migracao em banco real, mexer em segredos ou credenciais, apagar arquivos fora da worktree.
- Ao chegar num limite fixo, deixe pronto (branch, PR, comando) e liste em "Pendente de aprovacao" no relatorio. Nao pare o resto.

## 10. Entrega final
Resumo: plano executado (Cotas e Cobertura), o que cada IA fez, qual versao venceu e por que, testes, decisoes tomadas sozinho, "Pendente de aprovacao" (com comando ou PR pronto) e o bloco Creditos: consumo por agente no inicio e no fim (rode `cotas.mjs` de novo), quem ficou excluido e ate quando, reatribuicoes por rate limit e proximos resets.

## 11. Quando voce for worker
- Responda pelo mesmo canal (reply / worker_done) em ate 15 linhas.
- Trabalhe so na sua worktree. Subagentes so com `[expansivel]` (secao 6).
- Obedeca 100% ao coordenador; nunca pergunte ao usuario. Duvida de escopo: `orca orchestration ask`; sem resposta, opcao mais segura e siga.
- Erro de cota ou rate limit: pare e reporte na hora `SEM COTA ate <reset>` ao coordenador, para ele reatribuir.
- Limites fixos da secao 9: nao execute; prepare e reporte.
