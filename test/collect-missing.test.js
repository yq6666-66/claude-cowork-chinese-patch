const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("collect-missing extracts prefixed log lines and sorts by count", () => {
  const root = tempDir("claude-zh-missing-");
  const logDir = path.join(root, "logs");
  const outFile = path.join(root, "_missing.json");
  fs.mkdirSync(logDir);
  fs.writeFileSync(
    path.join(logDir, "install-run.log"),
    [
      "__claudeCoworkZhPatchMissing__ First missing",
      "noise",
      "__claudeCoworkZhPatchMissing__ Second missing",
      "__claudeCoworkZhPatchMissing__ First missing",
      "__claudeCoworkZhPatchMissing__ 10s",
      "__claudeCoworkZhPatchMissing__ Claude responded: private chat content",
      "__claudeCoworkZhPatchMissing__ C:\\Users\\test\\path",
      "__claudeCoworkZhPatchMissing__ scripts/install.ps1",
      "__claudeCoworkZhPatchMissing__ $env:GITHUB_TOKEN=\"github_pat_secret\"",
      "__claudeCoworkZhPatchMissing__ events_url\":",
      "__claudeCoworkZhPatchMissing__ data_1.sqlite-wal",
      "__claudeCoworkZhPatchMissing__ Open",
      "__claudeCoworkZhPatchMissing__ Ran 3 commands, used 2 tools",
    ].join("\n"),
    "utf8"
  );

  const result = spawnSync(process.execPath, ["scripts/collect-missing.cjs", "--log-dir", logDir, "--out", outFile], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  });

  expect(result.status).toBe(0);
  expect(JSON.parse(fs.readFileSync(outFile, "utf8"))).toEqual({
    "First missing": 2,
    "Second missing": 1,
  });
});
