const fs = require("fs");
const os = require("os");
const path = require("path");
const asar = require("../core/asar");
const backup = require("../core/backup");
const { computeHeaderHash, readExeHashes, writeExeHash } = require("../core/integrity");
const { locateClaude, sha256 } = require("../core/locate");
const { createLogger } = require("../core/logger");
const { injectBundles } = require("../inject/inject-bundle");
const { defaultDir, loadDictionary, validate } = require("../translate/dictionary");
const { updateLocaleFile } = require("../translate/locale");

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function defaultStateRoot() {
  return path.join(process.env.USERPROFILE || os.homedir(), ".claude-cowork-zh-patch");
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return null;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return dest;
}

function fileRecord(file) {
  if (!fs.existsSync(file)) return null;
  const stat = fs.statSync(file);
  return {
    path: file,
    sha256: sha256(file),
    size: stat.size,
  };
}

function assertStep(options, step) {
  if (options.failAt === step) throw new Error(`Injected install failure at ${step}`);
}

function markerExistsInWorkdir(workDir, marker) {
  const buildDir = path.join(workDir, ".vite", "build");
  const targets = ["mainView.js", "mainWindow.js", "index.js"].map((name) => path.join(buildDir, name));
  return targets.some((file) => fs.existsSync(file) && fs.readFileSync(file, "utf8").includes(marker));
}

function markerExistsInArchive(asarPath, marker) {
  return asar.archiveContainsText(asarPath, marker, [
    ".vite/build/mainView.js",
    ".vite/build/mainWindow.js",
    ".vite/build/index.js",
  ]);
}

function anyPatchMarkerExistsInArchive(asarPath) {
  return markerExistsInArchive(asarPath, "__claudeCoworkZhPatch_");
}

function readLatest(stateRoot) {
  const latestPath = path.join(stateRoot, "latest.json");
  if (!fs.existsSync(latestPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(latestPath, "utf8"));
  } catch {
    return null;
  }
}

function markerForFingerprint(fingerprint) {
  return fingerprint ? `__claudeCoworkZhPatch_${fingerprint}` : null;
}

function reusableBackupForCurrentPatch({ app, stateRoot }) {
  const latest = readLatest(stateRoot);
  const marker = markerForFingerprint(latest && (latest.patchFingerprint || latest.fingerprint));
  if (!latest || !marker || !latest.backup) return null;
  if (latest.appDir && path.resolve(latest.appDir) !== path.resolve(app.appDir)) return null;
  if (!markerExistsInArchive(app.asarPath, marker) && !anyPatchMarkerExistsInArchive(app.asarPath)) return null;

  const verification = backup.verifyBackup(latest.backup);
  if (!verification.ok) return null;

  return {
    backupDir: latest.backup,
    manifestPath: latest.backupManifest || path.join(latest.backup, "manifest.json"),
    reused: true,
  };
}

function normalizeLogger(logger, runId, stateRoot) {
  if (logger) return logger;
  return createLogger({
    runId,
    logDir: path.join(stateRoot, "logs"),
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableCopyError(error) {
  return error && ["EBUSY", "EPERM", "EACCES"].includes(error.code);
}

async function copyFileWithRetry(src, dest, options = {}) {
  const attempts = Number(options.attempts || 8);
  const delayMs = Number(options.delayMs || 500);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      fs.copyFileSync(src, dest);
      return;
    } catch (error) {
      if (!isRetriableCopyError(error) || attempt === attempts) throw error;
      await wait(delayMs);
    }
  }
}

async function runInstall(options = {}) {
  const runId = options.runId || timestamp();
  const stateRoot = options.stateRoot || defaultStateRoot();
  const logger = normalizeLogger(options.logger, runId, stateRoot);
  const repoDir = options.repoDir || path.resolve(__dirname, "..", "..");
  const dictionaryDir = options.dictionaryDir || path.join(repoDir, "translations", "zh-CN");
  const backupRoot = options.backupRoot || path.join(stateRoot, "backups");
  const workRoot = options.workRoot || path.join(os.tmpdir(), "claude-cowork-zh-patch");
  let backupDir = null;

  try {
    const locateStep = logger.step ? logger.step("locate") : null;
    const app = locateClaude({ explicitDir: options.appDir });
    if (locateStep) locateStep.ok({ appDir: app.appDir });

    const resourcesDir = path.dirname(app.asarPath);
    const enLocale = path.join(resourcesDir, "en-US.json");
    const zhLocale = path.join(resourcesDir, "zh-CN.json");
    const backupFiles = [app.exePath, app.asarPath, enLocale, zhLocale].filter((file) => fs.existsSync(file));

    const backupStep = logger.step ? logger.step("backup") : null;
    const backupResult = reusableBackupForCurrentPatch({ app, stateRoot }) || backup.createBackup(backupFiles, { backupRoot, runId });
    backupDir = backupResult.backupDir;
    if (backupStep) backupStep.ok({ backupDir, reused: Boolean(backupResult.reused) });

    const workDir = path.join(workRoot, runId, "app");
    const tempDir = path.join(workRoot, runId, "temp");
    const patchedAsar = path.join(tempDir, "app.asar");
    const patchedExe = path.join(tempDir, "Claude.exe");
    const patchedEnLocale = path.join(tempDir, "en-US.json");
    const patchedZhLocale = path.join(tempDir, "zh-CN.json");
    fs.rmSync(path.join(workRoot, runId), { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    const dictionaryValidation = validate({ source: fs.existsSync(dictionaryDir) ? dictionaryDir : defaultDir });
    if (!dictionaryValidation.ok) {
      throw new Error(`Dictionary validation failed: ${JSON.stringify(dictionaryValidation.errors)}`);
    }
    const dictionary = loadDictionary({ source: fs.existsSync(dictionaryDir) ? dictionaryDir : defaultDir });

    const extractStep = logger.step ? logger.step("extract") : null;
    asar.extract(app.asarPath, workDir);
    if (extractStep) extractStep.ok({ workDir });

    const injectStep = logger.step ? logger.step("inject") : null;
    const injection = injectBundles({
      appDir: workDir,
      dict: dictionary.dict,
      rules: dictionary.rules,
      protectedWords: dictionary.protectedWords,
      collectMissing: Boolean(options.collectMissing),
      missingLogFile: path.join(stateRoot, "logs", "missing-runtime.log"),
      logger,
    });
    if (injectStep) injectStep.ok({ marker: injection.marker, mainWarning: injection.main.warning });

    const localeStep = logger.step ? logger.step("locale") : null;
    const localeResults = [];
    const enCopy = copyIfExists(enLocale, patchedEnLocale);
    const zhCopy = copyIfExists(zhLocale, patchedZhLocale);
    if (enCopy) localeResults.push(updateLocaleFile(enCopy, dictionary));
    if (zhCopy) localeResults.push(updateLocaleFile(zhCopy, dictionary));
    if (localeStep) localeStep.ok({ locales: localeResults });

    assertStep(options, "pack");
    const packStep = logger.step ? logger.step("pack") : null;
    await asar.pack(workDir, patchedAsar);
    if (packStep) packStep.ok({ patchedAsar });

    const hashStep = logger.step ? logger.step("hash") : null;
    const latestBeforeInstall = readLatest(stateRoot);
    const currentAsarHeaderHash = computeHeaderHash(app.asarPath);
    const asarHeaderHash = computeHeaderHash(patchedAsar);
    fs.copyFileSync(app.exePath, patchedExe);
    writeExeHash(patchedExe, asarHeaderHash, {
      additionalKnownHashes: [currentAsarHeaderHash, latestBeforeInstall && latestBeforeInstall.asarHeaderHash],
    });
    if (hashStep) hashStep.ok({ asarHeaderHash });

    assertStep(options, "self-check");
    const selfCheckStep = logger.step ? logger.step("self-check") : null;
    if (!markerExistsInWorkdir(workDir, injection.marker)) {
      throw new Error(`Patch marker missing in temporary bundle: ${injection.marker}`);
    }
    if (!markerExistsInArchive(patchedAsar, injection.marker)) {
      throw new Error(`Patch marker missing in temporary ASAR: ${injection.marker}`);
    }
    const exeHasHash = readExeHashes(patchedExe).some((entry) => entry.hash === asarHeaderHash);
    if (!exeHasHash) {
      throw new Error("Temporary Claude.exe does not contain patched ASAR header hash.");
    }
    if (selfCheckStep) selfCheckStep.ok();

    const replaceStep = logger.step ? logger.step("replace") : null;
    await copyFileWithRetry(patchedAsar, app.asarPath, options.copyRetry);
    if (enCopy) await copyFileWithRetry(patchedEnLocale, enLocale, options.copyRetry);
    if (zhCopy) await copyFileWithRetry(patchedZhLocale, zhLocale, options.copyRetry);
    await copyFileWithRetry(patchedExe, app.exePath, options.copyRetry);
    if (replaceStep) replaceStep.ok();

    const latest = {
      app: app.appDir,
      appDir: app.appDir,
      version: app.version,
      bundleFingerprint: sha256(app.asarPath).slice(0, 16),
      patchFingerprint: injection.fingerprint,
      backup: backupDir,
      backupManifest: backupResult.manifestPath,
      asarHeaderHash,
      files: {
        exe: fileRecord(app.exePath),
        asar: fileRecord(app.asarPath),
        enLocale: fileRecord(enLocale),
        zhLocale: fileRecord(zhLocale),
      },
      installedAt: new Date().toISOString(),
    };
    const latestPath = path.join(stateRoot, "latest.json");
    fs.mkdirSync(path.dirname(latestPath), { recursive: true });
    fs.writeFileSync(latestPath, `${JSON.stringify(latest, null, 2)}\n`, "utf8");

    if (logger.flush) logger.flush();
    return {
      ok: true,
      app,
      backupDir,
      latestPath,
      marker: injection.marker,
      patchFingerprint: injection.fingerprint,
      asarHeaderHash,
    };
  } catch (error) {
    let restoreResult = null;
    if (backupDir) {
      try {
        restoreResult = backup.restoreFrom(backupDir);
      } catch (restoreError) {
        error.restoreError = restoreError;
      }
    }
    error.restoreResult = restoreResult;
    if (logger.error) logger.error(error.message, { error: { message: error.message, stack: error.stack }, restored: Boolean(restoreResult) });
    if (logger.flush) logger.flush();
    throw error;
  }
}

module.exports = {
  runInstall,
};
