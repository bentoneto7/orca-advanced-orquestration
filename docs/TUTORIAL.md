# Tutorial: an AI team in Orca, from zero to a finished setup

This step-by-step guide gets six AIs working together in [Orca](https://github.com/stablyai/orca): **Claude**, **Codex**, **Cursor**, **Grok**, **Antigravity** and **Muse**, with the work split by each one's real quota (whoever has more headroom gets more). Any of them can coordinate or work as a sub-agent, and independent tasks run in parallel, each in its own worktree.

Made for **macOS** (Terminal / zsh) and **Windows 10/11** (PowerShell). Always log in through the browser, with your own subscription to each service, without API keys.

Want the big picture first? Read [the idea and the dynamics](IDEA.md) or go back to the [README](../README.md).

> Tip: during installs and logins, wait for each command to finish before running the next one. After installing a CLI, **open a new terminal** so the PATH takes effect.

---

## Step 1. Prerequisites

**macOS**

1. **Git** (comes with the Command Line Tools): `xcode-select --install` if `git --version` fails.
2. **Homebrew** (recommended): <https://brew.sh>.
3. (Optional) **GitHub CLI**: `brew install gh` and then `gh auth login`.

**Windows**

1. **Git for Windows**: <https://git-scm.com/download/win>. Claude Code uses the Bash that comes with it.
2. **Node.js 22 or newer**: <https://nodejs.org>.
3. (Optional) **GitHub CLI**: `winget install GitHub.cli` and then `gh auth login`.

Check:

```
git --version
```

## Step 2. Install Orca

**macOS**

```bash
brew install --cask stablyai/orca/orca
```

Or download the DMG: [Apple Silicon](https://github.com/stablyai/orca/releases/latest/download/orca-macos-arm64.dmg) · [Intel](https://github.com/stablyai/orca/releases/latest/download/orca-macos-x64.dmg).

**Windows**

Download and run the [Orca installer for Windows](https://github.com/stablyai/orca/releases/latest/download/orca-windows-setup.exe).

On both systems:

1. Open Orca and go to **Settings > General > Orca CLI > Register**. This puts the `orca` command in the PATH.
2. In a new terminal, check with `orca --version`.

On a Mac, if `orca --version` fails (broken symlink at `/usr/local/bin/orca`), the real binary is at `/Applications/Orca.app/Contents/Resources/bin/orca`. `scripts/instalar.sh` finds that path on its own.

## Step 3. Install the AI CLIs

Run one command at a time.

| AI | macOS / Linux | Windows (PowerShell) | Check |
|---|---|---|---|
| Claude Code | `curl -fsSL https://claude.ai/install.sh \| bash` | `irm https://claude.ai/install.ps1 \| iex` | `claude --version` |
| Codex | `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` | `powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 \| iex"` | `codex --version` |
| Cursor CLI | `curl https://cursor.com/install -fsS \| bash` | `irm 'https://cursor.com/install?win32=true' \| iex` | `cursor-agent --version` |
| Grok (Grok Build, xAI) | `curl -fsSL https://x.ai/cli/install.sh \| bash` | `irm https://x.ai/cli/install.ps1 \| iex` | `grok --version` |
| Antigravity CLI (Google) | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` | `irm https://antigravity.google/cli/install.ps1 \| iex` | `agy --version` |
| Muse Code (Meta) | `curl -fsSL https://dev.meta.ai/install.sh \| bash` | `irm https://dev.meta.ai/install.ps1 \| iex` | `muse --version` |

Notes:

- **On Windows, Cursor and Grok both use the name `agent`.** Grok installs an `agent.exe`, so `agent` in the terminal opens Grok. For Cursor always use `cursor-agent` (that is the name Orca calls).
- **On a Mac, the Cursor CLI installs as `agent`.** If `cursor-agent --version` fails after the install, and `agent --help` is Cursor (not Grok), create the alias: `ln -s "$HOME/.local/bin/agent" "$HOME/.local/bin/cursor-agent"`.
- **Gemini CLI is left out.** Since June 2026 the Gemini CLI no longer accepts personal Google account logins, only API keys. Google access goes through the **Antigravity CLI**, which uses the Google account login.

## Step 4. Log in to each AI (through the browser)

| AI | How to log in | Check the login |
|---|---|---|
| Claude | run `claude` and choose the subscription login (Pro/Max) | `claude auth status` |
| Codex | run `codex` and choose **Sign in with ChatGPT** | `codex login status` |
| Cursor | `cursor-agent login` (opens the browser) | `cursor-agent status` |
| Grok | `grok login` (opens the browser). Without a browser: `grok login --device-auth` and enter the code shown at <https://grok.com> | `grok models` shows "You are logged in" |
| Antigravity | run `agy` and do the Google login on the first run | the `agy` footer shows the account and the plan |
| Muse | run `muse` (or `muse login`), agree to trust the folder and sign in with your Meta account in the browser | `/login` inside `muse` shows the account |

If the Grok login drops (it happens when the token expires), just run `grok login` again.

## Step 5. Connect the AIs in Orca

1. In Orca, open **Settings > Agents** and click **Refresh**. Claude, Codex, Cursor, Grok, Antigravity and Muse should show up.
2. **Disable Gemini** on that screen, if it shows up.
3. **Agent Permissions**: Orca's default is "Yolo" (agents execute without asking for confirmation). If you would rather confirm each action, switch to **Manual**.
4. When opening Orca for the first time, accept importing the accounts from `~/.claude` and `~/.codex`. Orca's Usage panel shows the quota of Claude, Codex, Cursor, Grok and Antigravity, and that is the information the skill uses to split the work (Muse has no meter).
5. In **Settings > Orchestration**, set **Nested worker depth = 2**. That way the coordinator creates workers, and a worker with a big task can open up to 2 support sub-agents. With 1, only the coordinator creates workers and the skill breaks everything down itself.
6. For workers to run without asking for approval, check each agent's default arguments in Orca: Claude and Antigravity with `--dangerously-skip-permissions`, Codex with `--dangerously-bypass-approvals-and-sandbox`, Cursor with `--yolo`, Grok with `--permission-mode bypassPermissions` and Muse with `--yolo`. The only exception the skill keeps, for safety, is merge to main, deploy, production actions and changes to real data: it leaves them ready and lists them under "Pending approval" in the final report, without stopping the rest.

## Step 6. Install the skills and the team rules

Clone this repository and run the script for your system:

**macOS / Linux**

```bash
git clone https://github.com/bentoneto7/orca-skills.git
cd orca-skills
bash scripts/instalar.sh
```

**Windows**

```powershell
cd $HOME\Documents
gh repo clone bentoneto7/orca-skills    # or: git clone https://github.com/bentoneto7/orca-skills.git
cd orca-skills
powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1
```

What the script does (you can run it again whenever you want, it does not duplicate anything):

1. Installs Orca's official skills (`orca-cli` and `orchestration`) in every AI with `orca skills install`.
2. Copies the team skill, `orquestration-avanced`, to each AI's skills folder, and removes the old `orquestration` folder if it is there:

   | AI | Skills folder |
   |---|---|
   | Claude | `~/.claude/skills` |
   | Codex and Cursor | `~/.agents/skills` (shared), plus `~/.codex/skills` and `~/.cursor/skills` |
   | Grok | `~/.grok/skills` |
   | Antigravity CLI | `~/.gemini/antigravity-cli/skills` |
   | Muse | installed with `muse skills install --scope user` |

3. Appends the "Zuuuw team" section to the end of Orca's `orchestration` skill, which tells it to load `orquestration-avanced` whenever Orca orchestrates.
4. Writes the rules for **how to take calls from the coordinator** into each AI's global instructions (the text is in [`config/equipe-orca.md`](../config/equipe-orca.md)):

   | AI | Global instructions file |
   |---|---|
   | Claude | `~/.claude/CLAUDE.md` |
   | Codex | `~/.codex/AGENTS.md` |
   | Grok | `~/.grok/rules/orca-equipe.md` |
   | Cursor | `~/.cursor/rules/orca-equipe.mdc` |
   | Antigravity | `~/.gemini/GEMINI.md` |
   | Muse | `~/.config/muse/AGENTS.md` |

   In files that already exist, the script only replaces the part between `<!-- orca-equipe:inicio -->` and `<!-- orca-equipe:fim -->` and keeps a `.bak-orca` copy before the first change.

## Step 7. Grok configuration

Grok is ready after step 6 (skills in `~/.grok/skills` and rules in `~/.grok/rules`, which it loads in every project). Recommended tweaks:

1. Open `~/.grok/config.toml` and compare it with [`config/grok-config.toml.example`](../config/grok-config.toml.example). Merge only what you want. Do not replace the whole file, because it holds your other settings.
   - `permission_mode = "auto"` asks for confirmation only for risky actions.
   - `default_reasoning_effort = "high"` spends less than `xhigh` and is enough for review and research.
2. **Grok as an Orca worker:** Orca's help does not list Grok among the agent ids of `worker-start`. The skill already handles that: if `--agent grok` is rejected, the coordinator opens a worktree with Grok like this:

   ```
   orca worktree create --name grok-review --agent grok --prompt "<task>"
   ```

3. Check the login at any time with `grok models`.

## Step 8. Reload and check

1. In Orca: **Settings > Agents > Refresh**.
2. **Close the open sessions** of each agent and open new ones. Old sessions do not load the new skills. Only restart Orca if, even then, some agent does not recognize `/orquestration-avanced`.
3. Run the check:

   macOS / Linux: `bash scripts/instalar.sh --verificar`

   Windows: `powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1 -Verificar`

   It lists which CLIs are in the PATH, which skills each AI has (and whether each copy is identical to the repository), whether Orca's orchestration skill is linked, whether the rules were written and each AI's quota. It ends with "Check passed." when everything is in place.

> About the **"Review skill"** notice in Settings > Orchestration: it shows up because the `orchestration` skill was changed (the "Zuuuw team" section). It is not an error. **Do not click Update** there, because that reinstalls the original skill and removes the link. If you click it by accident, run the installer again (`instalar.sh` or `instalar.ps1`).

## Step 9. Day-to-day use

Open a **Claude** or **Codex** session in the project, through Orca, and ask:

```
/orquestration-avanced <describe what needs to be done>
```

The coordinator then:

1. Reads each AI's real quota with `node <skill folder>/cotas.mjs` (uses `orca account list --json` and spends no tokens) and repeats the reading before each wave. Each AI's share is proportional to its headroom, adjusted by its spending pace (whoever is ahead in the window gets less) and by plan size. Above 80% an AI only reviews; above 95% it sits out until the reset. Claude and Codex keep 15% of the week for critical review.
2. Breaks the task down on its own, without asking, and writes a plan with IDs (T1, T2, T4.1...) in which **every AI with quota gets at least one task**: heavy implementation with whoever has more headroom (usually Codex or Claude, but Cursor, Grok and Muse also take real implementation), code research and reading with Antigravity, web research and critical review with Grok, front-end with Cursor, small tasks with Muse. The plan has the "Quotas" line and ends with the "Coverage" line showing what each AI took.
3. Dispatches in waves: the tasks of each wave go out together (up to 6 at the same time, one per AI, each in its own worktree) and `--deps` holds back the ones that need to wait for another. Big tasks marked `[expandable]` can open up to 2 support sub-agents.
4. Sends each delivery for review by an AI from another vendor, without saying who wrote it.
5. If an AI hits its limit mid-run, moves the task right away to the next one with headroom. Everything runs with no confirmations; the only exception is the fixed limits (merge to main, deploy, production, real data, migrations on a real database, secrets), which are left ready under "Pending approval".
6. Ends with a short report, including the Credits block: each AI's usage, who ran out of quota and the next resets.

Setup complete.

---

## Common problems

| Symptom | Fix |
|---|---|
| `orca`, `agy` or another CLI "not recognized" | Open a new terminal. For `orca`, redo **Settings > General > Orca CLI > Register**. |
| `orca --version` fails on a Mac | Use `/Applications/Orca.app/Contents/Resources/bin/orca --version`. `instalar.sh` already handles that path. |
| `cursor-agent` not found on a Mac | The Cursor CLI installs as `agent`. If `agent --help` is Cursor: `ln -s "$HOME/.local/bin/agent" "$HOME/.local/bin/cursor-agent"`. |
| `agent` opens Grok instead of Cursor | Normal on Windows. Use `cursor-agent`. |
| Grok asks for login again | `grok login` (or `grok login --device-auth`). |
| Gemini asks for an API key | Disable Gemini in Orca and use Antigravity. |
| Agent does not recognize `/orquestration-avanced` | Refresh in Settings > Agents, open a new session and run `bash scripts/instalar.sh --verificar` (Mac) or `instalar.ps1 -Verificar` (Windows). |
| Still seeing the old `/orquestration` | Run the installer again: it removes the old `orquestration` folders. Then open new sessions. |
| Updated Orca's skill and the link is gone | Run the installer again. |
