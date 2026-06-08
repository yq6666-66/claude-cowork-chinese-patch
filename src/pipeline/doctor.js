const fs = require("fs");
const os = require("os");
const path = require("path");
const { archiveContainsText } = require("../core/asar");
const { computeHeaderHash, readExeHashes } = require("../core/integrity");
const { locateClaude, sha256 } = require("../core/locate");

function defaultStateRoot() {
  return path.join(process.env.USERPROFILE || os.homedir(), ".claude-cowork-zh-patch");
}

function readLatest(stateRoot = defaultStateRoot()) {
  const latestPath = path.join(stateRoot, "latest.json");
  if (!fs.existsSync(latestPath)) return null;
  return JSON.parse(fs.readFileSync(latestPath, "utf8"));
}

function markerFor(latest) {
  const fingerprint = latest && (latest.patchFingerprint || latest.fingerprint);
  return fingerprint ? `__claudeCoworkZhPatch_${fingerprint}` : "__claudeCoworkZhPatch";
}

function asarContains(asarPath, marker) {
  return archiveContainsText(asarPath, marker, [
    ".vite/build/mainView.js",
    ".vite/build/mainWindow.js",
    ".vite/build/index.js",
  ]);
}

function fileMatchesRecord(record) {
  return Boolean(record && record.path && record.sha256 && fs.existsSync(record.path) && sha256(record.path) === record.sha256);
}

function localeRecordsFor(latest) {
  const files = latest.files || {};
  if (Array.isArray(files.locales) && files.locales.length > 0) return files.locales;
  return [files.enLocale, files.zhLocale].filter(Boolean);
}

function externalRuntimeRecordsFor(latest) {
  const files = latest.files || {};
  return Array.isArray(files.externalRuntime) ? files.externalRuntime : [];
}

function diagnose(options = {}) {
  const latest = options.latest || readLatest(options.stateRoot);
  if (!latest) {
    return {
      status: "needs-install",
      code: 2,
      reason: "latest.json not found",
    };
  }

  const appDir = options.appDir || latest.appDir || latest.app;
  const located = locateClaude({ explicitDir: appDir });
  const currentHeaderHash = computeHeaderHash(located.asarPath);
  const exeHashes = readExeHashes(located.exePath);
  const exeHasCurrentHash = exeHashes.some((entry) => entry.hash === currentHeaderHash);
  const marker = markerFor(latest);
  const mode = latest.mode || "unsafe-asar";

  if (mode === "safe") {
    const localeRecords = localeRecordsFor(latest);
    const externalRuntimeRecords = externalRuntimeRecordsFor(latest);
    const localeOk = localeRecords.length > 0 && localeRecords.every(fileMatchesRecord);
    const externalRuntimeOk = externalRuntimeRecords.every(fileMatchesRecord);

    if ((latest.bundleFingerprint && latest.bundleFingerprint !== located.bundleFingerprint) || !localeOk || !externalRuntimeOk) {
      return {
        status: "needs-repatch",
        code: 2,
        reason: latest.bundleFingerprint && latest.bundleFingerprint !== located.bundleFingerprint
          ? "Claude bundle fingerprint changed"
          : !localeOk
            ? "workspace-safe external locale files changed or missing"
            : "workspace-safe external runtime files changed or missing",
        app: located,
        currentHeaderHash,
        mode,
        marker,
        hasMarker: false,
      };
    }

    return {
      status: "healthy",
      code: 0,
      reason: "workspace-safe external locale patch is installed; Claude.exe and app.asar were not modified",
      app: located,
      currentHeaderHash,
      mode,
      marker,
      hasMarker: false,
    };
  }

  const hasMarker = asarContains(located.asarPath, marker);

  if (!exeHasCurrentHash) {
    return {
      status: "broken",
      code: 1,
      reason: "Claude.exe ASAR header hash does not match current app.asar",
      app: located,
      currentHeaderHash,
      mode,
      marker,
      hasMarker,
    };
  }

  if ((latest.bundleFingerprint && latest.bundleFingerprint !== located.bundleFingerprint) || !hasMarker) {
    return {
      status: "needs-repatch",
      code: 2,
      reason: latest.bundleFingerprint && latest.bundleFingerprint !== located.bundleFingerprint
        ? "Claude bundle fingerprint changed"
        : "patch marker missing or outdated",
      app: located,
      currentHeaderHash,
      mode,
      marker,
      hasMarker,
    };
  }

  return {
    status: "healthy",
    code: 0,
    reason: "patch marker and ASAR integrity hash look healthy",
    app: located,
    currentHeaderHash,
    mode,
    marker,
    hasMarker,
  };
}

module.exports = {
  defaultStateRoot,
  diagnose,
  readLatest,
};
