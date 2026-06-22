$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
$script:installArgs = @($args)
$forceUnsafeAsar = ($args -contains "--force-unsafe-asar") -or ($args -contains "-ForceUnsafeAsar") -or ($env:CLAUDE_ZH_FORCE_UNSAFE_ASAR -eq "1")

function Assert-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $forwardArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"")
    foreach ($arg in $script:installArgs) {
      if ($arg -match "\s") {
        $forwardArgs += "`"$($arg -replace '"', '\"')`""
      } else {
        $forwardArgs += $arg
      }
    }
    Start-Process -FilePath powershell.exe -ArgumentList $forwardArgs -Verb RunAs -Wait
    exit $LASTEXITCODE
  }
}

function Find-ClaudeApp {
  Push-Location $repo
  try {
    $output = & node (Join-Path $repo "scripts\resolve-app-dir.cjs") 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($output -join "`n") }

    $appDir = ($output -join "`n").Trim()
    if (-not $appDir) { throw "locateClaude returned an empty appDir." }
    return $appDir
  } finally {
    Pop-Location
  }
}

function Grant-WriteAccess($target) {
  & takeown.exe /F $target /A | Out-Host
  & icacls.exe $target /grant "*S-1-5-32-544:F" /C | Out-Host
  attrib.exe -R $target
}

Assert-Admin

$app = Find-ClaudeApp
$exe = Join-Path $app "Claude.exe"
$resources = Join-Path $app "resources"
$asar = Join-Path $resources "app.asar"
$enLocale = Join-Path $resources "en-US.json"
$zhLocale = Join-Path $resources "zh-CN.json"
$ionI18n = Join-Path $resources "ion-dist\i18n"
$ionEnLocale = Join-Path $ionI18n "en-US.json"
$ionZhLocale = Join-Path $ionI18n "zh-CN.json"
$statsigI18n = Join-Path $ionI18n "statsig"
$statsigEnLocale = Join-Path $statsigI18n "en-US.json"
$statsigZhLocale = Join-Path $statsigI18n "zh-CN.json"

# Only stop the WindowsApps desktop Claude; spare the npm Claude Code CLI (same-named claude.exe) so a running CLI session is not killed.
Get-Process -Name claude -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*\WindowsApps\Claude_*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$grantTargets = @($resources, $enLocale, $zhLocale, $ionI18n, $ionEnLocale, $ionZhLocale, $statsigI18n, $statsigEnLocale, $statsigZhLocale)
if ($forceUnsafeAsar) {
  $grantTargets = @($exe, $asar, $resources, $enLocale, $zhLocale, $ionI18n, $ionEnLocale, $ionZhLocale, $statsigI18n, $statsigEnLocale, $statsigZhLocale)
}

foreach ($target in $grantTargets) {
  if (Test-Path -LiteralPath $target) { Grant-WriteAccess $target }
}

$installedUnsafeAsar = $false
if ($forceUnsafeAsar) {
  Write-Warning "Unsafe ASAR mode is enabled. This modifies Claude.exe and can break Claude Workspace VM signature verification."
  node (Join-Path $repo "scripts\run-install.cjs") $app --force-unsafe-asar
  $installedUnsafeAsar = $true
} else {
  Write-Host "Installing workspace-safe external locale patch. Claude.exe and app.asar will not be modified."
  node (Join-Path $repo "scripts\run-install.cjs") $app
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Start-Process -FilePath $exe -WorkingDirectory $app
Write-Host "Claude Cowork Chinese patch installed."
exit 0
