$ErrorActionPreference = "Continue"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
$asarBin = Join-Path $repo "node_modules\.bin\asar.cmd"
$windowsApps = "C:\Program Files\WindowsApps"
$stateRoot = Join-Path $env:USERPROFILE ".claude-cowork-zh-patch"

function Write-Check($name, $ok, $detail, $level = $null) {
  $status = if ($level) { $level } elseif ($ok) { "OK" } else { "FAIL" }
  Write-Host ("[{0}] {1} - {2}" -f $status, $name, $detail)
}

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

Write-Host "Claude Cowork Chinese Patch environment check"
Write-Host ""

$isWindows = $PSVersionTable.Platform -eq $null -or $PSVersionTable.Platform -eq "Win32NT"
Write-Check "Windows" $isWindows ([Environment]::OSVersion.VersionString)

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
  Write-Check "Administrator shell" $true "Current shell has administrator rights."
} else {
  Write-Check "Administrator shell" $true "Installer can elevate automatically. Rerun this check as administrator for the most accurate WindowsApps detection." "WARN"
}

$hasNode = Test-Command "node"
$nodeVersion = if ($hasNode) { (node -v) } else { "node not found" }
Write-Check "Node.js" $hasNode $nodeVersion

$hasNpm = Test-Command "npm"
$npmVersion = if ($hasNpm) { (npm -v) } else { "npm not found" }
Write-Check "npm" $hasNpm $npmVersion

$hasAsar = Test-Path -LiteralPath $asarBin
Write-Check "@electron/asar" $hasAsar $(if ($hasAsar) { $asarBin } else { "Run npm install first." })

$claudeApps = @()
if (Test-Path -LiteralPath $windowsApps) {
  $claudeApps = Get-ChildItem -LiteralPath $windowsApps -Directory -Filter "Claude_*__pzs8sxrjxfjjc" -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName "app\resources\app.asar") } |
    Sort-Object LastWriteTime -Descending
}

$claudeFound = $claudeApps.Count -gt 0
if ($claudeFound) {
  Write-Check "Claude WindowsApps install" $true $claudeApps[0].FullName
} elseif (-not $isAdmin) {
  Write-Check "Claude WindowsApps install" $true "Not visible from this non-admin shell. Rerun as administrator if Claude is installed but not detected." "WARN"
} else {
  Write-Check "Claude WindowsApps install" $false "Expected C:\Program Files\WindowsApps\Claude_*__pzs8sxrjxfjjc\app"
}

if ($claudeFound) {
  $app = Join-Path $claudeApps[0].FullName "app"
  $exe = Join-Path $app "Claude.exe"
  $asar = Join-Path $app "resources\app.asar"
  $enLocale = Join-Path $app "resources\en-US.json"
  $zhLocale = Join-Path $app "resources\zh-CN.json"
  Write-Check "Claude.exe" (Test-Path -LiteralPath $exe) $exe
  Write-Check "app.asar" (Test-Path -LiteralPath $asar) $asar
  Write-Check "en-US locale" (Test-Path -LiteralPath $enLocale) $enLocale
  Write-Check "zh-CN locale" (Test-Path -LiteralPath $zhLocale) $zhLocale
}

Write-Host ""
Write-Host "State directory:"
Write-Host $stateRoot

Write-Host ""
if ($isWindows -and $hasNode -and $hasNpm -and $hasAsar -and ($claudeFound -or -not $isAdmin)) {
  Write-Host "Result: this computer looks ready enough to try install.ps1. For certainty, rerun this check as administrator."
  exit 0
}

Write-Host "Result: fix the FAIL items above before running install.ps1."
exit 1
