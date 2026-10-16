# The idea: one request, six AIs working together

This document explains the idea behind `orca-advanced-orquestration`: why use six AIs at the same time, how they organize themselves and why that gets more done than a single AI. To install, go straight to the [tutorial](TUTORIAL.md); for the overview, see the [README](../README.md) and the [skill itself](../skills/orca-advanced-orquestration/SKILL.md).

## The problem

The usual way to code with AI is to open one assistant and ask it for everything, one thing after another. That has three limits:

- **A queue.** One AI does one task at a time. Research, implementation, tests and review wait in line behind each other.
- **A single quota.** Every subscription has a usage limit. When it runs out, work stops until the reset, even if you pay for other AIs that are sitting idle.
- **A single point of view.** The same AI that writes the code reviews it, and it tends not to see its own mistakes.

In practice it showed up like this: the Gemini quota ran out, Claude went past 80% of its week, and the other subscriptions (Codex, Cursor, Grok, Muse) still had plenty of unused headroom.

## The idea

Treat the subscriptions as a **team**, not as separate tools. You make a single request and the `/orca-advanced-orquestration` skill, inside [Orca](https://github.com/stablyai/orca), splits the work across six AIs at the same time:

| AI | Plan | Main role |
|---|---|---|
| **Claude** | Max (5 h window + weekly) | Coordination, heavy implementation, integration and critical review |
| **Codex** | Pro (5 h window + weekly) | Heavy implementation and tests |
| **Cursor** | Pro Plus (monthly) | Front-end, UI, medium and heavy implementation |
| **Grok** | Weekly | Web research, critical review, medium implementation |
| **Antigravity** | Starter (weekly) | Broad code reading and a map of what will be affected |
| **Muse** | No quota meter | Tightly scoped parts, scripts and small fixes |

The pillars of the idea:

1. **Parallelism.** Up to 6 workers at the same time, each in its own git worktree. With **Nested worker depth = 2**, a worker with a big task can also open up to 2 support sub-agents.
2. **Spread by remaining quota.** The coordinator (Claude or Codex) only plans, reviews and delegates. Implementation is split across every AI that still has quota, in proportion to headroom, and no single AI takes more than about 35% of a wave when at least three have quota. Heavy tasks go to whichever AI has the most headroom.
3. **Scoped autonomy.** Sub-agents execute routine work without asking the user: they obey the coordinator, stay inside a scoped permission mode, and do not use bypass flags. Chrome autopilot stays off unless you opt in with a separate unlogged browser profile (see [100% autonomy](#100-autonomy)).
4. **Cross-review.** One AI's work is reviewed by an AI from another vendor.
5. **Credit management.** The split follows each AI's real quota and spending pace, so none runs out before its reset.
6. **Token economy.** Short handoffs, compact rules and no re-reading of large files.
7. **Reproducible setup.** The PC's setup is the source of truth and is kept in sync with git. The installers for Windows, macOS and Linux recreate everything with one command.

## How the dynamics work

![Diagram of the team dynamics: one request, a coordinator that reads quotas, up to six parallel workers in git worktrees, cross-review and delivery](img/dynamics.png)

```mermaid
flowchart LR
    P[Single request] --> C[Coordinator<br/>Claude or Codex]
    C --> Q[Reads quotas<br/>no tokens spent]
    Q --> PL[Plan by headroom<br/>tasks on the board]
    PL --> W1[Codex]
    PL --> W2[Cursor]
    PL --> W3[Grok]
    PL --> W4[Muse]
    PL --> W5[Antigravity]
    PL --> W6[Claude]
    W1 & W2 & W3 & W4 & W5 & W6 --> R[Cross-review<br/>another vendor]
    R --> F[Final report<br/>+ Credits block]
    Q -. before each wave .-> PL
```

Step by step:

1. **Request.** You describe the goal once: `/orca-advanced-orquestration <what needs to be done>`.
2. **Coordinator.** Claude or Codex takes over coordination. If Claude is above 80%, Codex takes the heavy work.
3. **Quota reading.** The coordinator runs `cotas.mjs`, which reads `orca account list --json` and spends no tokens. Out comes a `Quotas` line with usage, pace, reset and each AI's share.
4. **Plan.** The task is broken down automatically, without asking, into tasks with IDs (T1, T2, T4.1...) organized in waves. The "Coverage" line shows what each AI took. Every AI with quota gets at least one task only when the job has 4 or more subtasks.
5. **Parallel waves.** The tasks of each wave go out together, each in its own worktree. `--deps` only holds back what depends on another delivery. Tasks marked `[expandable]` can open up to 2 sub-agents.
6. **Rebalancing.** Before each wave, quotas are read again and the split is adjusted.
7. **Cross-review.** Each delivery is reviewed by an AI from another vendor, which does not know who wrote it and points out errors instead of praising.
8. **Delivered.** The run goes from request to delivery with no stop for confirmation. The final report shows what was done, by which AI, the decisions taken and the Credits block.

### The plan, in the skill's format

This is the plan format defined in `SKILL.md`. Each line becomes a task on Orca's board, and the Quotas line uses the real numbers from Oct 8, 2026, 7:28 PM (Brasília time):

![Plan format of /orca-advanced-orquestration: Quotas line, three waves of tasks T1 to T9 with dependencies and the Coverage line](img/print-plan.png)

### In practice, inside Orca

A real screenshot of the Orca window, cropped to show only the structure. Each task becomes a worktree named `<agent> - <ID> <title>`, a child of the coordinator's session, and the status bar shows the quota the skill reads:

![Real cropped screenshot of the Orca sidebar with cursor, muse and codex workers in their own worktrees, and the Orca status bar with each AI's quota](img/print-orca-real.png)

## Why it is more efficient

![Comparison of one AI working in a queue versus six AIs in Orca working in parallel, with six benefit cards](img/benefits.png)

- **Real parallelism.** Research, implementation, tests and documentation move at the same time instead of waiting in a queue. Separate worktrees keep one AI from getting in another's way.
- **Combined quota.** The limit is no longer one subscription's, it is the sum of all of them. When one gets tight, the others absorb the work, and the subscriptions you already pay for stop sitting idle.
- **No single point of failure.** If an AI hits its limit, gets logged out or hangs, the task moves right away to the next one with headroom. The work goes on.
- **Less bias.** The reviewer comes from another vendor, trained differently. Mistakes the same AI that wrote the code would miss have a better chance of showing up.
- **Combined strengths.** Each AI does what it does best: Codex and Claude on the heavy work, Cursor on the interface, Grok on research and critique, Antigravity on broad code reading, Muse on scoped parts.
- **Scoped autonomy.** No sub-agent stops to ask the user about routine work inside its worktree. Chrome clicks are opt-in, on a separate unlogged profile. Work flows from request to delivery while you do something else.

> **Example (illustrative):** for a feature with front-end, back-end and tests, a single AI would do research, back-end, front-end, tests and review in sequence. In the team, Antigravity maps the code while Grok researches. Then Codex builds the back-end while Cursor builds the interface, and each reviews the other's work.

## Credit management

![Credit management: quota used per AI with 60, 80 and 95 percent thresholds, the steps before each round and the healthy pacing chart](img/credit-management.png)

Credit management was born when Gemini ran out and Claude went past 80%. The rule is simple: **each AI spends at the pace of its own quota**.

- **Real and free reading.** Before the plan and before each wave, `cotas.mjs` reads each AI's quota without spending tokens. No prompt is ever sent just to check quota.
- **Thresholds by the worst window** (5 h, weekly or monthly): below 60% is normal; from 60% to 80%, only light and medium tasks; from 80%, only reviews and short tasks; from 95%, out until the reset.
- **Proportional split.** Each AI's share is proportional to `headroom × pace × plan size`.
- **Healthy pacing.** Pace is usage minus the time already elapsed in the window. Whoever is spending too fast gets less; whoever is behind with headroom gets more. The goal is that no AI runs out before its reset.
- **Reserve.** Claude and Codex keep 15% of the week for critical review and coordination.
- **More work for whoever has headroom.** Implementation is spread across every AI with quota. No single AI takes more than about 35% of a wave when at least three have quota. The coordinator only plans and reviews.
- **Antigravity without Gemini.** If the Gemini quota runs out but "Claude and GPT models" still has room, it runs with Claude Sonnet and takes a share of the remaining quota like the others.
- **Cheapest model that does the job.** A light task gets a smaller model or low effort; only heavy work uses the default model or high effort.
- **Rate limit mid-run.** The worker reports `NO QUOTA until <reset>` and the coordinator reassigns the task right away, without asking.
- **Extra credits do not count.** Separately paid usage is not treated as headroom.
- **Accountability.** The final report has the Credits block: each AI's usage at the start and at the end, who sat out and until when, the reassignments and the next resets.

A real reading taken on the PC on Oct 8, 2026, at 7:28 PM (Brasília time). It confirms the idea: Claude, with 77% of its week used and ahead of its pace, is in light/medium and gets only a small share; Gemini ran out, so Antigravity runs with Claude Sonnet; and Codex, with headroom, gets the heavy work while Cursor and Grok take real chunks.

![Real terminal output of cotas.mjs: the Quotas line with usage, pace, reset, status and share for each AI, plus orca status](img/print-quotas.png)

## 100% autonomy

> [!IMPORTANT]
> **Sub-agents do routine work without asking the user.** They obey the coordinator, stay inside a scoped permission mode, and do not use bypass flags. You make the request and get the delivery.

![100% autonomy: request, coordinator, sub-agents executing in parallel, cross-review and delivery with zero confirmations; the no-approval flags of each AI and Chrome on autopilot](img/autonomy.png)

```mermaid
flowchart LR
    P[Request] --> C[Coordinator]
    C --> S[Sub-agents execute<br/>in parallel, no confirmations]
    S --> R[Cross-review]
    R --> E[Delivered]
```

### Scoped permissions

Do not pass bypass flags (`--dangerously-skip-permissions`, `--dangerously-bypass-approvals-and-sandbox`, `--yolo`, `--force`, or Grok `bypassPermissions`). Each CLI runs in a scoped mode, plus its own deny rules where it has them.

| AI | Launch |
|---|---|
| Claude | `--permission-mode acceptEdits` and the `permissions.deny` list below in `~/.claude/settings.json` |
| Codex | `--full-auto` (workspace-write sandbox). If Codex warns that `--full-auto` is deprecated, use `--sandbox workspace-write`. The sandbox is the native boundary: shell writes stay in the workspace. |
| Cursor | `--sandbox enabled`, with `approvalMode` set to `auto-review` or `allowlist` in `~/.cursor/cli-config.json`. Deny rules live in `permissions.deny`. |
| Grok | `--permission-mode auto` and `yolo = false` in `~/.grok/config.toml` (see [`config/grok-config.toml.example`](../config/grok-config.toml.example)) |
| Antigravity | default approval. Do not pass `--dangerously-skip-permissions`. |
| Muse | default permission mode. Do not pass `--yolo`. Where Muse exposes a permissions file, deny the same classes as Claude. |

Claude deny list (`~/.claude/settings.json`). `acceptEdits` auto-accepts edits in the working directory and still honors deny rules. `Bash(rm -rf *)` blocks recursive deletes, including paths outside the worktree:

```json
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "deny": [
      "Bash(git push origin main*)",
      "Bash(rm -rf *)",
      "Read(~/.ssh/**)",
      "Edit(~/.ssh/**)",
      "Read(**/.env*)",
      "Edit(**/.env*)"
    ]
  }
}
```

Cursor deny list (`~/.cursor/cli-config.json`), in that CLI's token syntax:

```json
{
  "version": 1,
  "approvalMode": "auto-review",
  "sandbox": { "mode": "enabled" },
  "permissions": {
    "allow": [],
    "deny": [
      "Shell(git:push origin main*)",
      "Shell(rm)",
      "Read(~/.ssh/**)",
      "Read(**/.env*)",
      "Write(**/.env*)"
    ]
  }
}
```

Codex does not use that JSON list. `--full-auto` selects the workspace-write sandbox (`--sandbox workspace-write` is the current spelling when the compatibility flag warns).

### The coordinator is in charge

- **Full obedience.** Sub-agents obey the coordinator 100% and execute without asking anyone for approval or confirmation.
- **They never ask the user.** You do not watch the sub-agents, so nobody stops to wait for you. Scope doubts go to the coordinator with `orca orchestration ask`; with no answer, the sub-agent picks the safest reversible option, logs it and moves on.
- **Routine gates resolved by the coordinator itself.** Architecture, refactoring, deleting code inside the worktree or creating a new migration: it decides alone, logs it on the board with `gate-create` + `gate-resolve` and moves on.

### Chrome (opt-in)

Browser autopilot is off unless you turn it on. Do not point it at the Chrome profile you use every day.

To opt in, create a separate browser profile that is not logged into personal accounts (no mail, bank, or cloud sessions), then:

- **Claude:** install the **Claude in Chrome** extension in that profile, and turn on auto mode only there.
- **Codex:** enable the `chrome`, `browser` and `computer-use` plugins only for that same profile.
- **Orca:** leave remote browser access off until that profile is the one in use.

The other AIs stay in the terminal. Visual QA is optional, not part of the default run.

### Why it pays off

- **Nothing stops the run.** Routine work inside the worktree does not wait for a confirmation, so the waves run in parallel from start to finish.
- **You are free.** No need to watch six AIs or approve step by step.
- **Traceable decisions.** What the coordinator decides alone is logged on the board and shows up in the report under "Decisions taken alone".
- **Reversible by design.** Each sub-agent works in its own worktree and branch, so anything can be thrown away.
- **Same rules in every AI, only inside Orca.** The installer writes the same instructions into `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md` (Antigravity), `~/.config/muse/AGENTS.md`, `~/.grok/rules/orca-equipe.md` and `~/.cursor/rules/orca-equipe.mdc`. The block applies only when an `ORCA_*` variable is set (`ORCA_CLI_COMMAND` or `ORCA_DEV_REPO_ROOT`). Outside an Orca session, the agent behaves normally and asks the user.

The final report, in the skill's format, shows what each AI did and the Credits block:

![Final report format of /orca-advanced-orquestration: what each AI did, decisions taken alone, the Credits block and the pending-approval exception](img/print-report.png)

**Only exception, for safety.** The skill keeps a few fixed limits (section 9 of `SKILL.md`): merge or push to `main`, deploy, production actions, deleting or changing real data, running a migration on a real database, touching secrets and deleting files outside the worktree. In these cases the sub-agent does not stop: it leaves the PR, branch or command ready and lists it in the final report under "Pending approval". The rest of the work goes on as usual.

## Coordinator promotion

The coordinator spends quota too. When the main AI runs out, the run should not stop with it. Any of the six AIs can be promoted to coordinator, and the user decides which one: `/orca-advanced-orquestration promote <agent>`. Only when the user names nobody does the skill suggest one, by status first and quota headroom second (the `Successor` line of `cotas.mjs`).

Why it works in Orca: a Run is Orca's durable inbox, and the workers report to the Run, not to one coordinator terminal. `orca orchestration run-use` binds a new coordinator terminal to the same Run, so the successor inherits the board, the gates and the pending mail without restarting any worker. What Orca does not have is a way to re-parent a worker, and nested workers count against the "Nested worker depth" setting. That is why the cleanest promotion is a fresh session of the chosen AI rather than turning a running worker into a coordinator in place.

The handoff is a short file, `.orca/handoff.md`: plan and waves, each worker with its branch and state, open gates, pending approvals and the last quota reading. The outgoing coordinator writes it from 90% on; if it dies first, the successor rebuilds it read-only from `task-list`, `worker-list`, `gate-list` and the git branches. The promoted AI gets the whole coordinator rank (waves, gates, cross-review, final report) and the same fixed limits. The old coordinator comes back as a worker or reviewer after its reset, and the Credits block logs the succession.

![Coordinator promotion: handoff file, the AI you choose binds the same Orca Run, workers keep running](img/succession.png)

## Getting started

1. Follow the [full tutorial](TUTORIAL.md): Orca, CLIs, logins and the installer for your system.
2. In Orca, set **Settings > Orchestration > Nested worker depth = 2**.
3. Open a Claude or Codex session in the project and ask:

```
/orca-advanced-orquestration <what needs to be done>
```
