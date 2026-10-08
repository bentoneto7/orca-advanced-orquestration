---
name: orquestration
description: >-
  Equipe multi-IA da Zuuuw no Orca com balanceamento de tokens. Use quando o
  usuario digitar /orquestration, pedir para orquestrar, coordenar varios
  agentes, dividir uma tarefa entre IAs ou montar o board. Claude e Codex sao os
  dois principais e alternam o trabalho pesado; cursor, muse, antigravity e grok
  pegam as subatividades. Carrega a skill orchestration do Orca.
---

# /orquestration - equipe multi-IA no Orca

## 1. Antes de tudo
1. Carregue a skill `orchestration` e rode `orca skills get orchestration` (guia da versao instalada).
2. Leia `AGENTS.md` / `CLAUDE.md` do projeto e respeite as regras dele (branches, deploy, dados reais).
3. Crie ou reutilize um Run: `orca orchestration run-create --json` (ou `run-use`).
4. Rode `orca account list --json` e anote `rateLimits` de claude e codex (session = janela de 5h, weekly = semana).

## 2. Os dois principais: Claude e Codex (balanceados)
Claude e Codex fazem o trabalho pesado e devem ficar com consumo parecido.
- Meta: diferenca de no maximo 15 pontos percentuais entre o uso semanal de claude e codex.
- Coordenacao: quem estiver com MENOS uso semanal coordena. Se a sessao atual for do mais gasto, avise o usuario e sugira abrir o /orquestration no outro.
- Implementacao pesada: vai para o principal com menos uso (`--agent codex` ou `--agent claude`). Em empate, codex implementa e claude coordena.
- Se um dos dois passar de 70% na janela de 5h ou de 80% na semana, todo trabalho pesado novo vai para o outro ate equilibrar.
- Se os dois passarem de 80%, quebre as tarefas menores e mande para os agentes de apoio.
- Reconsulte `orca account list --json` a cada 3 tasks disparadas e rebalanceie.

## 3. Agentes de apoio (subatividades)
| Agente | Subatividade | Exemplos |
|---|---|---|
| `antigravity` | Pesquisa e leitura ampla (contexto grande) | Mapear modulos, ler docs, levantar onde algo e usado |
| `grok` | Pesquisa web e revisao critica | Comparar libs, conferir info atual, revisar diffs |
| `cursor` | Front-end e versao alternativa | Componentes de UI, ajustes visuais |
| `muse` | Tarefas pequenas em paralelo | Fixes pontuais, scripts, testes simples |

Regras de tamanho:
- Tarefa pequena (ate ~3 arquivos, sem decisao de arquitetura): `muse` ou `cursor`.
- Leitura de mais de ~20 arquivos ou docs longas: `antigravity`.
- Pesquisa externa: `grok`.
- Tarefa grande ou critica: um dos dois principais (secao 2).
- Rodizio no apoio: nao dispare mais de 2 tasks seguidas para o mesmo agente de apoio se houver outro apto.
- Nao use `gemini` (o Gemini CLI so funciona por API; o Google pessoal entra pelo `antigravity`).

## 4. Board (todo trabalho aparece no board)
- Toda subtarefa vira task: `orca orchestration task-create --spec "..." --task-title "<titulo curto>" --display-name "<agente> - <titulo curto>" --json`.
- Use `--deps` para ordem (pesquisa -> implementacao -> revisao).
- Dispare: `orca orchestration worker-start --task <id> --agent <agente> --worktree new-child --name <slug> --json`.
- Atualize status com `task-update`; consulte com `task-list`.

## 5. Economia de tokens
- Cada worker devolve no maximo 15 linhas: o que fez, arquivos alterados, riscos.
- O coordenador le so isso com `worker-read` limitado; abre diffs apenas para decidir.
- Pesquisa pesada nunca no coordenador: vai para `antigravity` ou `grok`.
- Versoes concorrentes (duas IAs na mesma task) so em decisao importante; o padrao e uma faz, outra revisa.

## 6. Revisao cruzada sem vies
- Todo trabalho e revisado por agente de OUTRO fornecedor que nao fez a task (ex.: codex faz, grok revisa; muse faz, cursor revisa; claude faz, codex revisa).
- O revisor nao sabe qual IA fez; aponta erros, nao elogia.

## 7. Gates (perguntar ao usuario)
`gate-create` antes de: arquitetura, apagar codigo/dados, migracao de banco, merge em main, deploy ou acao em producao.

## 8. Entrega final
Resumo: o que foi feito, quem fez cada parte, qual versao venceu e por que, testes rodados, o que falta, e o uso final de claude x codex (% semanal).

## 9. Execucao em paralelo (todos os agentes)
Todos os agentes (claude, codex, cursor, grok, antigravity, muse) tem as skills `orca-cli`, `orchestration` e `orquestration` instaladas, entao qualquer um pode coordenar ou ser worker.
- Tarefas sem dependencia entre si saem juntas: crie todas no board e chame um `worker-start` para cada uma em sequencia, sem esperar a anterior terminar. Cada worker roda na propria worktree (`--worktree new-child`), entao nao disputam arquivos.
- So use `--deps` quando a tarefa precisa de fato do resultado de outra; o Orca segura a dependente ate a anterior concluir.
- Limite pratico: ate 4 workers ao mesmo tempo (no maximo 2 entre claude/codex e 2 de apoio), para nao estourar a cota nem a maquina.
- Acompanhe todos com `task-list` e espere os eventos worker_done/escalation; leia cada saida com `worker-read` limitado (15 linhas).
- Quando um agente que esta como worker receber uma mensagem do coordenador (`orchestration send`/ask), ele responde pelo mesmo canal (reply) e segue as regras desta skill, sem abrir novos workers sem pedido.
- Tarefas so de leitura podem dividir a worktree atual (`--worktree current`); qualquer tarefa que escreva arquivos usa worktree propria.
- Se `--agent grok` for recusado pelo `worker-start`, use `orca worktree create --name <slug> --agent grok --prompt "<spec>"` e acompanhe pelo terminal.