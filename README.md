# orca-skills

Skills para coordenar varias IAs no [Orca](https://github.com/stablyai/orca) com balanceamento de tokens.

## Skills

- `skills/orquestration` - equipe multi-IA: Claude e Codex como principais, alternando o trabalho pesado conforme a cota de cada um (`orca account list --json`); Cursor, Muse, Antigravity e Grok nas subatividades. Inclui board, revisao cruzada entre fornecedores, gates de aprovacao e execucao em paralelo (ate 4 workers, cada um na propria worktree).
- `skills/orchestration` - a skill oficial de orquestracao do Orca, com uma secao extra no fim ("Equipe Zuuuw") que manda carregar a `orquestration` sempre que o Orca orquestra.

## Instalacao (Windows)

Copie as duas pastas para a pasta de skills de cada agente:

| Agente | Pasta |
|---|---|
| Claude Code | `~/.claude/skills` |
| Codex e Cursor | `~/.agents/skills` (compartilhada) |
| Grok | `~/.grok/skills` |
| Antigravity | `~/.gemini/antigravity/skills` |
| Muse Code | `muse skills install ./skills/orquestration --scope user` |

Depois, no Orca, clique em Refresh em Settings > Agents e abra uma sessao nova de cada agente.

> Ao clicar em Update na skill de orquestracao do Orca, a secao "Equipe Zuuuw" e apagada. Copie a `skills/orchestration` deste repo de volta para restaurar.