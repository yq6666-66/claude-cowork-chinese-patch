$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..")

function Assert-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"")
    Start-Process -FilePath powershell.exe -ArgumentList $args -Verb RunAs -Wait
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

Get-Process | Where-Object { $_.ProcessName -ieq "claude" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

foreach ($target in @($exe, $asar, $enLocale, $zhLocale, $resources)) {
  if (Test-Path -LiteralPath $target) { Grant-WriteAccess $target }
}

node (Join-Path $repo "scripts\run-install.cjs") $app
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Start-Process -FilePath $exe -WorkingDirectory $app
Write-Host "Claude Cowork Chinese patch installed."
