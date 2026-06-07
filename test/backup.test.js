const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  createBackup,
  listBackups,
  restoreFrom,
  restoreLatest,
  verifyBackup,
} = require("../src/core/backup");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("creates, verifies, lists, and restores backups", () => {
  const root = tempDir("claude-zh-backup-");
  const srcDir = path.join(root, "src");
  const backupRoot = path.join(root, "backups");
  fs.mkdirSync(srcDir);

  const first = path.join(srcDir, "app.asar");
  const second = path.join(srcDir, "Claude.exe");
  fs.writeFileSync(first, "asar-v1");
  fs.writeFileSync(second, "exe-v1");

  const { backupDir, manifestPath } = createBackup([first, second], { backupRoot, runId: "001" });
  expect(fs.existsSync(manifestPath)).toBe(true);
  expect(verifyBackup(backupDir).ok).toBe(true);
  expect(listBackups({ backupRoot })).toHaveLength(1);

  fs.writeFileSync(first, "asar-v2");
  fs.writeFileSync(second, "exe-v2");

  const dryRun = restoreLatest({ backupRoot, dryRun: true });
  expect(dryRun.dryRun).toBe(true);
  expect(fs.readFileSync(first, "utf8")).toBe("asar-v2");

  restoreFrom(backupDir);
  expect(fs.readFileSync(first, "utf8")).toBe("asar-v1");
  expect(fs.readFileSync(second, "utf8")).toBe("exe-v1");
});

test("detects tampered backups and refuses restore", () => {
  const root = tempDir("claude-zh-backup-tamper-");
  const backupRoot = path.join(root, "backups");
  const src = path.join(root, "file.txt");
  fs.writeFileSync(src, "original");

  const { backupDir } = createBackup([src], { backupRoot, runId: "001" });
  fs.writeFileSync(path.join(backupDir, "file.txt"), "tampered");

  const verification = verifyBackup(backupDir);
  expect(verification.ok).toBe(false);
  expect(verification.mismatches[0].reason).toBe("checksum-mismatch");
  expect(() => restoreFrom(backupDir)).toThrow(/Backup verification failed/);
});
