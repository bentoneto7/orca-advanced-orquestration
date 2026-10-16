# Orca Advanced Orquestration: multi-agent AI orchestration for Claude Code, Codex, Cursor, Grok, Gemini/Antigravity and Muse

**Run six AI coding agents in parallel in [Orca](https://github.com/stablyai/orca), with real quota and rate-limit balancing and 100% autonomous sub-agents.**

[![GitHub stars](https://img.shields.io/github/stars/bentoneto7/orca-advanced-orquestration?style=flat&logo=github&color=346df2)](https://github.com/bentoneto7/orca-advanced-orquestration/stargazers)
[![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-346df2)](docs/TUTORIAL.md)
[![Agents](https://img.shields.io/badge/agents-Claude%20Code%20%7C%20Codex%20%7C%20Cursor%20%7C%20Grok%20%7C%20Antigravity%20%7C%20Muse-346df2)](docs/IDEA.md)
[![Built for Orca](https://img.shields.io/badge/built%20for-Orca-346df2)](https://github.com/stablyai/orca)

## What is this

`orca-advanced-orquestration` is a **multi-agent orchestration** setup for **AI coding agents**. One request to the `/orca-advanced-orquestration` skill splits the work across **Claude Code**, **OpenAI Codex CLI**, **Cursor CLI**, **Grok CLI**, **Gemini via the Antigravity CLI** and **Muse**, running as **parallel agents** in separate **git worktrees** inside [Orca](https://github.com/stablyai/orca). Before every wave it reads each agent's real usage with zero-token commands, so the work follows each subscription's **quota and rate limits**: whoever has more headroom gets more work, no single AI takes more than about 35% of a wave when the rest of the team has quota, and an agent that hits its limit is replaced on the spot. The coordinator only plans and reviews. Sub-agents run with no confirmation prompts, obey the coordinator and review each other across vendors.

![Diagram of the team dynamics: one request, a coordinator that reads quotas, up to six parallel workers in git worktrees, cross-review and delivery](docs/img/dynamics.png)

## Contents

- [Main benefits](#main-benefits)
- [Quick start](#quick-start)
- [100% autonomy](#100-autonomy)
- [Coordinator promotion](#coordinator-promotion)
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
- **100% autonomy.** Sub-agents execute everything without asking for confirmation, and Claude and Codex act in Chrome on their own. Only main, deploy and production end up as a ready PR in the report.
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

**Sub-agents execute everything on their own, with no confirmations.** Each AI runs in Orca with the arguments that skip approvals (Claude `--dangerously-skip-permissions`, Codex `--dangerously-bypass-approvals-and-sandbox`, Cursor `--yolo`, Grok `--permission-mode bypassPermissions`, Antigravity `--dangerously-skip-permissions`, Muse `--yolo`), obeys the coordinator 100% and never asks the user. The coordinator only plans, reviews and delegates, and resolves routine gates itself. Chrome runs on autopilot too: Claude uses the Claude in Chrome extension in auto mode and Codex has the `chrome`, `browser` and `computer-use` plugins, so both browse, click and test pages without asking for each click. Nothing stops the run, from request to delivery. Details in [docs/IDEA.md](docs/IDEA.md#100-autonomy).

![100% autonomy: request, coordinator, sub-agents executing in parallel, cross-review and delivery with zero confirmations; the no-approval flags of each AI and Chrome on autopilot](docs/img/autonomy.png)

<sub>Only exception, for safety: merge to main, deploy, production, real data, migrations on a real database and secrets are left ready as a PR or command in the final report. The work never stops.</sub>

## Coordinator promotion

When the main AI runs out of quota, any of the six AIs can take over as coordinator: **claude, codex, cursor, grok, antigravity or muse**. You choose who, and your choice always wins:

```text
/orca-advanced-orquestration promote <agent>
```

Type `promote` with no name and the skill suggests the AI with the best status and the most quota headroom (`cotas.mjs` prints it on the `Successor` line). The outgoing coordinator writes `.orca/handoff.md` (plan, waves, workers, open gates, pending approvals, last quota reading) before it runs out. If it already died, the successor rebuilds the same state from Orca's board, `worker-list` and the git branches. The successor then binds the same Orca Run with `orca orchestration run-use`, re-reads the quotas and replans. It gets the full coordinator rank: waves, gates, cross-review and the final report. Running workers keep reporting to the Run, so nothing is restarted.

Orca has no command to re-parent a worker, so the cleanest promotion is a new session of the chosen AI: open it in Orca in the same project and type the command above. The old coordinator sits out until its quota resets, then comes back as a worker or reviewer. Fixed safety limits do not change with the rank. Details: [SKILL.md section 12](skills/orca-advanced-orquestration/SKILL.md#12-coordinator-promotion-succession).

![Coordinator promotion: the main AI runs out of quota, writes a handoff, the AI you choose binds the same Orca Run and continues as coordinator while the workers keep running](docs/img/succession.png)

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

**My main AI ran out of credits. Can another AI take over as coordinator?**
Yes, any of the six. Open a new session of the AI you want in Orca, in the same project, and type `/orca-advanced-orquestration promote <agent>` (for example `promote codex` or `promote grok`). It reads the handoff the old coordinator left in `.orca/handoff.md`, or rebuilds it from the board, binds the same Orca Run with `orca orchestration run-use` and continues as coordinator. With no name, the skill suggests the AI with the most headroom. See [Coordinator promotion](#coordinator-promotion).

**Can I use Gemini?**
Through the Antigravity CLI, which uses your Google account login. The Gemini CLI is left out because it no longer accepts personal Google account logins, only API keys. When the Gemini quota runs out, Antigravity can keep working with Claude Sonnet from its own "Claude and GPT models" bucket.

**Do the sub-agents ask for confirmation?**
No. Each agent runs with its no-approval flag (Claude and Antigravity `--dangerously-skip-permissions`, Codex `--dangerously-bypass-approvals-and-sandbox`, Cursor and Muse `--yolo`, Grok `--permission-mode bypassPermissions`), obeys the coordinator and never asks the user: zero confirmations. The only exception is a short list of fixed safety limits (merge to main, deploy, production, real data, real-database migrations, secrets, deleting files outside the worktree), which are left ready in the final report instead.

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
| `config/grok-config.toml.example` | Suggested snippet for `~/.grok/config.toml`. |
| `config/orchestration-hook.md` | The "Zuuuw team" section the script appends to Orca's skill. |
| `scripts/instalar.sh` | Installs everything in every AI on macOS/Linux (`--verificar` or `--check` only checks). Needs python3. |
| `scripts/instalar.ps1` | The same on Windows (`-Verificar` or `-Check` only checks). |
| `.github/workflows/ci.yml` | Runs `node --test`, shellcheck and PSScriptAnalyzer. |

## Documentation

- [The idea, the dynamics and why it is more efficient](docs/IDEA.md)
- [Full tutorial, from zero to a finished setup](docs/TUTORIAL.md)
- [The skill itself (`SKILL.md`)](skills/orca-advanced-orquestration/SKILL.md)
- [Brand: Zuuuw Studio Aura design tokens](docs/BRAND.md)
- [How to contribute](CONTRIBUTING.md)

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
