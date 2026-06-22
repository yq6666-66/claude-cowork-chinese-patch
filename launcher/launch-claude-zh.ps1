# launch-claude-zh.ps1 — Smart launcher "brain".
#
# Behavior (decided purely by doctor's exit code, so no locale/encoding parsing):
#   doctor exit 0 (healthy)  -> launch Claude via its Store AUMID and exit.
#   doctor exit != 0         -> Claude was likely auto-updated and the patch was wiped;
#                               run scripts/install.ps1 to re-localize (it self-elevates via UAC
#                               and restarts Claude on success), then exit.
#
# Paths are resolved relative to THIS script (launcher/ lives inside the repo), so the launcher
# works for any clone location with no hard-coded user paths.

$ErrorActionPreference = "SilentlyContinue"

$here       = Split-Path -Parent $PSCommandPath
$repo       = (Resolve-Path (Join-Path $here "..")).Path
$installPs1 = Join-Path $repo "scripts\install.ps1"
$doctorCjs  = Join-Path $repo "scripts\doctor.cjs"
$log        = Join-Path $here "launcher.log"

function Write-Log($msg) {
  try { Add-Content -LiteralPath $log -Value ((Get-Date).ToString("yyyy-MM-dd HH:mm:ss") + "  " + $msg) } catch {}
}

# Resolve the Claude Store app's AUMID dynamically (Get-StartApps), with a known fallback.
function Get-ClaudeAumid {
  try {
    $app = Get-StartApps | Where-Object { $_.Name -match "Claude" } | Select-Object -First 1
    if ($app -and $app.AppID) { return $app.AppID }
  } catch {}
  return "Claude_pzs8sxrjxfjjc!Claude"
}
$aumid = Get-ClaudeAumid

function Start-ClaudeApp {
  # Activating the Store app via "shell:AppsFolder\<AUMID>" reliably starts it AND, when it is
  # already running, the shell brokers the activation to bring its window to the foreground.
  # NOTE: launching explorer.exe as a middleman, or starting Claude.exe directly, is NOT reliable
  # from this (hidden) launcher context — keep this form.
  Start-Process "shell:AppsFolder\$aumid"
  Write-Log "launched shell:AppsFolder\$aumid"
}

# 1) Read-only health check (no elevation).
$doctorExit = 1
try {
  & node $doctorCjs *> $null
  $doctorExit = $LASTEXITCODE
} catch {
  Write-Log ("doctor invoke failed: " + $_.Exception.Message)
}
Write-Log "doctor exit=$doctorExit"

# 2) Healthy -> just launch.
if ($doctorExit -eq 0) {
  Start-ClaudeApp
  exit 0
}

# 3) Not healthy (usually Claude was updated) -> re-localize (UAC), then it restarts Claude itself.
Write-Log "not healthy -> re-localize via scripts/install.ps1"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installPs1
$rc = $LASTEXITCODE
Write-Log "install.ps1 exit=$rc"

# Fallback: if the patch failed, still try to open Claude so the shortcut is never a dead click.
if ($rc -ne 0) {
  Write-Log "install.ps1 failed -> launch anyway"
  Start-ClaudeApp
}
exit 0
