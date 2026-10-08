# Contributing to orca-skills

Thanks for helping. This project is a set of skills and rules that turn several AI coding agents into one team inside [Orca](https://github.com/stablyai/orca).

## Reporting a problem

Open an issue with:

- your operating system (macOS, Linux or Windows);
- the output of `bash scripts/instalar.sh --verificar` or `instalar.ps1 -Verificar`;
- what you ran and what happened.

Never paste emails, account IDs, tokens or credentials. `cotas.mjs` only prints percentages and resets, so its output is safe to share.

## Changing the skill or the installers

1. Fork the repository and create a branch.
2. Edit `skills/orquestration-avanced/SKILL.md`, `config/` or `scripts/`. Keep the rules short: every line is sent to the agents in every run.
3. Keep both installers in sync (`scripts/instalar.sh` and `scripts/instalar.ps1`) and make sure they stay idempotent.
4. Run the installer and then the check (`--verificar` / `-Verificar`) on your machine. It should end with "Check passed."
5. Open a pull request explaining what changed and why.

## Style

- Documentation is in English.
- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`).
- Do not add numbers or benchmarks that were not measured; mark examples as illustrative.
