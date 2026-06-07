const { restoreFrom } = require("../src/core/backup");

const backupDir = process.argv[2];

if (!backupDir) {
  console.error("Usage: node scripts/restore-backup.cjs <backup-dir>");
  process.exit(1);
}

const result = restoreFrom(backupDir);
console.log(JSON.stringify(result, null, 2));
