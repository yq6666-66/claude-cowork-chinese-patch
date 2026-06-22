const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const asarOps = require("./asar");

const DEFAULT_WINDOWS_APPS_ROOT = "C:\\Program Files\\WindowsApps";
const DEFAULT_COMMAND_TIMEOUT_MS = 15000;

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function cleanCandidate(candidate) {
  return String(candidate || "").trim().replace(/^"|"$/g, "");
}

function hasAppFiles(appDir) {
  return fileExists(path.join(appDir, "Claude.exe")) && fileExists(path.join(appDir, "resources", "app.asar"));
}

function resolveAppDir(candidate) {
  const cleaned = cleanCandidate(candidate);
  if (!cleaned) throw new Error("Claude app directory is empty.");

  const resolved = path.resolve(cleaned);
  const base = path.basename(resolved).toLowerCase() === "claude.exe" ? path.dirname(resolved) : resolved;
  const candidates = [base, path.join(base, "app")];

  for (const appDir of candidates) {
    if (hasAppFiles(appDir)) return appDir;
  }

  return base;
}

function readPackageVersion(filePath) {
  if (!fileExists(filePath)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return typeof parsed.version === "string" && parsed.version ? parsed.version : null;
  } catch {
    return null;
  }
}

function versionFromAsar(asarPath) {
  try {
    const parsed = JSON.parse(asarOps.readText(asarPath, "package.json"));
    return typeof parsed.version === "string" && parsed.version ? parsed.version : null;
  } catch {
    return null;
  }
}

function versionFromApp(appDir, asarPath) {
  const windowsAppsParent = path.basename(path.dirname(appDir));
  const versionMatch = windowsAppsParent.match(/^Claude_([^_]+)/i);
  if (versionMatch) return versionMatch[1];

  return (
    readPackageVersion(path.join(appDir, "resources", "app", "package.json")) ||
    readPackageVersion(path.join(appDir, "resources", "package.json")) ||
    versionFromAsar(asarPath)
  );
}

function appInfo(candidate) {
  const resolved = resolveAppDir(candidate);
  const appDir = path.resolve(resolved);
  const exePath = path.join(appDir, "Claude.exe");
  const asarPath = path.join(appDir, "resources", "app.asar");

  if (!fileExists(exePath)) throw new Error(`Cannot find Claude.exe: ${exePath}`);
  if (!fileExists(asarPath)) throw new Error(`Cannot find app.asar: ${asarPath}`);

  return {
    appDir,
    exePath,
    asarPath,
    version: versionFromApp(appDir, asarPath),
    bundleFingerprint: sha256(asarPath).slice(0, 16),
  };
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean).map((value) => path.resolve(cleanCandidate(value)))));
}

function mtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function sortCandidates(candidates) {
  return unique(candidates).sort((a, b) => Math.max(mtime(b), mtime(path.dirname(b))) - Math.max(mtime(a), mtime(path.dirname(a))));
}

function windowsAppsCandidates(options = {}) {
  const root = options.windowsAppsRoot === undefined ? DEFAULT_WINDOWS_APPS_ROOT : options.windowsAppsRoot;
  if (!root || !fileExists(root)) return [];

  return sortCandidates(
    fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^Claude_.*__[a-z0-9]+$/i.test(entry.name))
      .map((entry) => path.join(root, entry.name, "app"))
      .filter((appDir) => fileExists(path.join(appDir, "resources", "app.asar")))
  );
}

function localAppDataCandidates(options = {}) {
  const env = options.env || process.env;
  const localAppData = options.localAppData === undefined ? env.LOCALAPPDATA : options.localAppData;
  if (!localAppData) return [];

  const programs = path.join(localAppData, "Programs");
  if (!fileExists(programs)) return [];

  return sortCandidates(
    fs
      .readdirSync(programs, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /claude|anthropic/i.test(entry.name))
      .map((entry) => path.join(programs, entry.name))
      .flatMap((dir) => [dir, path.join(dir, "app")])
      .filter((appDir) => fileExists(path.join(appDir, "resources", "app.asar")))
  );
}

function parseCommandLines(output) {
  return String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^ExecutablePath=/i, "").trim())
    .filter((line) => line && !/^ExecutablePath$/i.test(line));
}

function runCommand(command, args, options = {}) {
  const runner = options.execFileSync || execFileSync;
  const env = options.env || process.env;
  const configuredTimeout = Number(options.commandTimeoutMs || env.COWORK_ZH_LOCATE_TIMEOUT_MS || DEFAULT_COMMAND_TIMEOUT_MS);
  const timeout = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : DEFAULT_COMMAND_TIMEOUT_MS;

  return runner(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
    windowsHide: true,
  });
}

function record(errors, strategy, candidate, message) {
  if (!errors) return;
  const entry = { strategy, message };
  if (candidate) entry.candidate = candidate;
  errors.push(entry);
}

function runningProcessCandidates(options = {}) {
  if (Array.isArray(options.processPaths)) {
    return sortCandidates(options.processPaths.map((exePath) => path.dirname(cleanCandidate(exePath))));
  }

  const platform = options.platform || process.platform;
  if (platform !== "win32") return [];

  const candidates = [];
  const powershell = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "Get-Process -Name Claude -ErrorAction SilentlyContinue | Where-Object { $_.Path } | Select-Object -ExpandProperty Path",
  ];

  try {
    candidates.push(...parseCommandLines(runCommand("powershell.exe", powershell, options)));
  } catch (error) {
    record(options.errors, "running-process", null, `PowerShell process lookup failed: ${error.message}`);
  }

  try {
    candidates.push(...parseCommandLines(runCommand("wmic.exe", ["process", "where", "name='Claude.exe'", "get", "ExecutablePath", "/value"], options)));
  } catch (error) {
    record(options.errors, "running-process", null, `WMIC process lookup failed: ${error.message}`);
  }

  return sortCandidates(candidates.map((exePath) => path.dirname(cleanCandidate(exePath))));
}

function registryCandidates(options = {}) {
  if (Array.isArray(options.registryInstallLocations)) {
    return sortCandidates(options.registryInstallLocations);
  }

  const platform = options.platform || process.platform;
  if (platform !== "win32") return [];

  const script = [
    "$roots=@(",
    "'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
    "'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
    "'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'",
    ");",
    "foreach($root in $roots){",
    "Get-ItemProperty $root -ErrorAction SilentlyContinue |",
    "Where-Object { $_.DisplayName -match 'Claude' -and $_.InstallLocation } |",
    "Select-Object -ExpandProperty InstallLocation",
    "}",
  ].join(" ");

  try {
    return sortCandidates(parseCommandLines(runCommand("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], options)));
  } catch (error) {
    record(options.errors, "registry", null, `Registry lookup failed: ${error.message}`);
    return [];
  }
}

function appxPackageCandidates(options = {}) {
  if (Array.isArray(options.appxInstallLocations)) {
    return sortCandidates(options.appxInstallLocations);
  }

  const platform = options.platform || process.platform;
  if (platform !== "win32") return [];

  const script = [
    "$packages = Get-AppxPackage -Name Claude -ErrorAction SilentlyContinue;",
    "if (-not $packages) {",
    "  $packages = Get-AppxPackage -ErrorAction SilentlyContinue |",
    "    Where-Object { $_.Name -match 'Claude|Anthropic' -or $_.PackageFamilyName -match 'Claude|Anthropic|pzs8sxrjxfjjc' };",
    "}",
    "$packages | Where-Object { $_.InstallLocation } | Select-Object -ExpandProperty InstallLocation",
  ].join(" ");

  try {
    return sortCandidates(parseCommandLines(runCommand("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], options)));
  } catch (error) {
    record(options.errors, "AppxPackage", null, `AppxPackage lookup failed: ${error.message}`);
    return [];
  }
}

function locateClaude(options = {}) {
  const env = options.env || process.env;
  const errors = [];
  const attempted = [];
  const strategyOptions = { ...options, env, errors };
  const strategies = [
    { name: "explicitDir", enabled: Boolean(options.explicitDir), candidates: () => [options.explicitDir] },
    { name: "COWORK_ZH_APP_DIR", enabled: Boolean(env.COWORK_ZH_APP_DIR), candidates: () => [env.COWORK_ZH_APP_DIR] },
    { name: "running-process", enabled: true, candidates: () => runningProcessCandidates(strategyOptions) },
    { name: "AppxPackage", enabled: true, candidates: () => appxPackageCandidates(strategyOptions) },
    { name: "WindowsApps", enabled: true, candidates: () => windowsAppsCandidates(strategyOptions) },
    { name: "LOCALAPPDATA\\Programs", enabled: true, candidates: () => localAppDataCandidates(strategyOptions) },
    { name: "registry", enabled: true, candidates: () => registryCandidates(strategyOptions) },
  ];

  for (const strategy of strategies) {
    if (!strategy.enabled) continue;

    let candidates = [];
    try {
      candidates = unique(strategy.candidates());
    } catch (error) {
      record(errors, strategy.name, null, error.message);
      continue;
    }

    if (candidates.length === 0) {
      record(errors, strategy.name, null, "No candidates found.");
      continue;
    }

    for (const candidate of candidates) {
      attempted.push({ strategy: strategy.name, candidate });
      try {
        return appInfo(candidate);
      } catch (error) {
        record(errors, strategy.name, candidate, error.message);
      }
    }
  }

  const error = new Error("Cannot find Claude Desktop installation. Set COWORK_ZH_APP_DIR to the Claude app directory if auto-detection fails.");
  error.errors = errors;
  error.attempted = attempted;
  throw error;
}

module.exports = {
  appInfo,
  appxPackageCandidates,
  locateClaude,
  registryCandidates,
  runningProcessCandidates,
  sha256,
  windowsAppsCandidates,
};
