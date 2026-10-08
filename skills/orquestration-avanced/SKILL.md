---
name: orquestration-avanced
description: >-
  Zuuuw multi-AI team in Orca with credit management. Use when the user types
  /orquestration-avanced, asks to orchestrate, coordinate several agents, split
  a task across AIs or set up the board. When invoked, it reads each AI's real
  quota, breaks the task down and distributes it across the AIs with quota
  (claude, codex, cursor, grok, antigravity, muse) in parallel, weighted by each
  one's headroom, with sub-agent expansion. Loads Orca's orchestration skill.
---

# /orquestration-avanced - multi-AI team in Orca

## 0. Automatic mode (default behavior)
When invoked, do NOT ask how to split the work. Run it directly:
1. Setup (section 1) and quota reading (section 2).
2. Break the task down and write the plan (section 4), with the Quotas and Coverage lines.
3. Create the tasks on the board and dispatch Wave 1 in parallel (section 5).
4. Before each wave, re-read the quotas and rebalance. Review, integrate and deliver (sections 6 to 10).
Never stop to ask the user: they do not watch the workers. When in doubt, pick the safest reversible option, log it on the board and keep going. Fixed limits in section 9.

## 1. Setup
1. Load the `orchestration` skill and run `orca skills get orchestration`.
2. Read the project's `AGENTS.md` / `CLAUDE.md` and follow its rules (branches, deploy, real data).
3. Create or reuse a Run: `orca orchestration run-create --json` (or `run-use`).
4. Default team: `claude, codex, cursor, grok, antigravity, muse`. An AI only leaves for lack of quota (section 2) or if its `worker-start` fails twice (logged out). Log it in the plan and redistribute.

## 2. Credit management (real quota + healthy pacing)
Quota reading (zero token cost), before the plan and before EVERY wave:
- `node <this skill's folder>/cotas.mjs` -> prints the ready-made `Quotas` line (usage per window, pace, reset, status and each AI's share). `--json` for details.
- Without node: `orca account list --json` -> `result.rateLimits` (claude/codex: 5h session + weekly; cursor: monthly, bucket "Cursor Models"; grok: weekly; antigravity: buckets "Gemini Models" and "Claude and GPT models"). Antigravity also: `agy -p /usage --output-format json --print-timeout 20s`.
- Muse has no meter. Never spend tokens to measure quota (no free-form prompt just to check).

Status per AI (worst window among 5h, weekly or monthly):
- < 60% normal: takes heavy or medium work.
- 60-80% light/medium: only light and medium tasks.
- >= 80% review only: no heavy tasks; only reviews and short tasks.
- >= 95% or exhausted: excluded until the reset. In the plan: `no quota until <reset>`.

Split by headroom (the default, not leftovers): each AI's share is proportional to `headroom x pace x plan capacity`.
- Headroom = 100 - usage, minus a 15% weekly reserve for claude and codex (kept for critical review and coordination).
- Healthy pacing (pace = usage - % of the window already elapsed): ahead (pace > 0) gets less; behind with headroom gets more. Goal: no AI runs out before its reset.
- Capacity: claude and codex 3, cursor and grok 1, antigravity 0.3 (Starter: at most 1 short task per wave), muse 70% of the median of cursor and grok (no meter: tightly scoped tasks).
- Whoever has the most headroom works the most and takes the heavy work. Codex is the heavy implementer whenever it has more headroom than claude. Cursor, grok and muse with headroom take real implementation (medium/heavy parts in parallel, with cross-review), not just leftovers.
- Claude >= 80%: codex takes the heavy work (and coordinates, if the session is its own); claude only delegates in short messages and reviews what is critical. Review of critical work stays with claude or codex (whichever has more headroom), using the reserve.
- Antigravity without Gemini quota but with headroom in "Claude and GPT models": use `--model claude-sonnet-4-6` in `worker-start` (models: `agy models`). Do not use `gemini` (API only).
- Extra or pay-per-use credits (e.g. codex `extraUsage`) do not count as headroom.

Cheapest model that does the job: `worker-start --model <id> --effort <low|medium|high>`. Light task (docs, checklist, small fix) = smaller model or low effort; medium = medium; heavy or critical = default/high. In cursor, prefer "Cursor Models" (own bucket) over "Other Models".

Rate limit mid-run: if a worker reports a quota/rate-limit error, re-read the quotas, mark the AI as excluded until the reset and reassign the task right away (`worker-start --retry-of`) to the next AI with the most headroom, without asking the user.

## 3. Roles and distribution
Every run uses ALL AIs with quota: each one gets at least one task, in the proportion from section 2. If the task is small, split it finer or use the fixed roles.

| Agent | Main role | Fixed role (always fits) |
|---|---|---|
| `claude` | Heavy implementation or coordination + integration | Final integration and critical review |
| `codex` | Heavy implementation | Automated tests for the delivery |
| `antigravity` | Code research and broad reading | Map of the affected code (files, risks) |
| `grok` | Web research, critical review, medium implementation | Blind cross-review of one delivery |
| `cursor` | Front-end, UI, medium/heavy implementation | UI/DX or documentation review |
| `muse` | Tightly scoped implementation in parallel | Scripts, small fixes, checklist |

- Reading more than ~20 files: `antigravity` (if it has quota) or `grok`. External research: `grok`.
- Critical or architectural: the main AI with the most headroom, or cursor/grok with review by the main one.
- Rotation: do not give more than 2 tasks in a row to the same support agent if another one with similar headroom is able.

## 4. Plan format (write it before dispatching)
Save it on the board; each line becomes a task. Hierarchical IDs show the expansion.

```
PLAN /orquestration-avanced - <title>
Coordinator: <claude|codex>   Sub-agent depth: <1|2>
Quotas: <cotas.mjs line: agent usage 5h/weekly (pace, reset) status -> share%>

Wave 1 (parallel)
  T1   antigravity  Map of the affected code             -> list of files + risks
  T2   grok         External research                    -> 5-10 lines with sources
  T3   muse         Test scripts/fixtures                -> files created
Wave 2
  T4   codex        Main implementation       deps: T1,T2  [expandable]
    T4.1 muse       Sub-part of T4                         -> reports to codex
  T5   cursor       Front-end / UI            deps: T1
  T6   grok         Secondary module          deps: T1
Wave 3 (review and integration)
  T7   cursor       Blind cross-review of T4     deps: T4
  T8   codex        Blind cross-review of T5/T6
  T9   claude       Final integration + report (short, reserve)

Coverage: claude T9 | codex T4,T8 | antigravity T1 | grok T2,T6 | cursor T5,T7 | muse T3,T4.1
```
- Mandatory coverage: name every AI; the excluded one shows up as `no quota until <reset>`.
- Each task: ID, agent, title, deliverable, `deps` when needed, `[expandable]` if it may open sub-agents, and `--model/--effort` when it is light.
- Board: `orca orchestration task-create --spec "<spec>" --task-title "<ID> <title>" --display-name "<agent> - <ID> <title>" [--deps '["<id>"]'] [--parent <id>] --json`.

## 5. Parallel dispatch
- Dispatch the whole wave together: `orca orchestration worker-start --task <id> --agent <agent> [--model <id> --effort <level>] --worktree new-child --name <slug> --json`.
- Read-only tasks may use `--worktree current`.
- Up to 6 workers at the same time; 4 if claude and codex are both >= 80%.
- `--deps` only when the task needs another task's result.
- If `--agent grok` is rejected, use `orca worktree create --name <slug> --agent grok --prompt "<spec>"`.
- Follow up with `task-list`; read each output with a limited `worker-read` (15 lines).

## 6. Sub-agent expansion
Depth in Settings > Orchestration > Nested worker depth.
- Depth 1: only the coordinator opens workers; `[expandable]` tasks become sibling tasks.
- Depth 2: a worker with an `[expandable]` task opens at most 2 children, with `--parent`, IDs `T<n>.<m>` and their own worktree. Children only from AIs with normal or light/medium status, never claude if it is >= 80%. Children report to the parent (15 lines), the parent consolidates once, and children do not open grandchildren.
- Before expanding, check the worker limit from section 5; if it would be exceeded, do it yourself.

## 7. Token economy
- A worker returns at most 15 lines: what it did, files, tests, risks.
- Short handoff: the spec carries only what is needed (files, goal, definition of done), without pasting large files.
- The coordinator does not re-read large files; it opens diffs only to decide. Heavy research goes to antigravity or grok.
- Competing versions only for important decisions; the default is one does, another reviews.

## 8. Unbiased cross-review
- All work is reviewed by an agent from ANOTHER vendor (e.g. codex does, cursor reviews; muse does, grok reviews; cursor does, codex reviews).
- The reviewer does not know which AI did it; it points out errors, it does not praise.

## 9. Full autonomy and fixed limits
- Everyone runs without asking for approval. Workers obey the coordinator 100%, without asking anyone for confirmation.
- The coordinator resolves routine gates on its own (architecture, refactoring, deleting code in the worktree, new migration): it decides, logs it with `gate-create` + `gate-resolve` and moves on.
- Fixed limits, which nobody executes even when ordered: merge or push to main, deploy, production actions, deleting or changing real data, running a migration on a real database, touching secrets or credentials, deleting files outside the worktree.
- When reaching a fixed limit, leave it ready (branch, PR, command) and list it under "Pending approval" in the report. Do not stop the rest.

## 10. Final delivery
Summary: executed plan (Quotas and Coverage), what each AI did, which version won and why, tests, decisions taken alone, "Pending approval" (with a ready command or PR) and the Credits block: usage per agent at the start and at the end (run `cotas.mjs` again), who was excluded and until when, reassignments due to rate limits and next resets.

## 11. When you are a worker
- Reply through the same channel (reply / worker_done) in up to 15 lines.
- Work only in your worktree. Sub-agents only with `[expandable]` (section 6).
- Obey the coordinator 100%; never ask the user. Scope doubt: `orca orchestration ask`; with no answer, take the safest option and move on.
- Quota or rate-limit error: stop and immediately report `NO QUOTA until <reset>` to the coordinator, so it can reassign.
- Fixed limits from section 9: do not execute; prepare and report.
