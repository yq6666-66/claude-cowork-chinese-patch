const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("backup CLI creates manifest and restore CLI verifies before restoring", () => {
  const root = tempDir("claude-zh-backup-cli-");
  const backupRoot = path.join(root, "backups");
  const file = path.join(root, "Claude.exe");
  fs.writeFileSync(file, "original");

  const create = spawnSync(process.execPath, ["scripts/create-backup.cjs", backupRoot, "run", file], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  });
  expect(create.status).toBe(0);

  const created = JSON.parse(create.stdout);
  expect(fs.existsSync(created.manifestPath)).toBe(true);

  fs.writeFileSync(file, "patched");
  const restore = spawnSync(process.execPath, ["scripts/restore-backup.cjs", created.backupDir], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  });

  expect(restore.status).toBe(0);
  expect(fs.readFileSync(file, "utf8")).toBe("original");
});
