# build-shortcut.ps1 — create the "Claude 中文" desktop shortcut for the smart launcher.
#
# Steps (idempotent — safe to re-run):
#   1. Locate the current Claude Store install (version-independent) and extract its icon to claude.ico.
#   2. If csc.exe (.NET Framework) is available, compile launcher.cs -> claude-zh-launcher.exe (no-flash).
#      Otherwise fall back to launching the brain via "powershell -WindowStyle Hidden" (a brief blip).
#   3. Create / replace a desktop shortcut pointing at whichever launcher was prepared.
#
# Only ASCII is used in code paths; the Chinese display name is built from char codes so the
# file is safe to run regardless of the console / file ANSI code page.

$ErrorActionPreference = "Stop"

function ZH([int[]]$codes) { -join ($codes | ForEach-Object { [char]$_ }) }

$launcher = Split-Path -Parent $PSCommandPath
$brain    = Join-Path $launcher "launch-claude-zh.ps1"
$cs       = Join-Path $launcher "launcher.cs"
$exeOut   = Join-Path $launcher "claude-zh-launcher.exe"
$icoPath  = Join-Path $launcher "claude.ico"
$psExe    = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"

$desktop  = [Environment]::GetFolderPath("Desktop")
# Shortcut display name: "Claude " + 中文 (U+4E2D U+6587)
$lnkPath  = Join-Path $desktop ("Claude " + (ZH 0x4E2D, 0x6587) + ".lnk")

# 1) Resolve current Claude.exe (version-independent) for the icon.
$exe = $null
$pkg = Get-AppxPackage -Name Claude -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pkg -and $pkg.InstallLocation) {
  $candidate = Join-Path $pkg.InstallLocation "app\Claude.exe"
  if (Test-Path -LiteralPath $candidate) { $exe = $candidate }
}

# 2) Extract the icon to claude.ico (stable; survives Claude version bumps). Fall back to the exe itself.
$iconLocation = $null
if ($exe) {
  try {
    Add-Type -AssemblyName System.Drawing
    $ico = [System.Drawing.Icon]::ExtractAssociatedIcon($exe)
    $fs  = [System.IO.File]::Create($icoPath)
    $ico.Save($fs); $fs.Close(); $ico.Dispose()
    if (Test-Path -LiteralPath $icoPath) { $iconLocation = $icoPath }
  } catch {
    Write-Host ("icon extract failed: " + $_.Exception.Message)
  }
}
if (-not $iconLocation -and $exe) { $iconLocation = "$exe,0" }

# 3) Try to compile the no-flash launcher exe; fall back to powershell -WindowStyle Hidden.
$csc = @(
  (Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
  (Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe")
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

$builtExe = $false
if ($csc -and (Test-Path -LiteralPath $cs)) {
  try {
    $cscArgs = @("-nologo", "-target:winexe", "-out:$exeOut", "$cs")
    if ($iconLocation -and (Test-Path -LiteralPath $icoPath)) {
      $cscArgs = @("-nologo", "-target:winexe", "-win32icon:$icoPath", "-out:$exeOut", "$cs")
    }
    & $csc @cscArgs | Out-Host
    if (Test-Path -LiteralPath $exeOut) { $builtExe = $true }
  } catch {
    Write-Host ("csc build failed (will fall back to powershell hidden): " + $_.Exception.Message)
  }
}

# 4) Create / replace the desktop shortcut.
$sh  = New-Object -ComObject WScript.Shell
$lnk = $sh.CreateShortcut($lnkPath)
if ($builtExe) {
  $lnk.TargetPath  = $exeOut
  $lnk.Arguments   = ""
  $lnk.WindowStyle = 1
} else {
  $lnk.TargetPath  = $psExe
  $lnk.Arguments   = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $brain + '"'
  $lnk.WindowStyle = 7   # minimized: brief taskbar blip instead of a console window
}
$lnk.WorkingDirectory = $launcher
$lnk.Description       = "Smart launcher: open Claude and auto-keep Chinese localization"
if ($iconLocation) { $lnk.IconLocation = $iconLocation }
$lnk.Save()

Write-Host ("built no-flash exe = " + $builtExe)
Write-Host ("shortcut           = " + $lnkPath)
Write-Host ("target             = " + $lnk.TargetPath)
Write-Host ("icon               = " + $iconLocation)
