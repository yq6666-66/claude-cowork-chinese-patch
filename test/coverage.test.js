const fs = require("fs");
const os = require("os");
const path = require("path");
const { report } = require("../src/translate/coverage");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("coverage report counts uncovered missing entries", () => {
  const root = tempDir("claude-zh-coverage-");
  const dictDir = path.join(root, "dict");
  const missingFile = path.join(root, "_missing.json");
  fs.mkdirSync(dictDir);
  fs.writeFileSync(path.join(dictDir, "misc.json"), JSON.stringify({ Hello: "你好" }), "utf8");
  fs.writeFileSync(missingFile, JSON.stringify({ Hello: 2, Unknown: 3 }), "utf8");

  const result = report({ dir: dictDir, missingFile, print: false });

  expect(result).toMatchObject({
    dictEntries: 1,
    rules: 0,
    missingEntries: 2,
    uncoveredMissing: 1,
  });
  expect(result.coverageEstimate).toBe(0.5);
});
