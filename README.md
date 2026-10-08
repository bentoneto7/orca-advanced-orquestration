# orca-skills

A team of six AIs working together in [Orca](https://github.com/stablyai/orca), with credit management: before each wave, the skill reads each AI's real quota and gives more work to whoever has the most headroom. **Claude**, **Codex**, **Cursor**, **Grok**, **Antigravity** and **Muse** split the task into parallel waves, with sub-agent expansion. Any of them can coordinate or work as a sub-agent.

**Full tutorial, from step 1 to a finished setup: [docs/TUTORIAL.md](docs/TUTORIAL.md).**

**Understand the whole idea, the dynamics and why it is more efficient: [docs/IDEA.md](docs/IDEA.md).**

## Main benefits

![Team dynamics](docs/img/dynamics.png)

- **Six AIs in parallel.** Claude, Codex, Cursor, Grok, Antigravity and Muse work at the same time, each in its own worktree, in waves with dependencies.
- **Unbiased cross-review.** Every delivery is reviewed by an AI from another vendor, which does not know who wrote it.
- **Credit management with healthy pacing.** Each AI's real quota is read before every wave, without spending tokens. Whoever has more headroom gets more work, whoever is ahead of its window's pace gets less, and Claude and Codex keep 15% for critical review.
- **Automatic reassignment.** If an AI hits its limit mid-run, the task moves right away to the next one with headroom, and the AI without quota sits out until its reset.
- **100% autonomy.** Sub-agents execute everything without asking for confirmation, and Claude and Codex act in Chrome on their own. Only main, deploy and production end up as a ready PR in the report.
- **Token economy.** Replies of up to 15 lines, short handoffs and the cheapest model that does each task.
- **Installers for macOS, Linux and Windows.** One command installs and checks everything in every AI.

![Benefits](docs/img/benefits.png)

![Credit management](docs/img/credit-management.png)

## 100% autonomy

**Sub-agents execute everything on their own, with no confirmations.** Each AI runs in Orca with the arguments that skip approvals, obeys the coordinator 100% and never asks the user. Routine gates are resolved by the coordinator itself. Chrome runs on autopilot too: Claude uses the Claude in Chrome extension in auto mode and Codex has the `chrome`, `browser` and `computer-use` plugins, so both browse, click and test pages without asking for each click. Nothing stops the run, from request to delivery. Details in [docs/IDEA.md](docs/IDEA.md#100-autonomy).

![100% autonomy](docs/img/autonomy.png)

<sub>Only exception, for safety: merge to main, deploy, production, real data, migrations on a real database and secrets are left ready as a PR or command in the final report. The work never stops.</sub>

## What it looks like in Orca

A real (cropped) screenshot of Orca running `/orquestration-avanced`, and the quota reading done before each wave, without spending tokens. More screenshots and the plan and report formats in [docs/IDEA.md](docs/IDEA.md).

![Real screenshot of Orca running /orquestration-avanced](docs/img/print-orca-real.png)

![Real output of cotas.mjs](docs/img/print-quotas.png)

## Quick install

With Orca and the CLIs already installed and logged in:

**macOS / Linux**

```bash
git clone https://github.com/bentoneto7/orca-skills.git
cd orca-skills
bash scripts/instalar.sh
bash scripts/instalar.sh --verificar
```

**Windows**

```powershell
gh repo clone bentoneto7/orca-skills
cd orca-skills
powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1 -Verificar
```

Then, in Orca: **Settings > Agents > Refresh** and open a new session of each agent.

The installer also removes the old `orquestration` skill folders (the skill was renamed to `orquestration-avanced`).

## What's in here

| Path | What it is |
|---|---|
| `skills/orquestration-avanced/` | The team rules: credit management by real quota, each AI's role, board, cross-review between vendors, autonomy with fixed limits and parallel execution (up to 6 workers). |
| `skills/orquestration-avanced/cotas.mjs` | Reads each AI's quota (`orca account list --json`, no tokens spent) and prints the `Quotas` line with usage, pace, reset and each AI's share. |
| `skills/orchestration/` | Orca's official orchestration skill, with the "Zuuuw team" section at the end, which loads `orquestration-avanced`. |
| `config/equipe-orca.md` | Rules for how each AI takes and answers the coordinator's calls. The script writes this text into each AI's global instructions. |
| `config/grok-rules-orca-equipe.md` | The same rules in Grok's format (`~/.grok/rules/`). |
| `config/cursor-rules-orca-equipe.mdc` | The same rules in Cursor's format (`~/.cursor/rules/`). |
| `config/grok-config.toml.example` | Suggested snippet for `~/.grok/config.toml`. |
| `config/orchestration-hook.md` | The "Zuuuw team" section the script appends to Orca's skill. |
| `scripts/instalar.sh` | Installs everything in every AI on macOS/Linux (`--verificar` only checks). |
| `scripts/instalar.ps1` | The same on Windows (`-Verificar` only checks). |

## Usage

In a Claude or Codex session opened by Orca:

```
/orquestration-avanced <what needs to be done>
```
