# Tutorial: equipe de IAs no Orca, do zero até a configuração concluída

Este passo a passo deixa seis IAs trabalhando juntas no [Orca](https://github.com/stablyai/orca): **Claude**, **Codex**, **Cursor**, **Grok**, **Antigravity** e **Muse**, com o trabalho dividido pela cota real de cada uma (quem tem mais folga recebe mais). Qualquer uma pode coordenar ou trabalhar como subagente, e as tarefas independentes rodam em paralelo, cada uma na própria worktree.

Feito para **macOS** (Terminal / zsh) e **Windows 10/11** (PowerShell). Use sempre login pelo navegador, com a sua assinatura de cada serviço, sem API key.

> Dica: durante instalações e logins, espere cada comando terminar antes de rodar o próximo. Depois de instalar uma CLI, **abra um terminal novo** para o PATH valer.

---

## Passo 1. Pré-requisitos

**macOS**

1. **Git** (vem com as Command Line Tools): `xcode-select --install` se `git --version` falhar.
2. **Homebrew** (recomendado): <https://brew.sh>.
3. (Opcional) **GitHub CLI**: `brew install gh` e depois `gh auth login`.

**Windows**

1. **Git for Windows**: <https://git-scm.com/download/win>. O Claude Code usa o Bash que vem com ele.
2. **Node.js 22 ou mais novo**: <https://nodejs.org>.
3. (Opcional) **GitHub CLI**: `winget install GitHub.cli` e depois `gh auth login`.

Confira:

```
git --version
```

## Passo 2. Instalar o Orca

**macOS**

```bash
brew install --cask stablyai/orca/orca
```

Ou baixe o DMG: [Apple Silicon](https://github.com/stablyai/orca/releases/latest/download/orca-macos-arm64.dmg) · [Intel](https://github.com/stablyai/orca/releases/latest/download/orca-macos-x64.dmg).

**Windows**

Baixe e rode o [instalador do Orca para Windows](https://github.com/stablyai/orca/releases/latest/download/orca-windows-setup.exe).

Nos dois sistemas:

1. Abra o Orca e vá em **Settings > General > Orca CLI > Register**. Isso coloca o comando `orca` no PATH.
2. Num terminal novo, confira com `orca --version`.

No Mac, se `orca --version` falhar (symlink quebrado em `/usr/local/bin/orca`), o binário real está em `/Applications/Orca.app/Contents/Resources/bin/orca`. O `scripts/instalar.sh` acha esse caminho sozinho.

## Passo 3. Instalar as CLIs das IAs

Rode um comando por vez.

| IA | macOS / Linux | Windows (PowerShell) | Conferir |
|---|---|---|---|
| Claude Code | `curl -fsSL https://claude.ai/install.sh \| bash` | `irm https://claude.ai/install.ps1 \| iex` | `claude --version` |
| Codex | `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` | `powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 \| iex"` | `codex --version` |
| Cursor CLI | `curl https://cursor.com/install -fsS \| bash` | `irm 'https://cursor.com/install?win32=true' \| iex` | `cursor-agent --version` |
| Grok (Grok Build, xAI) | `curl -fsSL https://x.ai/cli/install.sh \| bash` | `irm https://x.ai/cli/install.ps1 \| iex` | `grok --version` |
| Antigravity CLI (Google) | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` | `irm https://antigravity.google/cli/install.ps1 \| iex` | `agy --version` |
| Muse Code (Meta) | `curl -fsSL https://dev.meta.ai/install.sh \| bash` | `irm https://dev.meta.ai/install.ps1 \| iex` | `muse --version` |

Observações:

- **Cursor e Grok no Windows usam o mesmo nome `agent`.** O Grok instala um `agent.exe`, então no terminal `agent` abre o Grok. Para o Cursor use sempre `cursor-agent` (é esse nome que o Orca chama).
- **No Mac a CLI do Cursor instala como `agent`.** Se `cursor-agent --version` falhar depois do install, e `agent --help` for o Cursor (não o Grok), crie o apelido: `ln -s "$HOME/.local/bin/agent" "$HOME/.local/bin/cursor-agent"`.
- **Gemini CLI não entra.** Desde junho de 2026 o Gemini CLI não aceita mais login de conta Google pessoal, só API key. O acesso ao Google é feito pelo **Antigravity CLI**, que usa o login da conta Google.

## Passo 4. Fazer login em cada IA (pelo navegador)

| IA | Como logar | Conferir se logou |
|---|---|---|
| Claude | rode `claude` e escolha o login com a assinatura (Pro/Max) | `claude auth status` |
| Codex | rode `codex` e escolha **Sign in with ChatGPT** | `codex login status` |
| Cursor | `cursor-agent login` (abre o navegador) | `cursor-agent status` |
| Grok | `grok login` (abre o navegador). Sem navegador: `grok login --device-auth` e digite o código mostrado em <https://grok.com> | `grok models` mostra "You are logged in" |
| Antigravity | rode `agy` e faça o login Google na primeira execução | o rodapé do `agy` mostra a conta e o plano |
| Muse | rode `muse` (ou `muse login`), aceite confiar na pasta e entre com a conta Meta no navegador | `/login` dentro do `muse` mostra a conta |

Se o login do Grok cair (acontece quando o token expira), é só rodar `grok login` de novo.

## Passo 5. Ligar as IAs no Orca

1. No Orca, abra **Settings > Agents** e clique em **Refresh**. Devem aparecer Claude, Codex, Cursor, Grok, Antigravity e Muse.
2. **Desative o Gemini** nessa tela, se ele aparecer.
3. **Agent Permissions**: o padrão do Orca é "Yolo" (os agentes executam sem pedir confirmação). Se preferir confirmar cada ação, mude para **Manual**.
4. Ao abrir o Orca pela primeira vez, aceite importar as contas de `~/.claude` e `~/.codex`. O painel Usage do Orca mostra a cota de Claude, Codex, Cursor, Grok e Antigravity, e é com essa informação que a skill divide o trabalho (o Muse não tem medidor).
5. Em **Settings > Orchestration**, coloque **Nested worker depth = 2**. Assim o coordenador cria workers, e um worker com tarefa grande pode abrir até 2 subagentes de apoio. Com 1, só o coordenador cria workers e a skill quebra tudo sozinha.
6. Para os workers rodarem sem pedir aprovação, confira os argumentos padrão de cada agente no Orca: Claude e Antigravity com `--dangerously-skip-permissions`, Codex com `--dangerously-bypass-approvals-and-sandbox`, Cursor com `--yolo`, Grok com `--permission-mode bypassPermissions` e Muse com `--yolo`. Mesmo assim, a `/orquestration` nunca faz merge na main, deploy, ação em produção ou mudança em dados reais: ela deixa pronto e lista em "Pendente de aprovação" no relatório final.

## Passo 6. Instalar as skills e as regras da equipe

Clone este repositório e rode o script do seu sistema:

**macOS / Linux**

```bash
git clone https://github.com/bentoneto7/orca-skills.git
cd orca-skills
bash scripts/instalar.sh
```

**Windows**

```powershell
cd $HOME\Documents
gh repo clone bentoneto7/orca-skills    # ou: git clone https://github.com/bentoneto7/orca-skills.git
cd orca-skills
powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1
```

O que o script faz (pode rodar de novo quando quiser, ele não duplica nada):

1. Instala as skills oficiais do Orca (`orca-cli` e `orchestration`) em todas as IAs com `orca skills install`.
2. Copia a skill da equipe, `orquestration`, para a pasta de skills de cada IA:

   | IA | Pasta de skills |
   |---|---|
   | Claude | `~/.claude/skills` |
   | Codex e Cursor | `~/.agents/skills` (compartilhada), além de `~/.codex/skills` e `~/.cursor/skills` |
   | Grok | `~/.grok/skills` |
   | Antigravity CLI | `~/.gemini/antigravity-cli/skills` |
   | Muse | instalada com `muse skills install --scope user` |

3. Acrescenta no fim da skill `orchestration` do Orca a seção "Equipe Zuuuw", que manda carregar a `orquestration` sempre que o Orca orquestra.
4. Grava as regras de **como receber chamadas do coordenador** nas instruções globais de cada IA (o texto está em [`config/equipe-orca.md`](../config/equipe-orca.md)):

   | IA | Arquivo de instruções globais |
   |---|---|
   | Claude | `~/.claude/CLAUDE.md` |
   | Codex | `~/.codex/AGENTS.md` |
   | Grok | `~/.grok/rules/orca-equipe.md` |
   | Cursor | `~/.cursor/rules/orca-equipe.mdc` |
   | Antigravity | `~/.gemini/GEMINI.md` |
   | Muse | `~/.config/muse/AGENTS.md` |

   Nos arquivos que já existem, o script só troca o trecho entre `<!-- orca-equipe:inicio -->` e `<!-- orca-equipe:fim -->` e guarda uma cópia `.bak-orca` antes da primeira alteração.

## Passo 7. Configuração do Grok

O Grok já fica pronto com o passo 6 (skills em `~/.grok/skills` e regras em `~/.grok/rules`, que ele carrega em todo projeto). Ajustes recomendados:

1. Abra `~/.grok/config.toml` e compare com [`config/grok-config.toml.example`](../config/grok-config.toml.example). Mescle só o que quiser. Não substitua o arquivo inteiro, porque ele guarda outras configurações suas.
   - `permission_mode = "auto"` pede confirmação só para ações arriscadas.
   - `default_reasoning_effort = "high"` gasta menos que `xhigh` e já basta para revisão e pesquisa.
2. **Grok como worker do Orca:** a ajuda do Orca não lista o Grok entre os ids de agente do `worker-start`. A skill já prevê isso: se o `--agent grok` for recusado, o coordenador abre uma worktree com o Grok assim:

   ```
   orca worktree create --name revisao-grok --agent grok --prompt "<tarefa>"
   ```

3. Confira o login a qualquer momento com `grok models`.

## Passo 8. Recarregar e conferir

1. No Orca: **Settings > Agents > Refresh**.
2. **Feche as sessões abertas** de cada agente e abra novas. Sessões antigas não carregam as skills novas. Só reinicie o Orca se, mesmo assim, algum agente não reconhecer a `/orquestration`.
3. Rode a verificação:

   macOS / Linux: `bash scripts/instalar.sh --verificar`

   Windows: `powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1 -Verificar`

   Ela lista quais CLIs estão no PATH, quais skills cada IA tem, se as regras foram gravadas e a cota de cada IA.

> Sobre o aviso **"Review skill"** em Settings > Orchestration: ele aparece porque a skill `orchestration` foi alterada (a seção "Equipe Zuuuw"). Não é erro. **Não clique em Update** ali, porque isso reinstala a skill original e apaga a ligação. Se clicar sem querer, rode o instalador de novo (`instalar.sh` ou `instalar.ps1`).

## Passo 9. Usar no dia a dia

Abra uma sessão do **Claude** ou do **Codex** no projeto, pelo Orca, e peça:

```
/orquestration <descreva o que precisa ser feito>
```

O coordenador então:

1. Lê a cota real de cada IA com `node <pasta da skill>/cotas.mjs` (usa `orca account list --json` e não gasta tokens) e repete a leitura antes de cada onda. A parte de cada IA é proporcional à folga dela, ajustada pelo ritmo de consumo (quem está adiantado na janela recebe menos) e pelo tamanho do plano. Acima de 80% a IA só revisa; acima de 95% fica de fora até o reset. Claude e Codex guardam 15% da semana para revisão crítica.
2. Quebra a tarefa sozinho, sem perguntar, e monta um plano com IDs (T1, T2, T4.1...) em que **todas as IAs com cota recebem pelo menos uma tarefa**: implementação pesada com quem tem mais folga (em geral Codex ou Claude, mas Cursor, Grok e Muse também pegam implementação de verdade), pesquisa e leitura do código com o Antigravity, pesquisa na web e revisão crítica com o Grok, front-end com o Cursor, tarefas pequenas com o Muse. O plano traz a linha "Cotas" e termina com a linha "Cobertura" mostrando o que cada IA pegou.
3. Dispara em ondas: as tarefas de cada onda saem juntas (até 6 ao mesmo tempo, uma por IA, cada uma na própria worktree) e `--deps` segura as que precisam esperar outra. Tarefas grandes marcadas `[expansivel]` podem abrir até 2 subagentes de apoio.
4. Manda cada entrega para revisão por uma IA de outro fornecedor, sem dizer quem fez.
5. Se uma IA bater o limite no meio do trabalho, passa a tarefa na hora para a próxima com folga. Executa tudo sem pedir aprovação, exceto os limites fixos (merge na main, deploy, produção, dados reais, migração em banco real, segredos), que ficam prontos em "Pendente de aprovação".
6. Termina com um relatório curto, incluindo o bloco Créditos: consumo de cada IA, quem ficou sem cota e os próximos resets.

Configuração concluída.

---

## Problemas comuns

| Sintoma | Solução |
|---|---|
| `orca`, `agy` ou outra CLI "não reconhecido" | Abra um terminal novo. No caso do `orca`, refaça **Settings > General > Orca CLI > Register**. |
| `orca --version` falha no Mac | Use `/Applications/Orca.app/Contents/Resources/bin/orca --version`. O `instalar.sh` já resolve esse caminho. |
| `cursor-agent` não encontrado no Mac | A CLI do Cursor instala como `agent`. Se `agent --help` for o Cursor: `ln -s "$HOME/.local/bin/agent" "$HOME/.local/bin/cursor-agent"`. |
| `agent` abre o Grok em vez do Cursor | Normal no Windows. Use `cursor-agent`. |
| Grok pede login de novo | `grok login` (ou `grok login --device-auth`). |
| Gemini pede API key | Desative o Gemini no Orca e use o Antigravity. |
| Agente não reconhece `/orquestration` | Refresh em Settings > Agents, abra uma sessão nova e rode `bash scripts/instalar.sh --verificar` (Mac) ou `instalar.ps1 -Verificar` (Windows). |
| Atualizou a skill do Orca e a ligação sumiu | Rode o instalador de novo. |
