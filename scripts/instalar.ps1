<#
  orca-advanced-orquestration - installs the team skills and rules in every AI (Windows / PowerShell 5.1+)
  macOS / Linux: bash scripts/instalar.sh

  Usage (from the repository folder):
    powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1            # install / update
    powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1 -Verificar # check only, changes nothing

  The script is idempotent: run it as many times as you like. Before touching an instructions
  file that already exists, it keeps a copy <file>.bak-orca (only the first time).
  It also removes the old `orquestration` and `orquestration-avanced` skill folders (renamed to orca-advanced-orquestration).
#>
param([switch]$Verificar)

$ErrorActionPreference = 'Continue'
$Repo  = Split-Path -Parent $PSScriptRoot
$H     = $env:USERPROFILE
$Enc   = New-Object System.Text.UTF8Encoding $false
$Ini   = '<!-- orca-equipe:inicio -->'
$Fim   = '<!-- orca-equipe:fim -->'
$Skill = 'orca-advanced-orquestration'
$OldSkills = @('orquestration', 'orquestration-avanced')

function Write-NoBom($path, $text) {
  New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
  [IO.File]::WriteAllText($path, $text, $Enc)
}
function Backup-Once($path) {
  if ((Test-Path $path) -and -not (Test-Path "$path.bak-orca")) { Copy-Item $path "$path.bak-orca" }
}
function Set-Block($path, $body) {
  # Writes (or replaces) the team block between the markers, without touching the rest of the file.
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
  # Writes (or replaces) the "Zuuuw team" section at the end of Orca's skill.
  if (-not (Test-Path $skillFile)) { return $false }
  $t = [IO.File]::ReadAllText($skillFile) -replace "`r", ''
  foreach ($h in '## Zuuuw team', '## Equipe Zuuuw') { $i = $t.IndexOf($h); if ($i -ge 0) { $t = $t.Substring(0, $i) } }
  $hook = [IO.File]::ReadAllText("$Repo\config\orchestration-hook.md") -replace "`r", ''
  Write-NoBom $skillFile ($t.TrimEnd() + "`n`n" + $hook)
  return $true
}

# Skill folders of each agent
$SkillDirs = [ordered]@{
  'claude'      = "$H\.claude\skills"
  'codex/cursor (shared)' = "$H\.agents\skills"
  'codex'       = "$H\.codex\skills"
  'cursor'      = "$H\.cursor\skills"
  'grok'        = "$H\.grok\skills"
  'antigravity' = "$H\.gemini\antigravity-cli\skills"
}
# Global instructions file of each agent (where the "how to take calls" block goes)
$RuleFiles = [ordered]@{
  'claude'      = "$H\.claude\CLAUDE.md"
  'codex'       = "$H\.codex\AGENTS.md"
  'antigravity' = "$H\.gemini\GEMINI.md"
  'muse'        = "$H\.config\muse\AGENTS.md"
}
$GrokRule   = "$H\.grok\rules\orca-equipe.md"
$CursorRule = "$H\.cursor\rules\orca-equipe.mdc"
$MuseSkills = "$H\.config\muse\skills"
$Muse = (Get-Command muse -ErrorAction SilentlyContinue).Source
if (-not $Muse -and (Test-Path "$env:LOCALAPPDATA\Programs\muse\muse.cmd")) { $Muse = "$env:LOCALAPPDATA\Programs\muse\muse.cmd" }

if ($Verificar) {
  $fail = 0
  Write-Host "== CLIs"
  foreach ($c in 'orca','claude','codex','cursor-agent','grok','agy','muse') {
    $p = (Get-Command $c -ErrorAction SilentlyContinue).Source
    if ($p) { Write-Host "  OK  $c" } else { Write-Host "  --  $c not found in PATH" }
  }
  Write-Host "== Skills"
  $ref = "$Repo\skills\$Skill"
  foreach ($k in $SkillDirs.Keys) {
    $d = $SkillDirs[$k]; $have = @('orca-cli','orchestration',$Skill | Where-Object { Test-Path "$d\$_\SKILL.md" })
    $same = 'identical'
    foreach ($f in Get-ChildItem $ref -File) { $o = "$d\$Skill\$($f.Name)"; if (-not (Test-Path $o) -or (Get-FileHash $o).Hash -ne (Get-FileHash $f.FullName).Hash) { $same = 'DIFFERENT'; $fail++ } }
    $old = @($OldSkills | Where-Object { Test-Path "$d\$_" }); if ($old.Count) { $fail++ }
    Write-Host ("  {0,-24} {1}  [{2}]{3}" -f $k, ($(if ($have.Count) { $have -join ', ' } else { 'none' })), $same, $(if ($old.Count) { "  old: $($old -join ', ')" } else { '' }))
  }
  if (Test-Path "$MuseSkills\$Skill\SKILL.md") { Write-Host "  muse                     $Skill" } else { Write-Host "  muse                     missing $Skill"; $fail++ }
  if ($Muse) { & $Muse skills list 2>$null | Select-String "^(orca-cli|orchestration|$Skill|orquestration-avanced|orquestration)\t" | ForEach-Object { "    " + ($_.Line -split "`t")[0] } }
  Write-Host "== Orca orchestration link"
  foreach ($d in @($SkillDirs.Values) + @($MuseSkills)) {
    $f = "$d\orchestration\SKILL.md"
    if (Test-Path $f) { $ok = ([IO.File]::ReadAllText($f)).Contains("``$Skill``"); if (-not $ok) { $fail++ }; Write-Host ("  {0,-48} {1}" -f $f.Replace($H,'~'), $(if ($ok) { 'OK' } else { 'missing' })) }
  }
  Write-Host "== Team rules"
  foreach ($k in $RuleFiles.Keys) { $f = $RuleFiles[$k]; $ok = (Test-Path $f) -and ([IO.File]::ReadAllText($f) -match [regex]::Escape($Ini)) -and ([IO.File]::ReadAllText($f)).Contains($Skill); if (-not $ok) { $fail++ }; Write-Host ("  {0,-12} {1}" -f $k, $(if ($ok) { 'OK' } else { 'missing' })) }
  foreach ($r in @(@('grok',$GrokRule), @('cursor',$CursorRule))) { $ok = (Test-Path $r[1]) -and ([IO.File]::ReadAllText($r[1])).Contains($Skill); if (-not $ok) { $fail++ }; Write-Host ("  {0,-12} {1}" -f $r[0], $(if ($ok) { 'OK' } else { 'missing' })) }
  Write-Host "== Quota of each AI (cotas.mjs, no tokens spent)"
  if (Get-Command node -ErrorAction SilentlyContinue) { node "$Repo\skills\$Skill\cotas.mjs" }
  elseif (Get-Command orca -ErrorAction SilentlyContinue) { orca account list 2>&1 | Select-Object -First 15 }
  Write-Host ""
  if ($fail -eq 0) { Write-Host "Check passed." } else { Write-Host "Check found $fail problem(s). Run the installer again." }
  return
}

Write-Host "1) Official Orca skills (orca-cli and orchestration)"
if (Get-Command orca -ErrorAction SilentlyContinue) {
  orca skills install --skill orca-cli --skill orchestration --agent antigravity,claude-code,codex,cursor,grok,universal 2>&1 | Out-Null
  Write-Host "   installed via orca skills install"
} else { Write-Host "   WARNING: 'orca' command not found. Open Orca > Settings > General > Orca CLI > Register and run again." }

Write-Host "2) Team skill ($Skill) in every folder"
foreach ($k in $SkillDirs.Keys) {
  $d = $SkillDirs[$k]
  foreach ($o in $OldSkills) { if (Test-Path "$d\$o") { Remove-Item -Recurse -Force "$d\$o" } }
  New-Item -ItemType Directory -Force "$d\$Skill" | Out-Null
  Copy-Item "$Repo\skills\$Skill\*" "$d\$Skill\" -Recurse -Force
  # Antigravity CLI reads from its own folder: bring Orca's skills along
  if ($k -eq 'antigravity') {
    foreach ($s in 'orca-cli','orchestration') {
      $src = "$H\.agents\skills\$s"; if (-not (Test-Path $src)) { $src = "$Repo\skills\$s" }
      if (Test-Path $src) { New-Item -ItemType Directory -Force "$d\$s" | Out-Null; Copy-Item "$src\*" "$d\$s\" -Recurse -Force }
    }
  }
  Write-Host "   $k -> $d"
}
if ($Muse) {
  foreach ($o in $OldSkills) {
    & $Muse skills uninstall $o 2>&1 | Out-Null
    if (Test-Path "$MuseSkills\$o") { Remove-Item -Recurse -Force "$MuseSkills\$o" }
  }
  foreach ($s in 'orca-cli','orchestration',$Skill) {
    $src = "$H\.agents\skills\$s"; if (-not (Test-Path $src)) { $src = "$Repo\skills\$s" }
    if (Test-Path $src) { & $Muse skills install $src --scope user --force 2>&1 | Out-Null; $dst = "$MuseSkills\$s"; New-Item -ItemType Directory -Force $dst | Out-Null; Copy-Item "$src\*" $dst -Recurse -Force }
  }
  Write-Host "   muse -> muse skills install (user scope)"
} else { Write-Host "   muse not found, skipped" }

Write-Host "3) Link Orca's orchestration skill to $Skill"
$hooked = @()
foreach ($d in @($SkillDirs.Values) + @($MuseSkills)) { if (Add-Hook "$d\orchestration\SKILL.md") { $hooked += $d } }
Write-Host "   linked in $($hooked.Count) folder(s)"

Write-Host "4) Rules so each AI takes the coordinator's calls"
$body = [IO.File]::ReadAllText("$Repo\config\equipe-orca.md").TrimEnd()
foreach ($k in $RuleFiles.Keys) { Set-Block $RuleFiles[$k] $body; Write-Host "   $k -> $($RuleFiles[$k])" }
Write-NoBom $GrokRule   ([IO.File]::ReadAllText("$Repo\config\grok-rules-orca-equipe.md"));  Write-Host "   grok -> $GrokRule"
Write-NoBom $CursorRule ([IO.File]::ReadAllText("$Repo\config\cursor-rules-orca-equipe.mdc")); Write-Host "   cursor -> $CursorRule"

Write-Host ""
Write-Host "Done. Now in Orca: Settings > Agents > Refresh, and open a new session of each agent."
Write-Host "To check: powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1 -Verificar"
