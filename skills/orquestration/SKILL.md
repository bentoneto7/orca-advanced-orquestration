---
name: orquestration
description: >-
  Equipe multi-IA da Zuuuw no Orca com balanceamento de tokens. Use quando o
  usuario digitar /orquestration, pedir para orquestrar, coordenar varios
  agentes, dividir uma tarefa entre IAs ou montar o board. Ao ser chamada, quebra
  a tarefa automaticamente e distribui entre TODAS as IAs disponiveis (claude,
  codex, cursor, grok, antigravity, muse), em paralelo, com expansao de
  subagentes. Claude e Codex sao os dois principais e alternam o trabalho pesado.
  Carrega a skill orchestration do Orca.
---

# /orquestration - equipe multi-IA no Orca

## 0. Modo automatico (comportamento padrao)
Ao ser chamada, NAO pergunte como dividir. Execute direto, nesta ordem:
1. Setup (secao 1).
2. Decomponha a tarefa e monte o plano no formato da secao 4.
3. Garanta que TODAS as IAs disponiveis recebam pelo menos uma task (secao 3).
4. Crie as tasks no board e dispare a Onda 1 em paralelo (secao 5).
5. Acompanhe, dispare as ondas seguintes, faca a revisao cruzada e entregue (secoes 6 a 10).
So pare para perguntar ao usuario nos gates (secao 9) ou se a tarefa for ambigua a ponto de mudar o resultado.

## 1. Setup
1. Carregue a skill `orchestration` e rode `orca skills get orchestration` (guia da versao instalada).
2. Leia `AGENTS.md` / `CLAUDE.md` do projeto e respeite as regras dele (branches, deploy, dados reais).
3. Crie ou reutilize um Run: `orca orchestration run-create --json` (ou `run-use`).
4. Rode `orca account list --json` e anote `rateLimits` de claude e codex (session = janela de 5h, weekly = semana).
5. Descubra quais IAs estao disponiveis: a equipe padrao e `claude, codex, cursor, grok, antigravity, muse`. Uma IA so fica de fora se o `worker-start` dela falhar duas vezes (deslogada, nao instalada). Nesse caso, registre no plano e redistribua a parte dela.

## 2. Os dois principais: Claude e Codex (balanceados)
Claude e Codex fazem o trabalho pesado e devem ficar com consumo parecido.
- Meta: diferenca de no maximo 15 pontos percentuais entre o uso semanal de claude e codex.
- Coordenacao: quem estiver com MENOS uso semanal coordena. Se a sessao atual for do mais gasto, avise o usuario e sugira abrir o /orquestration no outro (mas siga trabalhando se ele nao responder).
- Implementacao pesada: vai para o principal com menos uso. Em empate, codex implementa e claude coordena.
- O principal que coordena tambem recebe uma task de trabalho (nunca fica so coordenando): em geral a integracao final ou a parte mais critica.
- Se um dos dois passar de 70% na janela de 5h ou de 80% na semana, todo trabalho pesado novo vai para o outro ate equilibrar.
- Se os dois passarem de 80%, quebre as tasks pesadas em pedacos menores e mande para os agentes de apoio.
- Reconsulte `orca account list --json` a cada onda e rebalanceie.

## 3. Todas as IAs trabalham (distribuicao obrigatoria)
Regra: toda execucao do /orquestration usa as seis IAs. Cada uma recebe pelo menos uma task no plano. Se a tarefa parecer pequena demais, quebre mais fino ou use os papeis fixos abaixo, que sempre cabem.

| Agente | Papel principal | Papel fixo (sempre cabe) |
|---|---|---|
| `claude` | Implementacao pesada ou coordenacao + integracao | Integracao final e conferencia do plano |
| `codex` | Implementacao pesada (alterna com claude) | Testes automatizados da entrega |
| `antigravity` | Pesquisa no codigo e leitura ampla (contexto grande) | Mapa do codigo afetado (arquivos, dependencias, riscos) |
| `grok` | Pesquisa web e revisao critica | Revisao cruzada cega de uma entrega |
| `cursor` | Front-end, UI e versao alternativa | Revisao de UI/DX ou documentacao de uso |
| `muse` | Tarefas pequenas em paralelo | Scripts, fixes pontuais, checklist de verificacao |

Regras de tamanho:
- Tarefa pequena (ate ~3 arquivos, sem decisao de arquitetura): `muse` ou `cursor`.
- Leitura de mais de ~20 arquivos ou docs longas: `antigravity`.
- Pesquisa externa: `grok`.
- Tarefa grande ou critica: um dos dois principais (secao 2).
- Rodizio no apoio: nao de mais de 2 tasks seguidas ao mesmo agente de apoio se outro estiver apto.
- Nao use `gemini` (o Gemini CLI so funciona por API; o Google entra pelo `antigravity`).

## 4. Formato do plano (escreva isto antes de disparar)
Monte o plano neste formato e salve no board (cada linha vira uma task). IDs hierarquicos mostram a expansao de subagentes.

```
PLANO /orquestration - <titulo da tarefa>
Coordenador: <claude|codex>   Uso semanal: claude <x>% | codex <y>%
Profundidade de subagentes: <1|2>   (Settings > Orchestration > Nested worker depth)

Onda 1 (paralelo, sem dependencias)
  T1   antigravity  Mapa do codigo afetado                         -> entrega: lista de arquivos + riscos
  T2   grok         Pesquisa externa / boas praticas               -> entrega: 5-10 linhas com fontes
  T3   muse         Preparar scripts/fixtures de teste             -> entrega: arquivos criados
Onda 2 (depende da Onda 1)
  T4   codex        Implementacao principal         deps: T1,T2    [expansivel]
    T4.1 muse       Subparte pequena de T4 (aberta por codex)      -> reporta a codex
    T4.2 cursor     Subparte de UI de T4 (aberta por codex)        -> reporta a codex
  T5   cursor       Front-end / UI                  deps: T1
  T6   codex        Testes automatizados            deps: T3
Onda 3 (revisao e integracao)
  T7   grok         Revisao cruzada cega de T4      deps: T4
  T8   cursor       Revisao cruzada cega de T5/T6   deps: T5,T6
  T9   claude       Integracao final + relatorio    deps: T7,T8

Cobertura: claude T9 | codex T4,T6 | antigravity T1 | grok T2,T7 | cursor T5,T8 | muse T3
```
- A linha "Cobertura" e obrigatoria e precisa citar as seis IAs (ou dizer por que uma ficou de fora, secao 1.5).
- Cada task tem: ID, agente, titulo curto, entrega esperada, `deps` quando houver, e a marca `[expansivel]` se puder abrir subagentes.
- No board: `orca orchestration task-create --spec "<spec completa>" --task-title "<ID> <titulo>" --display-name "<agente> - <ID> <titulo>" [--deps '["<task_id>"]'] [--parent <task_id>] --json`. Subtasks (T4.1) usam `--parent` com o id da task mae.

## 5. Disparo em paralelo
- Dispare todas as tasks de uma onda juntas: um `worker-start` por task, em sequencia, sem esperar o anterior terminar:
  `orca orchestration worker-start --task <id> --agent <agente> --worktree new-child --name <slug> --json`
- Cada worker roda na propria worktree (`new-child`); tasks so de leitura podem usar `--worktree current`.
- Limite: ate 6 workers ao mesmo tempo (um por IA). Se os dois principais estiverem acima de 70% na janela de 5h, baixe para 4.
- So use `--deps` quando a task precisa de fato do resultado de outra; o Orca segura a dependente ate a anterior concluir.
- Se `--agent grok` for recusado pelo `worker-start`, use `orca worktree create --name <slug> --agent grok --prompt "<spec>"` e acompanhe pelo terminal.
- Acompanhe com `task-list`, espere worker_done/escalation e leia cada saida com `worker-read` limitado (15 linhas).

## 6. Expansao de subagentes
A profundidade vem da configuracao do Orca (Settings > Orchestration > Nested worker depth).
- Profundidade 1: so o coordenador abre workers. Tasks `[expansivel]` sao quebradas pelo proprio coordenador em tasks irmas.
- Profundidade 2 (recomendado para tarefas grandes): um worker com task `[expansivel]` pode abrir subagentes:
  - no maximo 2 filhos por worker, e so de agentes de apoio (antigravity, grok, cursor, muse) - nunca claude/codex como filhos, para nao desbalancear a cota;
  - cria as subtasks com `--parent <sua task>` e IDs `T<n>.<m>`, cada uma em worktree propria;
  - filhos reportam ao pai (15 linhas); o pai consolida e reporta ao coordenador uma unica vez;
  - filhos nao abrem netos, mesmo que a profundidade permita.
- Antes de expandir, o worker confere se a soma de workers ativos nao passa do limite da secao 5; se passar, faz sozinho.
- Quando a profundidade do Orca aumentar no futuro, mantenha estas regras e so libere netos se o usuario pedir.

## 7. Economia de tokens
- Cada worker devolve no maximo 15 linhas: o que fez, arquivos alterados, testes, riscos.
- O coordenador le so isso com `worker-read` limitado; abre diffs apenas para decidir.
- Pesquisa pesada nunca no coordenador: vai para `antigravity` ou `grok`.
- Versoes concorrentes (duas IAs na mesma task) so em decisao importante; o padrao e uma faz, outra revisa.

## 8. Revisao cruzada sem vies
- Todo trabalho e revisado por agente de OUTRO fornecedor que nao fez a task (ex.: codex faz, grok revisa; muse faz, cursor revisa; claude faz, codex revisa).
- O revisor nao sabe qual IA fez; aponta erros, nao elogia.

## 9. Gates (perguntar ao usuario)
`gate-create` antes de: arquitetura, apagar codigo/dados, migracao de banco, merge em main, deploy ou acao em producao.

## 10. Entrega final
Resumo: o plano executado (com a linha Cobertura), o que cada IA fez, qual versao venceu e por que, testes rodados, o que falta, e o uso final de claude x codex (% semanal).

## 11. Quando voce for worker (nao coordenador)
- Responda ao coordenador pelo mesmo canal (reply / worker_done) em ate 15 linhas.
- Trabalhe so na sua worktree.
- So abra subagentes se sua task estiver marcada `[expansivel]` e a profundidade permitir (secao 6).
- Decisao de gate: escale ao coordenador, nao decida.
