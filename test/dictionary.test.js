const fs = require("fs");
const os = require("os");
const path = require("path");
const { defaultDir, legacyFile, loadDictionary, validate } = require("../src/translate/dictionary");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("loads split dictionary without losing legacy entries", () => {
  const legacy = JSON.parse(fs.readFileSync(legacyFile, "utf8"));
  const dictionary = loadDictionary({ source: defaultDir });
  const result = validate({ source: defaultDir });

  expect(Object.keys(dictionary.dict).length).toBeGreaterThanOrEqual(Object.keys(legacy).length);
  for (const key of Object.keys(legacy)) {
    expect(dictionary.dict[key]).toBe(legacy[key]);
  }
  expect(dictionary.rules.length).toBeGreaterThan(0);
  expect(dictionary.protectedWords).toContain("Claude");
  expect(result.ok).toBe(true);
});

test("detects conflicting duplicate keys across domain files", () => {
  const dir = tempDir("claude-zh-dict-conflict-");
  fs.writeFileSync(path.join(dir, "a.json"), JSON.stringify({ Hello: "你好" }), "utf8");
  fs.writeFileSync(path.join(dir, "b.json"), JSON.stringify({ Hello: "您好" }), "utf8");

  const result = validate({ source: dir });

  expect(result.ok).toBe(false);
  expect(result.errors[0]).toMatchObject({ key: "Hello", reason: "conflicting-translation" });
  expect(() => loadDictionary({ source: dir })).toThrow(/Dictionary validation failed/);
});

test("reports invalid regex rules with file and index", () => {
  const dir = tempDir("claude-zh-dict-bad-rule-");
  fs.writeFileSync(path.join(dir, "misc.json"), JSON.stringify({ Hello: "你好" }), "utf8");
  fs.writeFileSync(path.join(dir, "rules.json"), JSON.stringify([{ pattern: "(", replace: "x" }]), "utf8");

  const result = validate({ source: dir });

  expect(result.ok).toBe(false);
  expect(result.errors[0]).toMatchObject({ index: 0, reason: "invalid-regexp" });
});
