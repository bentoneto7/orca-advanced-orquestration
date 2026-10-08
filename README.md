# orca-skills

Equipe de seis IAs trabalhando juntas no [Orca](https://github.com/stablyai/orca), com balanceamento de tokens: **Claude** e **Codex** alternam o trabalho pesado conforme a cota de cada um, e **Cursor, Grok, Antigravity e Muse** pegam as subtarefas. Qualquer uma pode coordenar ou ser subagente, e as tarefas independentes rodam em paralelo.

**Tutorial completo, do passo 1 até a configuração concluída: [docs/TUTORIAL.md](docs/TUTORIAL.md).**

## Instalação rápida (Windows)

Com o Orca e as CLIs já instalados e logados:

```powershell
gh repo clone bentoneto7/orca-skills
cd orca-skills
powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1 -Verificar
```

Depois, no Orca: **Settings > Agents > Refresh** e abra uma sessão nova de cada agente.

## O que tem aqui

| Caminho | O que é |
|---|---|
| `skills/orquestration/` | Regras da equipe: balanceamento Claude/Codex pela cota, papel de cada IA, board, revisão cruzada entre fornecedores, gates de aprovação e execução em paralelo (até 4 workers). |
| `skills/orchestration/` | A skill oficial de orquestração do Orca, com a seção "Equipe Zuuuw" no fim, que carrega a `orquestration`. |
| `config/equipe-orca.md` | Regras de como cada IA recebe e responde as chamadas do coordenador. O script grava esse texto nas instruções globais de cada IA. |
| `config/grok-rules-orca-equipe.md` | As mesmas regras no formato do Grok (`~/.grok/rules/`). |
| `config/cursor-rules-orca-equipe.mdc` | As mesmas regras no formato do Cursor (`~/.cursor/rules/`). |
| `config/grok-config.toml.example` | Trecho sugerido para o `~/.grok/config.toml`. |
| `config/orchestration-hook.md` | A seção "Equipe Zuuuw" que o script acrescenta na skill do Orca. |
| `scripts/instalar.ps1` | Instala tudo em todas as IAs (`-Verificar` só confere). |

## Uso

Numa sessão do Claude ou do Codex aberta pelo Orca:

```
/orquestration <o que precisa ser feito>
```
