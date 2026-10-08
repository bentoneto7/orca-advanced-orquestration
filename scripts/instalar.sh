#!/usr/bin/env bash
# orca-advanced-orquestration - installs the team skills and rules in every AI (macOS / Linux)
#
# Usage (from the repository folder):
#   bash scripts/instalar.sh              # install / update
#   bash scripts/instalar.sh --verificar  # check only, changes nothing
#
# Idempotent: run it as many times as you like. Before touching an instructions file
# that already exists, it keeps a copy <file>.bak-orca (only the first time).
# It also removes the old `orquestration` and `orquestration-avanced` skill folders (renamed to orca-advanced-orquestration).
#
# On macOS, the `orca` command in PATH is sometimes a broken symlink (Register in the app).
# This script finds the real binary in /Applications/Orca.app if PATH fails.

set -u
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/bin:${PATH}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
H="${HOME}"
INI='<!-- orca-equipe:inicio -->'
FIM='<!-- orca-equipe:fim -->'
SKILL='orca-advanced-orquestration'
OLD_SKILLS=(orquestration orquestration-avanced)

VERIFICAR=0
for arg in "$@"; do
  case "$arg" in
    --verificar|-Verificar|-v) VERIFICAR=1 ;;
    -h|--help)
      sed -n '2,13p' "$0"
      exit 0
      ;;
    *)
      echo "unknown flag: $arg" >&2
      echo "usage: bash scripts/instalar.sh [--verificar]" >&2
      exit 1
      ;;
  esac
done

resolve_orca() {
  local c
  for c in \
    "$(command -v orca 2>/dev/null || true)" \
    "/opt/homebrew/bin/orca" \
    "/usr/local/bin/orca" \
    "/Applications/Orca.app/Contents/Resources/bin/orca"
  do
    [[ -n "$c" && -e "$c" ]] || continue
    if "$c" --version >/dev/null 2>&1; then
      printf '%s\n' "$c"
      return 0
    fi
  done
  return 1
}

ORCA="$(resolve_orca || true)"

backup_once() {
  local path="$1"
  if [[ -f "$path" && ! -f "${path}.bak-orca" ]]; then
    cp "$path" "${path}.bak-orca"
  fi
}

set_block() {
  local path="$1"
  local body="$2"
  local block
  block="${INI}"$'\n'"${body}"$'\n'"${FIM}"
  mkdir -p "$(dirname "$path")"
  if [[ -f "$path" ]]; then
    backup_once "$path"
    INI="$INI" FIM="$FIM" BLOCK="$block" PATH_FILE="$path" python3 - <<'PY'
import os
from pathlib import Path
path = Path(os.environ["PATH_FILE"])
ini, fim, block = os.environ["INI"], os.environ["FIM"], os.environ["BLOCK"]
text = path.read_text(encoding="utf-8")
start, end = text.find(ini), text.find(fim)
if start != -1 and end != -1 and end >= start:
    text = text[:start] + block + text[end + len(fim):]
else:
    text = text.rstrip() + "\n\n" + block + "\n"
path.write_text(text, encoding="utf-8")
PY
  else
    printf '%s\n' "$block" > "$path"
  fi
}

add_hook() {
  # Writes (or replaces) the "Zuuuw team" section at the end of Orca's skill.
  local skill_file="$1" base
  [[ -f "$skill_file" ]] || return 1
  backup_once "$skill_file"
  base="$(tr -d '\r' < "$skill_file" | awk '/^## (Equipe Zuuuw|Zuuuw team)/{exit} {print}')"
  printf '%s\n\n' "$base" > "$skill_file"
  tr -d '\r' < "$REPO/config/orchestration-hook.md" >> "$skill_file"
  return 0
}

command_ok() {
  command -v "$1" >/dev/null 2>&1
}

# Skill folders of each agent (same as instalar.ps1)
SKILL_KEYS=(claude "codex/cursor (shared)" codex cursor grok antigravity)
skill_dir() {
  case "$1" in
    claude) echo "$H/.claude/skills" ;;
    "codex/cursor (shared)") echo "$H/.agents/skills" ;;
    codex) echo "$H/.codex/skills" ;;
    cursor) echo "$H/.cursor/skills" ;;
    grok) echo "$H/.grok/skills" ;;
    antigravity) echo "$H/.gemini/antigravity-cli/skills" ;;
  esac
}

RULE_KEYS=(claude codex antigravity muse)
rule_file() {
  case "$1" in
    claude) echo "$H/.claude/CLAUDE.md" ;;
    codex) echo "$H/.codex/AGENTS.md" ;;
    antigravity) echo "$H/.gemini/GEMINI.md" ;;
    muse) echo "$H/.config/muse/AGENTS.md" ;;
  esac
}

GROK_RULE="$H/.grok/rules/orca-equipe.md"
CURSOR_RULE="$H/.cursor/rules/orca-equipe.mdc"
MUSE_SKILLS="$H/.config/muse/skills"
MUSE=""
if command_ok muse; then
  MUSE="$(command -v muse)"
fi

if [[ "$VERIFICAR" -eq 1 ]]; then
  fail=0
  echo "== CLIs"
  for c in orca claude codex cursor-agent grok agy muse; do
    if command_ok "$c"; then
      echo "  OK  $c"
    else
      echo "  --  $c not found in PATH"
    fi
  done
  if [[ -n "$ORCA" ]]; then
    echo "  orca resolved: $ORCA"
  fi
  echo "== Skills"
  for k in "${SKILL_KEYS[@]}"; do
    d="$(skill_dir "$k")"
    have=""
    for s in orca-cli orchestration "$SKILL"; do
      if [[ -f "$d/$s/SKILL.md" ]]; then
        if [[ -n "$have" ]]; then
          have="$have, $s"
        else
          have="$s"
        fi
      fi
    done
    same="identical"
    for f in "$REPO/skills/$SKILL"/*; do
      if ! cmp -s "$f" "$d/$SKILL/$(basename "$f")"; then same="DIFFERENT"; fail=$((fail + 1)); fi
    done
    old=""
    for o in "${OLD_SKILLS[@]}"; do
      if [[ -e "$d/$o" ]]; then old="$old $o"; fail=$((fail + 1)); fi
    done
    printf "  %-24s %s  [%s]%s\n" "$k" "${have:-none}" "$same" "${old:+  old:$old}"
  done
  if [[ -f "$MUSE_SKILLS/$SKILL/SKILL.md" ]]; then
    printf "  %-24s %s\n" "muse" "$SKILL"
  else
    printf "  %-24s %s\n" "muse" "missing $SKILL"; fail=$((fail + 1))
  fi
  if [[ -n "$MUSE" ]]; then
    echo "  muse:"
    "$MUSE" skills list --source user 2>/dev/null | grep -oE 'orca-cli|orca-advanced-orquestration|orquestration-avanced|orquestration|orchestration' | sort -u | sed 's/^/    /' || true
  fi
  echo "== Orca orchestration link"
  for k in "${SKILL_KEYS[@]}"; do
    f="$(skill_dir "$k")/orchestration/SKILL.md"
    [[ -f "$f" ]] || continue
    if grep -qF "\`$SKILL\`" "$f"; then printf "  %-24s %s\n" "$k" "OK"; else printf "  %-24s %s\n" "$k" "missing"; fail=$((fail + 1)); fi
  done
  echo "== Team rules"
  for k in "${RULE_KEYS[@]}"; do
    f="$(rule_file "$k")"
    if [[ -f "$f" ]] && grep -qF "$INI" "$f" && grep -qF "$SKILL" "$f"; then
      printf "  %-12s %s\n" "$k" "OK"
    else
      printf "  %-12s %s\n" "$k" "missing"; fail=$((fail + 1))
    fi
  done
  for pair in "grok:$GROK_RULE" "cursor:$CURSOR_RULE"; do
    n="${pair%%:*}"; f="${pair#*:}"
    if [[ -f "$f" ]] && grep -qF "$SKILL" "$f"; then printf "  %-12s %s\n" "$n" "OK"; else printf "  %-12s %s\n" "$n" "missing"; fail=$((fail + 1)); fi
  done
  echo "== Quota of each AI (cotas.mjs, no tokens spent)"
  if command_ok node && [[ -n "$ORCA" ]]; then
    PATH="$(dirname "$ORCA"):$PATH" node "$REPO/skills/$SKILL/cotas.mjs"
  elif [[ -n "$ORCA" ]]; then
    "$ORCA" account list 2>&1 | head -n 15
  else
    echo "  orca not found"
  fi
  echo
  if [[ "$fail" -eq 0 ]]; then echo "Check passed."; else echo "Check found $fail problem(s). Run the installer again."; fi
  exit 0
fi

echo "1) Official Orca skills (orca-cli and orchestration)"
if [[ -n "$ORCA" ]]; then
  "$ORCA" skills install --skill orca-cli --skill orchestration --agent antigravity,claude-code,codex,cursor,grok,universal
  echo "   installed via orca skills install"
else
  echo "   WARNING: 'orca' command not found. Open Orca > Settings > General > Orca CLI > Register and run again."
  echo "   On a Mac, the binary also lives in /Applications/Orca.app/Contents/Resources/bin/orca"
fi

echo "2) Team skill ($SKILL) in every folder"
for k in "${SKILL_KEYS[@]}"; do
  d="$(skill_dir "$k")"
  for o in "${OLD_SKILLS[@]}"; do rm -rf "${d:?}/$o"; done
  mkdir -p "$d/$SKILL"
  cp -R "$REPO/skills/$SKILL/." "$d/$SKILL/"
  if [[ "$k" == "antigravity" ]]; then
    for s in orca-cli orchestration; do
      src="$H/.agents/skills/$s"
      [[ -d "$src" ]] || src="$REPO/skills/$s"
      if [[ -d "$src" ]]; then
        mkdir -p "$d/$s"
        cp -R "$src/." "$d/$s/"
      fi
    done
  fi
  echo "   $k -> $d"
done
if [[ -n "$MUSE" ]]; then
  for o in "${OLD_SKILLS[@]}"; do
    "$MUSE" skills uninstall "$o" >/dev/null 2>&1 || true
    rm -rf "${MUSE_SKILLS:?}/$o"
  done
  for s in orca-cli orchestration "$SKILL"; do
    src="$H/.agents/skills/$s"
    [[ -d "$src" ]] || src="$REPO/skills/$s"
    if [[ -d "$src" ]]; then
      "$MUSE" skills install "$src" --scope user --force >/dev/null 2>&1 || \
        "$MUSE" skills install "$src" --scope user >/dev/null 2>&1 || true
      mkdir -p "$MUSE_SKILLS/$s" && cp -R "$src/." "$MUSE_SKILLS/$s/"
    fi
  done
  echo "   muse -> muse skills install (user scope)"
else
  echo "   muse not found, skipped"
fi

echo "3) Link Orca's orchestration skill to $SKILL"
hooked=0
for k in "${SKILL_KEYS[@]}"; do
  d="$(skill_dir "$k")"
  if add_hook "$d/orchestration/SKILL.md"; then
    hooked=$((hooked + 1))
  fi
done
if add_hook "$MUSE_SKILLS/orchestration/SKILL.md"; then
  hooked=$((hooked + 1))
fi
echo "   linked in ${hooked} folder(s)"

echo "4) Rules so each AI takes the coordinator's calls"
body="$(python3 -c 'from pathlib import Path; print(Path("'"$REPO"'/config/equipe-orca.md").read_text(encoding="utf-8").replace("\r","").rstrip())')"
for k in "${RULE_KEYS[@]}"; do
  f="$(rule_file "$k")"
  set_block "$f" "$body"
  echo "   $k -> $f"
done
mkdir -p "$(dirname "$GROK_RULE")"
cp "$REPO/config/grok-rules-orca-equipe.md" "$GROK_RULE"
echo "   grok -> $GROK_RULE"
mkdir -p "$(dirname "$CURSOR_RULE")"
cp "$REPO/config/cursor-rules-orca-equipe.mdc" "$CURSOR_RULE"
echo "   cursor -> $CURSOR_RULE"

echo
echo "Done. Now in Orca: Settings > Agents > Refresh, and open a new session of each agent."
echo "To check: bash scripts/instalar.sh --verificar"
