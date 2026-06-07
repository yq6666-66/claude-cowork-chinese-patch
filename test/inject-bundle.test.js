const fs = require("fs");
const os = require("os");
const path = require("path");
const { injectBundles } = require("../src/inject/inject-bundle");

function tempBuild() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "claude-zh-inject-"));
  const buildDir = path.join(root, ".vite", "build");
  fs.mkdirSync(buildDir, { recursive: true });
  return { root, buildDir };
}

test("injects preload and main bundles idempotently", () => {
  const { root, buildDir } = tempBuild();
  const preload = path.join(buildDir, "mainView.js");
  const main = path.join(buildDir, "index.js");
  fs.writeFileSync(preload, "console.log('preload');", "utf8");
  fs.writeFileSync(main, 'YFn(o.webContents),o.webContents.on("dom-ready",()=>{xJ()});', "utf8");

  const first = injectBundles({
    appDir: root,
    dict: { Hello: "你好" },
    rules: [{ pattern: "^New (.+)$", replace: "新建 $1", priority: 1 }],
  });
  const second = injectBundles({
    appDir: root,
    dict: { Hello: "你好" },
    rules: [{ pattern: "^New (.+)$", replace: "新建 $1", priority: 1 }],
  });

  const preloadSource = fs.readFileSync(preload, "utf8");
  const mainSource = fs.readFileSync(main, "utf8");

  expect(first.preload[0].changed).toBe(true);
  expect(first.main.changed).toBe(true);
  expect(second.preload[0].changed).toBe(false);
  expect(second.main.changed).toBe(false);
  expect(preloadSource).toContain(first.marker);
  expect(preloadSource.match(/__claudeCoworkZhPatch_BLOCK_START__/g)).toHaveLength(1);
  expect(mainSource).toContain("__claudeCoworkZhPatchMain_");
});

test("requires preload injection but treats missing main hook as warning", () => {
  const { root, buildDir } = tempBuild();
  fs.writeFileSync(path.join(buildDir, "mainWindow.js"), "console.log('preload');", "utf8");
  fs.writeFileSync(path.join(buildDir, "index.js"), "const noHook = true;", "utf8");

  const result = injectBundles({
    appDir: root,
    dict: { Hello: "你好" },
    rules: [],
  });

  expect(result.preload[0].changed).toBe(true);
  expect(result.main.warning).toMatch(/not found/);
});

test("updates an existing patch block when enabling missing collection", () => {
  const { root, buildDir } = tempBuild();
  const preload = path.join(buildDir, "mainView.js");
  const main = path.join(buildDir, "index.js");
  const options = {
    appDir: root,
    dict: { Hello: "浣犲ソ" },
    rules: [],
  };

  fs.writeFileSync(preload, "console.log('preload');", "utf8");
  fs.writeFileSync(main, 'YFn(o.webContents),o.webContents.on("dom-ready",()=>{xJ()});', "utf8");

  const first = injectBundles(options);
  const missingLogFile = path.join(root, "logs", "missing-runtime.log");
  const second = injectBundles({ ...options, collectMissing: true, missingLogFile });

  const preloadSource = fs.readFileSync(preload, "utf8");
  const mainSource = fs.readFileSync(main, "utf8");

  expect(second.marker).toBe(first.marker);
  expect(second.preload[0].changed).toBe(true);
  expect(second.main.changed).toBe(true);
  expect(preloadSource).toContain('"collectMissing":true');
  expect(preloadSource).not.toContain('"collectMissing":false');
  expect(preloadSource.match(/__claudeCoworkZhPatch_BLOCK_START__/g)).toHaveLength(1);
  expect(mainSource).toContain('\\"collectMissing\\":true');
  expect(mainSource).toContain("console-message");
  expect(mainSource).toContain(JSON.stringify(missingLogFile).slice(1, -1));
  expect(mainSource.match(/__claudeCoworkZhPatchMain_/g).length).toBeGreaterThan(0);
  expect(mainSource.match(/const __claudeCoworkZhPatchMain_[a-f0-9]+=\(\)=>/g)).toHaveLength(1);
});

test("removes stale main injections when dictionary fingerprint changes", () => {
  const { root, buildDir } = tempBuild();
  const preload = path.join(buildDir, "mainView.js");
  const main = path.join(buildDir, "index.js");

  fs.writeFileSync(preload, "console.log('preload');", "utf8");
  fs.writeFileSync(main, 'YFn(o.webContents),o.webContents.on("dom-ready",()=>{xJ()});', "utf8");

  const first = injectBundles({
    appDir: root,
    dict: { Hello: "你好" },
    rules: [],
  });
  const second = injectBundles({
    appDir: root,
    dict: { Hello: "你好", Save: "保存" },
    rules: [],
  });

  const mainSource = fs.readFileSync(main, "utf8");
  const firstMainMarker = first.marker.replace("__claudeCoworkZhPatch_", "__claudeCoworkZhPatchMain_");
  const secondMainMarker = second.marker.replace("__claudeCoworkZhPatch_", "__claudeCoworkZhPatchMain_");

  expect(second.marker).not.toBe(first.marker);
  expect(mainSource).not.toContain(firstMainMarker);
  expect(mainSource).toContain(secondMainMarker);
  expect(mainSource.match(/const __claudeCoworkZhPatchMain_[a-f0-9]+=\(\)=>/g)).toHaveLength(1);
});

test("throws when no preload bundle exists", () => {
  const { root } = tempBuild();

  expect(() => injectBundles({ appDir: root, dict: {}, rules: [] })).toThrow(/preload/);
});
