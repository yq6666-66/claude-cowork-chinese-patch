const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("update-locale uses unified dictionary and regex rules", () => {
  const root = tempDir("claude-zh-locale-");
  const dictDir = path.join(root, "dict");
  const localeFile = path.join(root, "locale.json");
  fs.mkdirSync(dictDir);
  fs.writeFileSync(path.join(dictDir, "misc.json"), JSON.stringify({ Hello: "你好" }), "utf8");
  fs.writeFileSync(
    path.join(dictDir, "rules.json"),
    JSON.stringify([{ pattern: "^(\\d+) files?$", replace: "$1 个文件", priority: 10 }]),
    "utf8"
  );
  fs.writeFileSync(localeFile, JSON.stringify({ exact: "Hello", count: "3 files" }), "utf8");

  const result = spawnSync(process.execPath, ["scripts/update-locale.cjs", localeFile, dictDir], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  });

  expect(result.status).toBe(0);
  expect(JSON.parse(fs.readFileSync(localeFile, "utf8"))).toEqual({
    exact: "你好",
    count: "3 个文件",
  });
});
