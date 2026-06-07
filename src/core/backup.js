const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

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

function defaultBackupRoot() {
  const home = process.env.USERPROFILE || os.homedir();
  return path.join(home, ".claude-cowork-zh-patch", "backups");
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isRetriableCopyError(error) {
  return error && ["EBUSY", "EPERM", "EACCES"].includes(error.code);
}

function copyFileWithRetry(src, dest, options = {}) {
  const attempts = Number(options.attempts || 8);
  const delayMs = Number(options.delayMs || 500);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      fs.copyFileSync(src, dest);
      return;
    } catch (error) {
      lastError = error;
      if (!isRetriableCopyError(error) || attempt === attempts) throw error;
      sleep(delayMs);
    }
  }

  throw lastError;
}

function uniqueName(baseName, used) {
  if (!used.has(baseName)) {
    used.add(baseName);
    return baseName;
  }

  const ext = path.extname(baseName);
  const stem = path.basename(baseName, ext);
  let index = 1;
  while (used.has(`${stem}-${index}${ext}`)) index += 1;
  const next = `${stem}-${index}${ext}`;
  used.add(next);
  return next;
}

function createBackup(files, options = {}) {
  const backupRoot = options.backupRoot || defaultBackupRoot();
  const runId = options.runId || timestamp();
  const backupDir = path.join(backupRoot, runId);
  const manifestPath = path.join(backupDir, "manifest.json");
  const usedNames = new Set(["manifest.json"]);

  fs.mkdirSync(backupDir, { recursive: true });

  const manifest = {
    createdAt: new Date().toISOString(),
    files: files.map((file) => {
      const src = path.resolve(file);
      const stat = fs.statSync(src);
      if (!stat.isFile()) throw new Error(`Cannot back up non-file path: ${src}`);

      const backupName = uniqueName(path.basename(src), usedNames);
      const dest = path.join(backupDir, backupName);
      fs.copyFileSync(src, dest);

      return {
        src,
        backupName,
        sha256: sha256(dest),
        size: stat.size,
      };
    }),
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { backupDir, manifestPath };
}

function listBackups(options = {}) {
  const backupRoot = options.backupRoot || defaultBackupRoot();
  if (!fs.existsSync(backupRoot)) return [];

  return fs
    .readdirSync(backupRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const backupDir = path.join(backupRoot, entry.name);
      const stat = fs.statSync(backupDir);
      return {
        name: entry.name,
        backupDir,
        manifestPath: path.join(backupDir, "manifest.json"),
        mtimeMs: stat.mtimeMs,
      };
    })
    .filter((entry) => fs.existsSync(entry.manifestPath))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function verifyBackup(backupDir) {
  const manifestPath = path.join(backupDir, "manifest.json");
  const mismatches = [];

  if (!fs.existsSync(manifestPath)) {
    return { ok: false, mismatches: [{ file: manifestPath, reason: "missing-manifest" }] };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  for (const file of manifest.files || []) {
    const backupPath = path.join(backupDir, file.backupName);
    if (!fs.existsSync(backupPath)) {
      mismatches.push({ file: backupPath, reason: "missing-file" });
      continue;
    }

    const stat = fs.statSync(backupPath);
    const actualHash = sha256(backupPath);
    if (stat.size !== file.size || actualHash !== file.sha256) {
      mismatches.push({
        file: backupPath,
        reason: "checksum-mismatch",
        expectedSha256: file.sha256,
        actualSha256: actualHash,
        expectedSize: file.size,
        actualSize: stat.size,
      });
    }
  }

  return { ok: mismatches.length === 0, mismatches };
}

function restoreFrom(backupDir, options = {}) {
  const verification = verifyBackup(backupDir);
  if (!verification.ok) {
    throw new Error(`Backup verification failed: ${JSON.stringify(verification.mismatches)}`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, "manifest.json"), "utf8"));
  const restored = [];

  for (const file of manifest.files || []) {
    const from = path.join(backupDir, file.backupName);
    const to = file.src;
    restored.push({ from, to });

    if (!options.dryRun) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      copyFileWithRetry(from, to, options.copyRetry);
    }
  }

  return {
    backupDir,
    dryRun: Boolean(options.dryRun),
    restored,
  };
}

function restoreLatest(options = {}) {
  const backups = listBackups({ backupRoot: options.backupRoot });
  if (backups.length === 0) {
    throw new Error("No backups found.");
  }
  return restoreFrom(backups[0].backupDir, options);
}

module.exports = {
  copyFileWithRetry,
  createBackup,
  defaultBackupRoot,
  listBackups,
  restoreFrom,
  restoreLatest,
  verifyBackup,
};
