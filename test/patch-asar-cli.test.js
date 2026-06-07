const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("patch-asar CLI injects bundles using split dictionary directory", () => {
  const root = tempDir("claude-zh-patch-asar-cli-");
  const appDir = path.join(root, "app");
  const buildDir = path.join(appDir, ".vite", "build");
  const dictDir = path.join(root, "dict");
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(dictDir);
  fs.writeFileSync(path.join(buildDir, "mainView.js"), "console.log('preload');", "utf8");
  fs.writeFileSync(path.join(buildDir, "index.js"), 'YFn(o.webContents),o.webContents.on("dom-ready",()=>{xJ()});', "utf8");
  fs.writeFileSync(path.join(dictDir, "misc.json"), JSON.stringify({ Hello: "你好" }), "utf8");
  fs.writeFileSync(path.join(dictDir, "rules.json"), "[]", "utf8");

  const result = spawnSync(process.execPath, ["scripts/patch-asar.cjs", appDir, dictDir], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Patch complete");
  expect(fs.readFileSync(path.join(buildDir, "mainView.js"), "utf8")).toContain("__claudeCoworkZhPatch_");
  expect(fs.readFileSync(path.join(buildDir, "index.js"), "utf8")).toContain("__claudeCoworkZhPatchMain_");
});

test("patch-asar CLI enables missing collection with COWORK_ZH_COLLECT", () => {
  const root = tempDir("claude-zh-patch-asar-collect-");
  const appDir = path.join(root, "app");
  const buildDir = path.join(appDir, ".vite", "build");
  const dictDir = path.join(root, "dict");
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(dictDir);
  fs.writeFileSync(path.join(buildDir, "mainView.js"), "console.log('preload');", "utf8");
  fs.writeFileSync(path.join(dictDir, "misc.json"), JSON.stringify({ Hello: "浣犲ソ" }), "utf8");
  fs.writeFileSync(path.join(dictDir, "rules.json"), "[]", "utf8");

  const result = spawnSync(process.execPath, ["scripts/patch-asar.cjs", appDir, dictDir], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
    env: {
      ...process.env,
      COWORK_ZH_COLLECT: "1",
    },
  });

  expect(result.status).toBe(0);
  expect(fs.readFileSync(path.join(buildDir, "mainView.js"), "utf8")).toContain('"collectMissing":true');
});
