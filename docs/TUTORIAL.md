# Tutorial: equipe de IAs no Orca, do zero até a configuração concluída

Este passo a passo deixa seis IAs trabalhando juntas no [Orca](https://github.com/stablyai/orca): **Claude** e **Codex** como agentes principais (o trabalho pesado alterna entre os dois conforme a cota de cada um) e **Cursor, Grok, Antigravity e Muse** nas subtarefas. Qualquer uma pode coordenar ou trabalhar como subagente, e as tarefas independentes rodam em paralelo, cada uma na própria worktree.

Feito para Windows 10/11 com PowerShell. Use sempre login pelo navegador, com a sua assinatura de cada serviço, sem API key.

> Dica: durante instalações e logins, espere cada comando terminar antes de rodar o próximo. Depois de instalar uma CLI, **feche e abra o PowerShell** para o PATH novo valer.

---

## Passo 1. Pré-requisitos

1. **Git for Windows**: <https://git-scm.com/download/win>. O Claude Code usa o Bash que vem com ele.
2. **Node.js 22 ou mais novo**: <https://nodejs.org>.
3. (Opcional) **GitHub CLI**, para clonar este repositório: `winget install GitHub.cli` e depois `gh auth login`.

Confira:

```powershell
git --version
node --version
```

## Passo 2. Instalar o Orca

1. Baixe e rode o [instalador do Orca para Windows](https://github.com/stablyai/orca/releases/latest/download/orca-windows-setup.exe).
2. Abra o Orca e vá em **Settings > General > Orca CLI > Register**. Isso coloca o comando `orca` no PATH.
3. Num PowerShell novo, confira com `orca --version`.

## Passo 3. Instalar as CLIs das IAs

Rode um comando por vez, todos no PowerShell:

| IA | Instalação | Conferir |
|---|---|---|
| Claude Code | `irm https://claude.ai/install.ps1 \| iex` | `claude --version` |
| Codex | `powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 \| iex"` | `codex --version` |
| Cursor CLI | `irm 'https://cursor.com/install?win32=true' \| iex` | `cursor-agent --version` |
| Grok (Grok Build, xAI) | `irm https://x.ai/cli/install.ps1 \| iex` | `grok --version` |
| Antigravity CLI (Google) | `irm https://antigravity.google/cli/install.ps1 \| iex` | `agy --version` |
| Muse Code (Meta) | `irm https://dev.meta.ai/install.ps1 \| iex` | `muse --version` |

Observações:

- **Cursor e Grok usam o mesmo nome `agent`.** O Grok instala um `agent.exe`, então no terminal `agent` abre o Grok. Para o Cursor use sempre `cursor-agent` (é esse nome que o Orca chama).
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
4. Ao abrir o Orca pela primeira vez, aceite importar as contas de `~/.claude` e `~/.codex`. Só essas duas mostram consumo de cota no Orca, e é com essa informação que a skill decide quem pega o trabalho pesado.
5. Em **Settings > Orchestration**, deixe **Nested worker depth = 1**: o coordenador cria workers, e os workers não criam outros.

## Passo 6. Instalar as skills e as regras da equipe

Clone este repositório e rode o script:

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
   | Claude | `~\.claude\skills` |
   | Codex e Cursor | `~\.agents\skills` (compartilhada), além de `~\.codex\skills` e `~\.cursor\skills` |
   | Grok | `~\.grok\skills` |
   | Antigravity CLI | `~\.gemini\antigravity-cli\skills` |
   | Muse | instalada com `muse skills install --scope user` |

3. Acrescenta no fim da skill `orchestration` do Orca a seção "Equipe Zuuuw", que manda carregar a `orquestration` sempre que o Orca orquestra.
4. Grava as regras de **como receber chamadas do coordenador** nas instruções globais de cada IA (o texto está em [`config/equipe-orca.md`](../config/equipe-orca.md)):

   | IA | Arquivo de instruções globais |
   |---|---|
   | Claude | `~\.claude\CLAUDE.md` |
   | Codex | `~\.codex\AGENTS.md` |
   | Grok | `~\.grok\rules\orca-equipe.md` |
   | Cursor | `~\.cursor\rules\orca-equipe.mdc` |
   | Antigravity | `~\.gemini\GEMINI.md` |
   | Muse | `~\.config\muse\AGENTS.md` |

   Nos arquivos que já existem, o script só troca o trecho entre `<!-- orca-equipe:inicio -->` e `<!-- orca-equipe:fim -->` e guarda uma cópia `.bak-orca` antes da primeira alteração.

## Passo 7. Configuração do Grok

O Grok já fica pronto com o passo 6 (skills em `~\.grok\skills` e regras em `~\.grok\rules`, que ele carrega em todo projeto). Ajustes recomendados:

1. Abra `~\.grok\config.toml` e compare com [`config/grok-config.toml.example`](../config/grok-config.toml.example). Mescle só o que quiser. Não substitua o arquivo inteiro, porque ele guarda outras configurações suas.
   - `permission_mode = "auto"` pede confirmação só para ações arriscadas.
   - `default_reasoning_effort = "high"` gasta menos que `xhigh` e já basta para revisão e pesquisa.
2. **Grok como worker do Orca:** a ajuda do Orca não lista o Grok entre os ids de agente do `worker-start`. A skill já prevê isso: se o `--agent grok` for recusado, o coordenador abre uma worktree com o Grok assim:

   ```powershell
   orca worktree create --name revisao-grok --agent grok --prompt "<tarefa>"
   ```

3. Confira o login a qualquer momento com `grok models`.

## Passo 8. Recarregar e conferir

1. No Orca: **Settings > Agents > Refresh**.
2. **Feche as sessões abertas** de cada agente e abra novas. Sessões antigas não carregam as skills novas. Só reinicie o Orca se, mesmo assim, algum agente não reconhecer a `/orquestration`.
3. Rode a verificação:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1 -Verificar
   ```

   Ela lista quais CLIs estão no PATH, quais skills cada IA tem, se as regras foram gravadas e a cota do Claude e do Codex.

> Sobre o aviso **"Review skill"** em Settings > Orchestration: ele aparece porque a skill `orchestration` foi alterada (a seção "Equipe Zuuuw"). Não é erro. **Não clique em Update** ali, porque isso reinstala a skill original e apaga a ligação. Se clicar sem querer, rode o `instalar.ps1` de novo.

## Passo 9. Usar no dia a dia

Abra uma sessão do **Claude** ou do **Codex** no projeto, pelo Orca, e peça:

```
/orquestration <descreva o que precisa ser feito>
```

O coordenador então:

1. Confere a cota do Claude e do Codex (`orca account list --json`). Quem estiver com menos uso na semana coordena e o outro pega a implementação pesada. A diferença de uso semanal entre os dois fica em até 15 pontos.
2. Divide o trabalho no board: implementação pesada com Claude/Codex, pesquisa e leitura do código com o Antigravity, pesquisa na web e revisão crítica com o Grok, front-end com o Cursor, tarefas pequenas com o Muse.
3. Dispara em paralelo as tarefas que não dependem uma da outra (até 4 ao mesmo tempo, cada uma na própria worktree) e usa `--deps` para as que precisam esperar outra.
4. Manda cada entrega para revisão por uma IA de outro fornecedor, sem dizer quem fez.
5. Para e pergunta a você antes de: mudança de arquitetura, apagar código ou dados, migração de banco, merge na main, deploy ou produção.
6. Termina com um relatório curto, incluindo o uso semanal do Claude e do Codex.

Configuração concluída.

---

## Problemas comuns

| Sintoma | Solução |
|---|---|
| `orca`, `agy` ou outra CLI "não reconhecido" | Feche e abra o PowerShell. No caso do `orca`, refaça **Settings > General > Orca CLI > Register**. |
| `agent` abre o Grok em vez do Cursor | Normal. Use `cursor-agent`. |
| Grok pede login de novo | `grok login` (ou `grok login --device-auth`). |
| Gemini pede API key | Desative o Gemini no Orca e use o Antigravity. |
| Agente não reconhece `/orquestration` | Refresh em Settings > Agents, abra uma sessão nova e rode o `instalar.ps1 -Verificar`. |
| Atualizou a skill do Orca e a ligação sumiu | Rode `instalar.ps1` de novo. |
