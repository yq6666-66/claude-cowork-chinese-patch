const { createBackup } = require("../src/core/backup");

const backupRoot = process.argv[2];
const runId = process.argv[3];
const files = process.argv.slice(4);

if (!backupRoot || !runId || files.length === 0) {
  console.error("Usage: node scripts/create-backup.cjs <backup-root> <run-id> <file...>");
  process.exit(1);
}

const result = createBackup(files, { backupRoot, runId });
console.log(JSON.stringify(result));
