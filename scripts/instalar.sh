#!/usr/bin/env bash
# orca-skills - instala as skills e as regras da equipe em todas as IAs (macOS / Linux)
#
# Uso (na pasta do repositorio):
#   bash scripts/instalar.sh              # instala / atualiza
#   bash scripts/instalar.sh --verificar  # so confere, nao altera nada
#
# Idempotente: pode rodar quantas vezes quiser. Antes de mexer em um arquivo de
# instrucoes que ja existe, guarda uma copia <arquivo>.bak-orca (so na primeira vez).
#
# No macOS, o comando `orca` no PATH as vezes e um symlink quebrado (Register no app).
# Este script acha o binario real em /Applications/Orca.app se o PATH falhar.

set -u
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/bin:${PATH}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
H="${HOME}"
INI='<!-- orca-equipe:inicio -->'
FIM='<!-- orca-equipe:fim -->'

VERIFICAR=0
for arg in "$@"; do
  case "$arg" in
    --verificar|-Verificar|-v) VERIFICAR=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "flag desconhecida: $arg" >&2
      echo "use: bash scripts/instalar.sh [--verificar]" >&2
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
  # Grava (ou troca) a secao "Equipe Zuuuw" no fim da skill do Orca.
  local skill_file="$1" base
  [[ -f "$skill_file" ]] || return 1
  backup_once "$skill_file"
  base="$(tr -d '\r' < "$skill_file" | awk '/^## Equipe Zuuuw/{exit} {print}')"
  printf '%s\n' "$base" > "$skill_file"
  tr -d '\r' < "$REPO/config/orchestration-hook.md" >> "$skill_file"
  return 0
}

command_ok() {
  command -v "$1" >/dev/null 2>&1
}

# Pastas de skills de cada agente (mesmas do instalar.ps1)
SKILL_KEYS=(claude "codex/cursor (compartilhada)" codex cursor grok antigravity)
skill_dir() {
  case "$1" in
    claude) echo "$H/.claude/skills" ;;
    "codex/cursor (compartilhada)") echo "$H/.agents/skills" ;;
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
MUSE=""
if command_ok muse; then
  MUSE="$(command -v muse)"
fi

if [[ "$VERIFICAR" -eq 1 ]]; then
  echo "== CLIs"
  for c in orca claude codex cursor-agent grok agy muse; do
    if command_ok "$c"; then
      echo "  OK  $c"
    else
      echo "  --  $c nao encontrado no PATH"
    fi
  done
  if [[ -n "$ORCA" ]]; then
    echo "  orca resolvido: $ORCA"
  fi
  echo "== Skills"
  for k in "${SKILL_KEYS[@]}"; do
    d="$(skill_dir "$k")"
    have=""
    for s in orca-cli orchestration orquestration; do
      if [[ -f "$d/$s/SKILL.md" ]]; then
        if [[ -n "$have" ]]; then
          have="$have, $s"
        else
          have="$s"
        fi
      fi
    done
    printf "  %-30s %s\n" "$k" "${have:-nenhuma}"
  done
  if [[ -n "$MUSE" ]]; then
    echo "  muse:"
    "$MUSE" skills list --source user 2>/dev/null | grep -oE 'orca-cli|orquestration|orchestration' | sort -u | sed 's/^/    /' || true
  fi
  echo "== Regras da equipe"
  for k in "${RULE_KEYS[@]}"; do
    f="$(rule_file "$k")"
    if [[ -f "$f" ]] && grep -qF "$INI" "$f"; then
      printf "  %-12s %s\n" "$k" "OK"
    else
      printf "  %-12s %s\n" "$k" "falta"
    fi
  done
  printf "  %-12s %s\n" "grok"   "$( [[ -f "$GROK_RULE" ]] && echo OK || echo falta )"
  printf "  %-12s %s\n" "cursor" "$( [[ -f "$CURSOR_RULE" ]] && echo OK || echo falta )"
  echo "== Cota de cada IA (cotas.mjs, sem gastar tokens)"
  if command_ok node && [[ -n "$ORCA" ]]; then
    PATH="$(dirname "$ORCA"):$PATH" node "$REPO/skills/orquestration/cotas.mjs"
  elif [[ -n "$ORCA" ]]; then
    "$ORCA" account list 2>&1 | head -n 15
  else
    echo "  orca nao encontrado"
  fi
  exit 0
fi

echo "1) Skills oficiais do Orca (orca-cli e orchestration)"
if [[ -n "$ORCA" ]]; then
  "$ORCA" skills install --skill orca-cli --skill orchestration --agent antigravity,claude-code,codex,cursor,grok,universal
  echo "   instaladas via orca skills install"
else
  echo "   AVISO: comando 'orca' nao encontrado. Abra o Orca > Settings > General > Orca CLI > Register e rode de novo."
  echo "   No Mac, o binario tambem vive em /Applications/Orca.app/Contents/Resources/bin/orca"
fi

echo "2) Skill da equipe (orquestration) em todas as pastas"
for k in "${SKILL_KEYS[@]}"; do
  d="$(skill_dir "$k")"
  mkdir -p "$d/orquestration"
  cp -R "$REPO/skills/orquestration/." "$d/orquestration/"
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
  for s in orca-cli orchestration orquestration; do
    src="$H/.agents/skills/$s"
    [[ -d "$src" ]] || src="$REPO/skills/$s"
    if [[ -d "$src" ]]; then
      "$MUSE" skills install "$src" --scope user --force >/dev/null 2>&1 || \
        "$MUSE" skills install "$src" --scope user >/dev/null 2>&1 || true
        mkdir -p "$H/.config/muse/skills/$s" && cp -R "$src/." "$H/.config/muse/skills/$s/"
    fi
  done
  echo "   muse -> muse skills install (escopo usuario)"
else
  echo "   muse nao encontrado, pulei"
fi

echo "3) Liga a skill orchestration do Orca a orquestration"
hooked=0
for k in "${SKILL_KEYS[@]}"; do
  d="$(skill_dir "$k")"
  if add_hook "$d/orchestration/SKILL.md"; then
    hooked=$((hooked + 1))
  fi
done
if add_hook "$H/.config/muse/skills/orchestration/SKILL.md"; then
  hooked=$((hooked + 1))
fi
echo "   ligada em ${hooked} pasta(s)"

echo "4) Regras para cada IA receber as chamadas do coordenador"
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
echo "Pronto. Agora no Orca: Settings > Agents > Refresh, e abra uma sessao nova de cada agente."
echo "Para conferir: bash scripts/instalar.sh --verificar"
