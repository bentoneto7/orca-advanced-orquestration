# Orca Advanced Orquestration: multi-agent AI orchestration for Claude Code, Codex, Cursor, Grok, Gemini/Antigravity and Muse

**Run six AI coding agents in parallel in [Orca](https://github.com/stablyai/orca), with real quota and rate-limit balancing and 100% autonomous sub-agents.**

[![GitHub stars](https://img.shields.io/github/stars/bentoneto7/orca-advanced-orquestration?style=flat&logo=github)](https://github.com/bentoneto7/orca-advanced-orquestration/stargazers)
[![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-blue)](docs/TUTORIAL.md)
[![Agents](https://img.shields.io/badge/agents-Claude%20Code%20%7C%20Codex%20%7C%20Cursor%20%7C%20Grok%20%7C%20Antigravity%20%7C%20Muse-7C9CFF)](docs/IDEA.md)
[![Built for Orca](https://img.shields.io/badge/built%20for-Orca-22C55E)](https://github.com/stablyai/orca)

## What is this

`orca-advanced-orquestration` is a **multi-agent orchestration** setup for **AI coding agents**. One request to the `/orca-advanced-orquestration` skill splits the work across **Claude Code**, **OpenAI Codex CLI**, **Cursor CLI**, **Grok CLI**, **Gemini via the Antigravity CLI** and **Muse**, running as **parallel agents** in separate **git worktrees** inside [Orca](https://github.com/stablyai/orca). Before every wave it reads each agent's real usage with zero-token commands, so the work follows each subscription's **quota and rate limits**: whoever has more headroom gets more work, no single AI takes more than about 35% of a wave when the rest of the team has quota, and an agent that hits its limit is replaced on the spot. The coordinator only plans and reviews. Sub-agents run in a scoped permission mode (no bypass flags), obey the coordinator and review each other across vendors.

![Diagram of the team dynamics: one request, a coordinator that reads quotas, up to six parallel workers in git worktrees, cross-review and delivery](docs/img/dynamics.png)

## Contents

- [Main benefits](#main-benefits)
- [Quick start](#quick-start)
- [100% autonomy](#100-autonomy)
- [Model routing](#model-routing)
- [What it looks like in Orca](#what-it-looks-like-in-orca)
- [FAQ](#faq)
- [What's in here](#whats-in-here)
- [Documentation](#documentation)
- [Contributing](#contributing)

## Main benefits

- **Six AIs in parallel.** Claude, Codex, Cursor, Grok, Antigravity and Muse work at the same time, each in its own worktree, in waves with dependencies.
- **Unbiased cross-review.** Every delivery is reviewed by an AI from another vendor, which does not know who wrote it.
- **Credit management with healthy pacing.** Each AI's real quota is read before every wave, without spending tokens. Whoever has more headroom gets more work, whoever is ahead of its window's pace gets less, no AI takes more than about 35% of a wave when at least three have quota, and Claude and Codex keep 15% for critical review.
- **Automatic reassignment.** If an AI hits its limit mid-run, the task moves right away to the next one with headroom, and the AI without quota sits out until its reset.
- **Scoped autonomy.** Sub-agents do routine work without asking the user, inside each CLI's permission mode and deny rules. Chrome autopilot is opt-in, on a separate browser profile that is not logged in. Only main, deploy and production end up as a ready PR in the report.
- **Token economy.** Replies of up to 15 lines, short handoffs and the cheapest model that does each task.
- **Installers for macOS, Linux and Windows.** One command installs and checks everything in every AI.

![Comparison of one AI working in a queue versus six AIs in Orca working in parallel, with six benefit cards](docs/img/benefits.png)

![Credit management: quota used per AI with 60, 80 and 95 percent thresholds, the steps before each round and the healthy pacing chart](docs/img/credit-management.png)

## Quick start

With Orca and the CLIs already installed and logged in (full walkthrough in the [tutorial](docs/TUTORIAL.md)):

**macOS / Linux**

```bash
git clone https://github.com/bentoneto7/orca-advanced-orquestration.git
cd orca-advanced-orquestration
bash scripts/instalar.sh
bash scripts/instalar.sh --verificar
```

**Windows**

```powershell
gh repo clone bentoneto7/orca-advanced-orquestration
cd orca-advanced-orquestration
powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1 -Verificar
```

Then, in Orca: **Settings > Agents > Refresh**, set **Settings > Orchestration > Nested worker depth = 2** and open a new Claude or Codex session in your project:

```
/orca-advanced-orquestration <what needs to be done>
```

The installer also removes the old `orquestration` and `orquestration-avanced` skill folders (the skill was renamed to `orca-advanced-orquestration`).

## 100% autonomy

**Sub-agents do routine work without asking the user.** Each AI runs in a scoped permission mode (Claude `--permission-mode acceptEdits` plus `permissions.deny`, Codex `--full-auto` / workspace-write sandbox, Cursor `--sandbox enabled` with deny rules, Grok `permission_mode = "auto"`, Antigravity and Muse on their default modes). Do not pass `--dangerously-skip-permissions`, `--dangerously-bypass-approvals-and-sandbox`, `--yolo` or `--force`. The coordinator only plans, reviews and delegates. Chrome autopilot is opt-in and must use a separate browser profile that is not logged into personal accounts. Details in [docs/IDEA.md](docs/IDEA.md#100-autonomy).

![100% autonomy: request, coordinator, sub-agents executing in parallel, cross-review and delivery with zero confirmations; the no-approval flags of each AI and Chrome on autopilot](docs/img/autonomy.png)

<sub>Only exception, for safety: merge to main, deploy, production, real data, migrations on a real database and secrets are left ready as a PR or command in the final report. The work never stops.</sub>

## Model routing

Heavy models stay off simple tasks. `config/models.json` is the only routing table: each AI (Claude, Codex, Cursor, Grok, Antigravity/Gemini, Muse) maps `light`, `medium`, and `heavy` to a model id and the CLI flags that pass it (`--model` for Claude, Cursor, Grok, Antigravity, and Muse; Codex uses `-m` plus a reasoning-effort config). The ids are defaults. Edit them when a CLI renames a model. Adding a new LLM or provider is a new entry in that file.

Before each worker starts, `cotas.mjs next` classifies the task (size class, plus optional file count and the words review, debug, and architecture; `--tier` overrides) and prints the AI, the tier, the model, and ready launch args. A light or medium attempt that fails is retried one tier higher, and heavy is the top. After enough history, the picker prefers the cheapest model whose success rate for that tier is at least 80% over at least 3 samples. Otherwise it uses the tier's default model.

## What it looks like in Orca

A real (cropped) screenshot of Orca running the skill, and the quota reading done before each wave, without spending tokens. More screenshots and the plan and report formats in [docs/IDEA.md](docs/IDEA.md).

![Real cropped screenshot of the Orca sidebar with cursor, muse and codex workers in their own worktrees, and the Orca status bar with each AI's quota](docs/img/print-orca-real.png)

![Real terminal output of cotas.mjs: the Quotas line with usage, pace, reset, status and share for each AI](docs/img/print-quotas.png)

## FAQ

**How do I run Claude Code and Codex in parallel?**
Install [Orca](https://github.com/stablyai/orca) and this repository's skills, then run `/orca-advanced-orquestration <task>` in a Claude or Codex session. The coordinator creates tasks on Orca's board and starts each worker with `orca orchestration worker-start --worktree new-child`, so every agent works at the same time in its own git worktree, without touching the others' files.

**How do I avoid hitting Claude usage limits?**
The skill reads Claude's 5-hour and weekly usage before every wave. From 60% Claude only gets light and medium tasks, from 80% it only reviews, and from 95% it sits out until the reset. The coordinator only plans and reviews. Heavy work goes to whichever agent has the most headroom, and no agent takes more than about 35% of a wave when at least three have quota. Claude and Codex keep a 15% weekly reserve for critical review.

**Does checking quotas spend tokens?**
No. `cotas.mjs` reads `orca account list --json`, which is a status command. The skill never sends a prompt just to check quota.

**What happens when an agent hits a rate limit mid-task?**
The worker reports `NO QUOTA until <reset>`, the coordinator marks it as excluded until the reset and reassigns the task right away (`worker-start --retry-of`) to the agent with the most headroom, without asking you.

**Can I use Gemini?**
Through the Antigravity CLI, which uses your Google account login. The Gemini CLI is left out because it no longer accepts personal Google account logins, only API keys. When the Gemini quota runs out, Antigravity can keep working with Claude Sonnet from its own "Claude and GPT models" bucket.

**Do the sub-agents ask for confirmation?**
Routine work, yes. Each agent runs in a scoped permission mode with native deny rules (Claude `permissions.deny` for `git push origin main`, `rm -rf`, `~/.ssh/**` and `**/.env*`; Codex's workspace-write sandbox; Cursor `permissions.deny`). Do not pass `--dangerously-skip-permissions` or `--yolo`. Fixed safety limits (merge to main, deploy, production, real data, real-database migrations, secrets, deleting files outside the worktree) are left ready in the final report instead.

**Do I need API keys?**
No. Every CLI logs in through the browser with your own subscription. Optional: a Docker MCP Toolkit profile named `orca` exposes context7 and sequentialthinking through `docker mcp gateway run --profile orca`. Store those server secrets with `docker mcp secret set`, not in a plaintext config file.

**Which operating systems are supported?**
macOS, Linux and Windows. There is a Bash installer (`scripts/instalar.sh`) and a PowerShell installer (`scripts/instalar.ps1`).

**Do I need all six AIs?**
The default team is all six. An agent leaves a run when it has no quota or when its `worker-start` fails twice (for example, logged out), and its work is redistributed to the others.

## What's in here

| Path | What it is |
|---|---|
| `skills/orca-advanced-orquestration/` | The team rules: credit management by real quota, each AI's role, board, cross-review between vendors, autonomy with fixed limits and parallel execution (up to 6 workers). |
| `skills/orca-advanced-orquestration/cotas.mjs` | Reads each AI's quota (`ORCA_CLI_COMMAND`, then `orca-ide`, then `orca`; no tokens spent) and prints the `Quotas` and `Suggested share` lines. |
| `skills/orchestration/` | Orca's official orchestration skill, with the "Zuuuw team" section at the end, which loads `orca-advanced-orquestration`. |
| `config/equipe-orca.md` | Source of truth for how each AI takes the coordinator's calls. Applies only when an `ORCA_*` variable is set. |
| `config/grok-rules-orca-equipe.md` | Generated from `equipe-orca.md` for `~/.grok/rules/`. |
| `config/cursor-rules-orca-equipe.mdc` | Generated from `equipe-orca.md` for `~/.cursor/rules/` (not `alwaysApply`). |
| `scripts/generate-rules.mjs` | Writes the Grok and Cursor rule files from `equipe-orca.md`. |
| `config/models.json` | Model routing table: tier to model id and CLI flags per AI. Edit it to add a provider. |
| `config/grok-config.toml.example` | Suggested snippet for `~/.grok/config.toml`. |
| `config/orchestration-hook.md` | The "Zuuuw team" section the script appends to Orca's skill. |
| `scripts/instalar.sh` | Installs everything in every AI on macOS/Linux (`--verificar` or `--check` only checks). Needs python3. |
| `scripts/instalar.ps1` | The same on Windows (`-Verificar` or `-Check` only checks). |
| `.github/workflows/ci.yml` | Runs `node --test`, shellcheck and PSScriptAnalyzer. |

## Documentation

- [The idea, the dynamics and why it is more efficient](docs/IDEA.md)
- [Full tutorial, from zero to a finished setup](docs/TUTORIAL.md)
- [The skill itself (`SKILL.md`)](skills/orca-advanced-orquestration/SKILL.md)
- [How to contribute](CONTRIBUTING.md)

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
