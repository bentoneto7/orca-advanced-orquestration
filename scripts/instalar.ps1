<#
  orca-skills - instala as skills e as regras da equipe em todas as IAs (Windows / PowerShell 5.1+)

  Uso (na pasta do repositorio):
    powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1            # instala / atualiza
    powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1 -Verificar # so confere, nao altera nada

  O script e idempotente: pode rodar quantas vezes quiser. Antes de mexer em um arquivo de
  instrucoes que ja existe, ele guarda uma copia <arquivo>.bak-orca (so na primeira vez).
#>
param([switch]$Verificar)

$ErrorActionPreference = 'Continue'
$Repo = Split-Path -Parent $PSScriptRoot
$H    = $env:USERPROFILE
$Enc  = New-Object System.Text.UTF8Encoding $false
$Ini  = '<!-- orca-equipe:inicio -->'
$Fim  = '<!-- orca-equipe:fim -->'

function Write-NoBom($path, $text) {
  New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
  [IO.File]::WriteAllText($path, $text, $Enc)
}
function Backup-Once($path) {
  if ((Test-Path $path) -and -not (Test-Path "$path.bak-orca")) { Copy-Item $path "$path.bak-orca" }
}
function Set-Block($path, $body) {
  # Grava (ou troca) o bloco da equipe entre os marcadores, sem tocar no resto do arquivo.
  $block = "$Ini`n$body`n$Fim"
  if (Test-Path $path) {
    Backup-Once $path
    $t = [IO.File]::ReadAllText($path)
    $rx = [regex]::Escape($Ini) + '[\s\S]*?' + [regex]::Escape($Fim)
    if ($t -match $rx) { $t = [regex]::Replace($t, $rx, [Text.RegularExpressions.MatchEvaluator]{ param($m) $block }) }
    else { $t = $t.TrimEnd() + "`n`n" + $block + "`n" }
  } else { $t = $block + "`n" }
  Write-NoBom $path $t
}
function Add-Hook($skillFile) {
  if (-not (Test-Path $skillFile)) { return $false }
  $t = [IO.File]::ReadAllText($skillFile)
  if ($t -notmatch 'Equipe Zuuuw') {
    $hook = [IO.File]::ReadAllText("$Repo\config\orchestration-hook.md")
    Write-NoBom $skillFile ($t.TrimEnd() + "`n" + $hook)
  }
  return $true
}

# Pastas de skills de cada agente
$SkillDirs = [ordered]@{
  'claude'      = "$H\.claude\skills"
  'codex/cursor (compartilhada)' = "$H\.agents\skills"
  'codex'       = "$H\.codex\skills"
  'cursor'      = "$H\.cursor\skills"
  'grok'        = "$H\.grok\skills"
  'antigravity' = "$H\.gemini\antigravity-cli\skills"
}
# Arquivo de instrucoes globais de cada agente (onde vai o bloco "como receber chamadas")
$RuleFiles = [ordered]@{
  'claude'      = "$H\.claude\CLAUDE.md"
  'codex'       = "$H\.codex\AGENTS.md"
  'antigravity' = "$H\.gemini\GEMINI.md"
  'muse'        = "$H\.config\muse\AGENTS.md"
}
$GrokRule   = "$H\.grok\rules\orca-equipe.md"
$CursorRule = "$H\.cursor\rules\orca-equipe.mdc"
$Muse = (Get-Command muse -ErrorAction SilentlyContinue).Source
if (-not $Muse -and (Test-Path "$env:LOCALAPPDATA\Programs\muse\muse.cmd")) { $Muse = "$env:LOCALAPPDATA\Programs\muse\muse.cmd" }

if ($Verificar) {
  Write-Host "== CLIs"
  foreach ($c in 'orca','claude','codex','cursor-agent','grok','agy','muse') {
    $p = (Get-Command $c -ErrorAction SilentlyContinue).Source
    if ($p) { Write-Host "  OK  $c" } else { Write-Host "  --  $c nao encontrado no PATH" }
  }
  Write-Host "== Skills"
  foreach ($k in $SkillDirs.Keys) {
    $d = $SkillDirs[$k]; $have = @('orca-cli','orchestration','orquestration' | Where-Object { Test-Path "$d\$_\SKILL.md" })
    Write-Host ("  {0,-30} {1}" -f $k, ($(if ($have.Count) { $have -join ', ' } else { 'nenhuma' })))
  }
  if ($Muse) { Write-Host "  muse:"; & $Muse skills list 2>$null | Select-String '^(orca-cli|orchestration|orquestration)\t' | ForEach-Object { "    " + ($_.Line -split "`t")[0] } }
  Write-Host "== Regras da equipe"
  foreach ($k in $RuleFiles.Keys) { $f = $RuleFiles[$k]; $ok = (Test-Path $f) -and ([IO.File]::ReadAllText($f) -match [regex]::Escape($Ini)); Write-Host ("  {0,-12} {1}" -f $k, $(if ($ok) { 'OK' } else { 'falta' })) }
  Write-Host ("  {0,-12} {1}" -f 'grok',   $(if (Test-Path $GrokRule)   { 'OK' } else { 'falta' }))
  Write-Host ("  {0,-12} {1}" -f 'cursor', $(if (Test-Path $CursorRule) { 'OK' } else { 'falta' }))
  Write-Host "== Contas com cota (orca account list)"
  if (Get-Command orca -ErrorAction SilentlyContinue) { orca account list 2>&1 | Select-Object -First 15 }
  return
}

Write-Host "1) Skills oficiais do Orca (orca-cli e orchestration)"
if (Get-Command orca -ErrorAction SilentlyContinue) {
  orca skills install --skill orca-cli --skill orchestration --agent antigravity,claude-code,codex,cursor,grok,universal 2>&1 | Out-Null
  Write-Host "   instaladas via orca skills install"
} else { Write-Host "   AVISO: comando 'orca' nao encontrado. Abra o Orca > Settings > General > Orca CLI > Register e rode de novo." }

Write-Host "2) Skill da equipe (orquestration) em todas as pastas"
foreach ($k in $SkillDirs.Keys) {
  $d = $SkillDirs[$k]
  New-Item -ItemType Directory -Force "$d\orquestration" | Out-Null
  Copy-Item "$Repo\skills\orquestration\*" "$d\orquestration\" -Recurse -Force
  # Antigravity CLI le de uma pasta propria: leva as skills do Orca junto
  if ($k -eq 'antigravity') {
    foreach ($s in 'orca-cli','orchestration') {
      $src = "$H\.agents\skills\$s"; if (-not (Test-Path $src)) { $src = "$Repo\skills\$s" }
      if (Test-Path $src) { New-Item -ItemType Directory -Force "$d\$s" | Out-Null; Copy-Item "$src\*" "$d\$s\" -Recurse -Force }
    }
  }
  Write-Host "   $k -> $d"
}
if ($Muse) {
  foreach ($s in 'orca-cli','orchestration','orquestration') {
    $src = "$H\.agents\skills\$s"; if (-not (Test-Path $src)) { $src = "$Repo\skills\$s" }
    if (Test-Path $src) { & $Muse skills install $src --scope user 2>&1 | Out-Null }
  }
  Write-Host "   muse -> muse skills install (escopo usuario)"
} else { Write-Host "   muse nao encontrado, pulei" }

Write-Host "3) Liga a skill orchestration do Orca a orquestration"
$hooked = @()
foreach ($d in @($SkillDirs.Values) + @("$H\.config\muse\skills")) { if (Add-Hook "$d\orchestration\SKILL.md") { $hooked += $d } }
Write-Host "   ligada em $($hooked.Count) pasta(s)"

Write-Host "4) Regras para cada IA receber as chamadas do coordenador"
$body = [IO.File]::ReadAllText("$Repo\config\equipe-orca.md").TrimEnd()
foreach ($k in $RuleFiles.Keys) { Set-Block $RuleFiles[$k] $body; Write-Host "   $k -> $($RuleFiles[$k])" }
Write-NoBom $GrokRule   ([IO.File]::ReadAllText("$Repo\config\grok-rules-orca-equipe.md"));  Write-Host "   grok -> $GrokRule"
Write-NoBom $CursorRule ([IO.File]::ReadAllText("$Repo\config\cursor-rules-orca-equipe.mdc")); Write-Host "   cursor -> $CursorRule"

Write-Host ""
Write-Host "Pronto. Agora no Orca: Settings > Agents > Refresh, e abra uma sessao nova de cada agente."
Write-Host "Para conferir: powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1 -Verificar"
