---
name: orca-advanced-orquestration
description: >-
  Zuuuw multi-AI team in Orca with credit management. Use when the user types
  /orca-advanced-orquestration, asks to orchestrate, coordinate several agents, split
  a task across AIs or set up the board. When invoked, it reads each AI's real
  quota, breaks the task down and distributes it across the AIs with quota
  (claude, codex, cursor, grok, antigravity, muse) in parallel, weighted by each
  one's headroom, with sub-agent expansion. Also handles coordinator promotion:
  /orca-advanced-orquestration promote <agent> hands the coordinator role to any of
  the six AIs when the main AI runs out of quota. Loads Orca's orchestration skill.
---

# /orca-advanced-orquestration - multi-AI team in Orca

## 0. Automatic mode (default behavior)
When invoked with `promote [<agent>]`, or when the coordinator hits >= 95% / a rate limit, go to section 12 instead.
When invoked, do NOT ask how to split the work. Run it directly:
1. Setup (section 1) and quota reading (section 2).
2. Break the task down and write the plan (section 4), with the Quotas and Coverage lines.
3. Create the tasks on the board and dispatch Wave 1 in parallel (section 5).
4. Before each wave, re-read the quotas and rebalance the remaining plan. That plan is only the initial guess. Before every `worker-start`, run `cotas.mjs next`. After every `worker_done`, run `cotas.mjs record`. Review, integrate and deliver (sections 6 to 10).
Never stop to ask the user: they do not watch the workers. When in doubt, pick the safest reversible option, log it on the board and keep going. Fixed limits in section 9.

## 1. Setup
1. Load the `orchestration` skill and run `orca skills get orchestration`.
2. Read the project's `AGENTS.md` / `CLAUDE.md` and follow its rules (branches, deploy, real data).
3. Create or reuse a Run: `orca orchestration run-create --json` (or `run-use`).
4. Default team: `claude, codex, cursor, grok, antigravity, muse`. An AI only leaves for lack of quota (section 2) or if its `worker-start` fails twice (logged out). Log it in the plan and redistribute.

## 2. Credit management (real quota + healthy pacing)
Quota reading (zero token cost), before the plan and before EVERY wave:
- `node <this skill's folder>/cotas.mjs` -> prints the `Quotas` line (usage per window, pace, reset, status and each AI's share), a `Suggested share` line and a `Successor` line (section 12). `--json` for details. The CLI is `$ORCA_CLI_COMMAND`, then `orca-ide`, then `orca`.
- Per-task rebalance (the wave plan is the initial guess only). Classify, then pick. Before every `worker-start`: `node <this skill's folder>/cotas.mjs next --size <light|medium|heavy> --coordinator <you> [--title "<task>"] [--files <n>] [--taken ai=n,ai=n] [--tier <class>]`. `<you>` is whichever of the six is coordinating, including one promoted under section 12. Hints only raise the tier; `--tier` is the coordinator override. It rereads live quota, subtracts that AI's decayed average cost (empty ledger defaults: light 1, medium 3, heavy 8 quota points), keeps the 15% claude/codex reserve and the 35% wave cap, and prints `Next`, `Tier`, `Model`, `Args`, and `Fallback`. Never pass the coordinator as the implementation agent. Model ids and CLI flags come from `models.json` in this skill folder (`ORCA_MODELS_PATH` overrides it; `~/.orca-advanced/models.json` is used when that file exists). If the table is missing, `next` warns and prints no model args. After every `worker_done`: `node <this skill's folder>/cotas.mjs record --ai <agent> --task <id> --size <class> --tier <Tier> --model <Model> [--tokens <n>] [--quota-before <pct>] [--failed]`. One JSON line is appended to `~/.orca-advanced/usage.jsonl` (`ORCA_USAGE_LEDGER` overrides the path). Quota after comes from `account list`. Tokens are optional. A finished task counts as success; `--failed` records a miss.
- Without node: `orca account list --json` -> `result.rateLimits` (claude/codex: 5h session + weekly; cursor: monthly, bucket "Cursor Models"; grok: weekly; antigravity: buckets "Gemini Models" and "Claude and GPT models"). Antigravity also: `agy -p /usage --output-format json --print-timeout 20s`.
- Muse has no meter. Never spend tokens to measure quota (no free-form prompt just to check).

Status per AI (worst window among 5h, weekly or monthly):
- < 60% normal: takes heavy or medium work.
- 60-80% light/medium: only light and medium tasks.
- >= 80% review only: no heavy tasks; only reviews and short tasks.
- >= 95% or exhausted: excluded until the reset. In the plan: `no quota until <reset>`.

Split by remaining quota: each AI's suggested share is proportional to `headroom x pace x capacity`, then capped.
- Headroom = 100 - usage, minus a 15% weekly reserve for claude and codex (kept for critical review and coordination).
- Healthy pacing (pace = usage - % of the window already elapsed): ahead (pace > 0) gets less; behind with headroom gets more. Goal: no AI runs out before its reset.
- Capacity defaults to 1 for every metered AI (config block at the top of `cotas.mjs`). Muse is 70% of the median of cursor and grok (no meter: tightly scoped tasks).
- Cap: no suggested share exceeds 35% when at least 3 AIs have quota. With fewer, the cap is lifted.
- The coordinator (the session running this skill: claude or codex by default, or any AI promoted under section 12) only plans, reviews and delegates. It does not take implementation tasks. Heavy tasks go to the AI on the `Heavy` line (normal status, most headroom). If that AI is the coordinator, give the heavy task to the next-highest headroom.
- Every AI with quota gets at least one task only when the job has 4 or more subtasks. Smaller jobs follow the suggested share and may leave an AI idle.
- Review of critical work stays with claude or codex (whichever has more headroom), using the reserve. At >= 80% that AI only reviews and sends short messages.
- Antigravity without Gemini quota but with headroom in "Claude and GPT models": use `--model claude-sonnet-4-6` in `worker-start` (models: `agy models`). Do not use `gemini` (API only).
- Extra or pay-per-use credits (e.g. codex `extraUsage`) do not count as headroom.

Model routing (`models.json` in this skill folder; `ORCA_MODELS_PATH` or `~/.orca-advanced/models.json` overrides it): `next` prints `Model` and `Args` for the tier. If the table is missing, it warns and leaves the model args off. Pass `Args` on `worker-start` (`--model <id>` for Claude, Cursor, Grok, Antigravity, and Muse; Codex is `-m <id>` plus the printed reasoning-effort config). The ids are editable defaults. Adding a provider is a new entry in that file, not a change to this skill. If a light or medium model fails, or the worker says it could not finish, `record --failed` and run `next --retry-of <task id>`, which steps one tier up and stops at heavy. Among models with a success rate of at least 80% over at least 3 samples for that tier, `next` prefers the cheapest; otherwise it uses the tier's default model. In cursor, prefer "Cursor Models" (own bucket) over "Other Models".

Rate limit mid-run: if a worker reports a quota/rate-limit error, record what you can, re-read the quotas, mark the AI as excluded until the reset and reassign the task right away (`worker-start --retry-of`) to the agent `cotas.mjs next` prints, without asking the user.

## 3. Roles and distribution
Spread implementation across the AIs with quota, in the suggested share from section 2. The coordinator only plans, reviews and delegates. Heavy tasks go to the `Heavy` line, unless that AI is the coordinator. Give every AI with quota at least one task only when the job has 4 or more subtasks. A smaller job follows the share or the fixed roles.

| Agent | Main role | Fixed role (always fits) |
|---|---|---|
| `claude` | Coordination, integration, critical review | Final integration and critical review |
| `codex` | Implementation when it has headroom, or coordination | Automated tests for the delivery |
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
PLAN /orca-advanced-orquestration - <title>
Coordinator: <agent> (promoted from <agent> at <time>, if any)   Sub-agent depth: <1|2>
Quotas: <cotas.mjs Quotas line: agent usage 5h/weekly (pace, reset) status -> share%>
Suggested share: <cotas.mjs Suggested share line>

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
- Coverage: name every AI that received a task. Give every AI with quota at least one task only when the plan has 4 or more subtasks; with fewer, follow the suggested share. An excluded AI still shows up as `no quota until <reset>`.
- Per wave, do not give one AI more than about 35% of the tasks when at least 3 AIs have quota. With fewer, the cap is lifted.
- The coordinator does not take implementation tasks. The agent on each plan line is the initial guess. At dispatch, `next` picks the worker.
- Heavy tasks go to the `Heavy` AI only when `next` agrees, or to the next name on the `Fallback` line.
- Each task: ID, agent, title, deliverable, `deps` when needed, `[expandable]` if it may open sub-agents, and a size class (`light`, `medium`, or `heavy`). `next` fills in the model at dispatch.
- Board: `orca orchestration task-create --spec "<spec>" --task-title "<ID> <title>" --display-name "<agent> - <ID> <title>" [--deps '["<id>"]'] [--parent <id>] --json`.

## 5. Parallel dispatch
- Dispatch the ready tasks of the wave together. Before each `worker-start`, run `cotas.mjs next --size <class> --coordinator <you> [--title "<task title>"] [--files <n>] --taken <ai=n,... already started this wave>`. Use `Next`, and pass the printed `Args` (model id and effort) on the launch: `orca orchestration worker-start --task <id> --agent <Next> <Args> --worktree new-child --name <slug> --json`. When `Next` is grok, leave `Args` off: grok `worker-start` does not take `--model` and uses grok's own config (section 12).
- If the worker could not finish on a light or medium model, `record --failed` and run `next --retry-of <task id>` (one tier up, max heavy), then `worker-start --retry-of <task id>` with the new `Args`.
- After each `worker_done`, run `cotas.mjs record --ai <agent> --task <id> --size <class> --tier <Tier> --model <Model> [--tokens <n>] [--quota-before <pct>] [--failed]`.
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
Summary: executed plan (Quotas and Coverage), what each AI did, which version won and why, tests, decisions taken alone, "Pending approval" (with a ready command or PR) and the Credits block: usage per agent at the start and at the end (run `cotas.mjs` again), who was excluded and until when, reassignments due to rate limits, next resets and every succession (`Succession: <old> -> <new> at <time>, <reason>, chosen by <user|quota>`).

## 11. When you are a worker
- Reply through the same channel (reply / worker_done) in up to 15 lines. If the tool reports a token count, add `tokens <n>` on its own so the coordinator can pass `--tokens` to `record`. If you could not finish, say `could not finish` and the tier you used so the coordinator can `record --failed` and retry one tier up.
- Work only in your worktree. Sub-agents only with `[expandable]` (section 6).
- Obey the coordinator 100%; never ask the user. Scope doubt: `orca orchestration ask`; with no answer, take the safest option and move on.
- Quota or rate-limit error: stop and immediately report `NO QUOTA until <reset>` to the coordinator, so it can reassign.
- Fixed limits from section 9: do not execute; prepare and report.
- If the user (or the outgoing coordinator's handoff) promotes you, you stop being a worker: settle your current Dispatch first (section 12), then follow sections 0 to 10 as the coordinator.

## 12. Coordinator promotion (succession)
Any of the six AIs can be promoted to coordinator: claude, codex, cursor, grok, antigravity or muse. **The user's choice always wins.** Only when the user names nobody, use the `Successor` line: `node <this skill's folder>/cotas.mjs successor --from <outgoing> [--to <agent>]` (best status, then most headroom; the outgoing AI is skipped; muse has no meter, so it is suggested only as the last resort).

**Triggers**
- The user types `/orca-advanced-orquestration promote <agent>` (or `promote` alone: use the suggestion).
- The coordinator's worst window reaches >= 95%, or it gets a quota/rate-limit error (`NO QUOTA until <reset>`). At >= 90% it writes the handoff early (below) so nothing is lost if it dies.

**What Orca really supports (checked against Orca's CLI, Oct 2026)**
- A Run is the durable namespace and inbox. Workers report to the Run mailbox (`run:<id>`), not to a coordinator terminal, so they keep working while the coordinator changes.
- `orca orchestration run-use --id <run_id> --json` binds the terminal that runs it as the coordinator of an existing Run. Orca records every terminal that was bound to a Run and bumps a consumer generation, so a Run can change coordinator. Never bind while the old coordinator is still actively coordinating. (`--takeover-legacy` is only for legacy adopted Runs.)
- There is no command to re-parent a worker or move a Dispatch. A worker that creates its own Run becomes a nested coordinator, but nested workers obey Settings > Orchestration > Nested worker depth, and a new Run does not reset depth.
- So the clean promotion is a fresh top-level session of the chosen AI that binds the same Run. Promoting a worker in place also works through `run-use` from its own terminal, but its new workers may count as nested; if `worker-start` returns `nested_worker_depth_exceeded`, switch to a fresh session.

**1. Handoff (outgoing coordinator, while it still can)**
Write `.orca/handoff.md` at the root of the coordinator's worktree (keep it out of git: add `.orca/` to `.git/info/exclude`):
```
HANDOFF /orca-advanced-orquestration - <title>
Run: <run_id>   Outgoing: <agent> (<reason>, quota resets <time>)   Successor: <agent> (<user choice|most headroom>)
Plan: <current plan with waves; done / running / pending per task>
Workers: <task id, agent, dispatch id, worktree/branch, state>
Gates and questions: <open gates, unanswered asks>
Pending approval: <items from section 9, with the ready command or PR>
Quotas: <latest cotas.mjs Quotas line>
Next step: <what the successor does first>
```
Then enqueue a pointer in the Run inbox: `orca orchestration send --to run:<run_id> --type handoff --subject "Coordinator handoff" --body "<path + next step>" --json`, and stop issuing orchestration commands.

**2. Rebuild (if the old coordinator died before writing it)**
The successor rebuilds the state read-only: `orca orchestration run-list --json` (find the Run by objective), `run-show --id <run_id> --json`, `task-list --run <run_id> --json`, `worker-list --run <run_id> --json`, `gate-list --run <run_id> --json`, plus `git worktree list` and `git branch`. Then write `.orca/handoff.md` itself.

**3. Promotion (rank upgrade)**
The successor, in its own terminal:
1. If it is a dispatched worker, settles its Dispatch first with one `worker_done` (`--outcome succeeded` or `failed` with what remains), so it is never worker and coordinator at once.
2. Loads `orchestration` and this skill, reads `.orca/handoff.md` and binds the Run: `orca orchestration run-use --id <run_id> --json`, then `orca orchestration check --json` to process the pending mail.
3. From now on it is the coordinator with full powers: sections 0 to 10 apply to it and section 11 no longer does. It dispatches waves, resolves routine gates, runs cross-review and writes the final report. It plans, reviews and delegates only (`cotas.mjs next --coordinator <self>`).
4. Re-reads the quotas with `cotas.mjs` and replans the remaining work with the `Coordinator` line updated.
5. Logs the succession on the board and in the Credits block.

**After the promotion**
- The old coordinator is `excluded` until its reset, then returns as a worker or reviewer in its normal role. It only coordinates again if the user promotes it.
- If the successor is not claude or codex, it applies the same 15% coordination reserve to itself: at >= 80% it coordinates only, and at >= 95% it promotes the next successor the same way.
- Fixed limits from section 9 do not change with the rank: they still go to "Pending approval".

**Per-agent notes (real limits)**
- Orca does not tie the coordinator role to a vendor: any agent terminal that runs the Orca CLI can bind a Run.
- Only claude and codex have Chrome set up. A cursor, grok, antigravity or muse coordinator delegates browser work to a claude or codex worker.
- `worker-start --model/--effort` works for claude, codex, cursor, antigravity and muse workers; grok workers start with the model from their own config.
- muse has no quota meter: it is never auto-suggested before the metered AIs, and its exhaustion only shows up as rate-limit errors.
- antigravity can lose its Gemini bucket; then it runs on `claude-sonnet-4-6` from the "Claude and GPT models" bucket (`cotas.mjs` prints the model).

**What the user does (only when promotion needs a new session)**
1. In Orca, open a new session of the chosen AI in the same project and worktree as the old coordinator (the same way you start a coordinator).
2. Type `/orca-advanced-orquestration promote <agent>`. Nothing else: the AI reads the handoff (or rebuilds it), binds the Run and continues.
