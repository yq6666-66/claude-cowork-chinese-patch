const fs = require("fs");
const os = require("os");
const path = require("path");
const asarOps = require("../src/core/asar");
const { restoreFrom } = require("../src/core/backup");
const { computeHeaderHash, knownHashes, readExeHashes } = require("../src/core/integrity");
const { runInstall } = require("../src/pipeline/install");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function nullLogger() {
  return {
    info() {},
    warn() {},
    error() {},
    step() {
      return { ok() {}, warn() {}, fail() {} };
    },
    flush() {},
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createFixture(root) {
  const repoDir = path.join(root, "repo");
  const appDir = path.join(root, "Claude_2.0.0.0_x64__pzs8sxrjxfjjc", "app");
  const resources = path.join(appDir, "resources");
  const asarSrc = path.join(root, "asar-src");
  const buildDir = path.join(asarSrc, ".vite", "build");
  const dictionaryDir = path.join(repoDir, "translations", "zh-CN");

  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(resources, { recursive: true });
  fs.mkdirSync(dictionaryDir, { recursive: true });

  fs.writeFileSync(path.join(buildDir, "mainView.js"), "document.body.textContent='Hello';", "utf8");
  fs.writeFileSync(path.join(buildDir, "index.js"), 'YFn(o.webContents),o.webContents.on("dom-ready",()=>{xJ()});', "utf8");
  fs.writeFileSync(path.join(appDir, "Claude.exe"), `prefix-${knownHashes[0]}-suffix`, "ascii");
  writeJson(path.join(resources, "en-US.json"), { greeting: "Hello" });
  writeJson(path.join(resources, "zh-CN.json"), { greeting: "Hello" });
  fs.mkdirSync(path.join(resources, "ion-dist", "assets", "v1"), { recursive: true });
  fs.writeFileSync(
    path.join(resources, "ion-dist", "index.html"),
    '<!doctype html><script type="module" crossorigin src="/assets/v1/index-test.js"></script>',
    "utf8"
  );
  fs.writeFileSync(path.join(resources, "ion-dist", "assets", "v1", "index-test.js"), "console.log('ion');", "utf8");
  writeJson(path.join(resources, "ion-dist", "i18n", "en-US.json"), { settings: "Open settings" });
  writeJson(path.join(resources, "ion-dist", "i18n", "statsig", "en-US.json"), { chat: "New chat" });
  writeJson(path.join(dictionaryDir, "misc.json"), {
    Hello: "你好",
    "Open settings": "打开设置",
    "New chat": "新聊天",
  });
  writeJson(path.join(dictionaryDir, "rules.json"), []);
  writeJson(path.join(dictionaryDir, "protected.json"), ["Claude", "GitHub", "MCP"]);

  await asarOps.pack(asarSrc, path.join(resources, "app.asar"));

  return {
    appDir,
    repoDir,
    stateRoot: path.join(root, "state"),
    workRoot: path.join(root, "work"),
    exePath: path.join(appDir, "Claude.exe"),
    asarPath: path.join(resources, "app.asar"),
    enLocale: path.join(resources, "en-US.json"),
    zhLocale: path.join(resources, "zh-CN.json"),
    ionEnLocale: path.join(resources, "ion-dist", "i18n", "en-US.json"),
    statsigEnLocale: path.join(resources, "ion-dist", "i18n", "statsig", "en-US.json"),
    ionRuntime: path.join(resources, "ion-dist", "assets", "v1", "index-test.js"),
  };
}

test("runInstall replaces online files only after temp self-check succeeds", async () => {
  const fixture = await createFixture(tempDir("claude-zh-install-ok-"));

  const result = await runInstall({
    appDir: fixture.appDir,
    repoDir: fixture.repoDir,
    stateRoot: fixture.stateRoot,
    workRoot: fixture.workRoot,
    logger: nullLogger(),
    runId: "ok",
    forceUnsafeAsar: true,
  });

  expect(result.ok).toBe(true);
  expect(fs.existsSync(result.latestPath)).toBe(true);
  expect(JSON.parse(fs.readFileSync(fixture.enLocale, "utf8"))).toEqual({ greeting: "你好" });
  expect(readExeHashes(fixture.exePath).some((entry) => entry.hash === result.asarHeaderHash)).toBe(true);

  expect(asarOps.archiveContainsText(fixture.asarPath, result.marker, [".vite/build/mainView.js"])).toBe(true);
});

test("runInstall defaults to workspace-safe locale patch without touching exe or asar", async () => {
  const fixture = await createFixture(tempDir("claude-zh-install-safe-"));
  const beforeAsar = fs.readFileSync(fixture.asarPath);
  const beforeExe = fs.readFileSync(fixture.exePath);

  const result = await runInstall({
    appDir: fixture.appDir,
    repoDir: fixture.repoDir,
    stateRoot: fixture.stateRoot,
    workRoot: fixture.workRoot,
    logger: nullLogger(),
    runId: "safe",
  });

  const latest = JSON.parse(fs.readFileSync(result.latestPath, "utf8"));
  expect(result.mode).toBe("safe");
  expect(latest.mode).toBe("safe");
  expect(latest.workspaceSafe).toBe(true);
  expect(fs.readFileSync(fixture.asarPath)).toEqual(beforeAsar);
  expect(fs.readFileSync(fixture.exePath)).toEqual(beforeExe);
  expect(JSON.parse(fs.readFileSync(fixture.enLocale, "utf8"))).toEqual({ greeting: "你好" });
  expect(JSON.parse(fs.readFileSync(fixture.ionEnLocale, "utf8"))).toEqual({ settings: "打开设置" });
  expect(JSON.parse(fs.readFileSync(fixture.statsigEnLocale, "utf8"))).toEqual({ chat: "新聊天" });
  expect(fs.readFileSync(fixture.ionRuntime, "utf8")).toBe("console.log('ion');");
  expect(latest.files.locales.map((entry) => entry.id)).toEqual([
    "desktop.en-US",
    "desktop.zh-CN",
    "ion.en-US",
    "statsig.en-US",
  ]);
  expect(latest.files.externalRuntime).toEqual([]);
  expect(asarOps.archiveContainsText(fixture.asarPath, "__claudeCoworkZhPatch_", [".vite/build/mainView.js"])).toBe(false);
});

test.each(["pack", "self-check"])("runInstall restores online files when %s fails", async (failAt) => {
  const fixture = await createFixture(tempDir(`claude-zh-install-${failAt}-`));
  const beforeAsar = fs.readFileSync(fixture.asarPath);
  const beforeExe = fs.readFileSync(fixture.exePath);
  const beforeLocale = fs.readFileSync(fixture.enLocale, "utf8");

  let thrown;
  try {
    await runInstall({
      appDir: fixture.appDir,
      repoDir: fixture.repoDir,
      stateRoot: fixture.stateRoot,
      workRoot: fixture.workRoot,
      logger: nullLogger(),
      runId: failAt,
      failAt,
      forceUnsafeAsar: true,
    });
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeTruthy();
  expect(thrown.restoreResult).toBeTruthy();
  expect(fs.readFileSync(fixture.asarPath)).toEqual(beforeAsar);
  expect(fs.readFileSync(fixture.exePath)).toEqual(beforeExe);
  expect(fs.readFileSync(fixture.enLocale, "utf8")).toBe(beforeLocale);
});

test("runInstall reuses the original backup when installing over an existing patch", async () => {
  const fixture = await createFixture(tempDir("claude-zh-install-idempotent-"));
  const originalAsar = fs.readFileSync(fixture.asarPath);

  const first = await runInstall({
    appDir: fixture.appDir,
    repoDir: fixture.repoDir,
    stateRoot: fixture.stateRoot,
    workRoot: fixture.workRoot,
    logger: nullLogger(),
    runId: "first",
    forceUnsafeAsar: true,
  });
  const firstLatest = JSON.parse(fs.readFileSync(first.latestPath, "utf8"));

  const second = await runInstall({
    appDir: fixture.appDir,
    repoDir: fixture.repoDir,
    stateRoot: fixture.stateRoot,
    workRoot: fixture.workRoot,
    logger: nullLogger(),
    runId: "second",
    forceUnsafeAsar: true,
  });
  const secondLatest = JSON.parse(fs.readFileSync(second.latestPath, "utf8"));

  expect(second.backupDir).toBe(first.backupDir);
  expect(secondLatest.backup).toBe(firstLatest.backup);
  expect(fs.existsSync(path.join(fixture.stateRoot, "backups", "second"))).toBe(false);

  restoreFrom(secondLatest.backup);
  expect(fs.readFileSync(fixture.asarPath)).toEqual(originalAsar);
  expect(asarOps.archiveContainsText(fixture.asarPath, second.marker, [".vite/build/mainView.js"])).toBe(false);
});

test("runInstall recovers when ASAR changed but exe still has previous patch hash", async () => {
  const root = tempDir("claude-zh-install-half-updated-");
  const fixture = await createFixture(root);

  const first = await runInstall({
    appDir: fixture.appDir,
    repoDir: fixture.repoDir,
    stateRoot: fixture.stateRoot,
    workRoot: fixture.workRoot,
    logger: nullLogger(),
    runId: "first",
    forceUnsafeAsar: true,
  });
  const firstHeaderHash = first.asarHeaderHash;

  const edited = path.join(root, "edited-asar");
  asarOps.extract(fixture.asarPath, edited);
  fs.appendFileSync(path.join(edited, ".vite", "build", "mainView.js"), "\n// half-updated-content", "utf8");
  await asarOps.pack(edited, fixture.asarPath);

  expect(computeHeaderHash(fixture.asarPath)).not.toBe(firstHeaderHash);
  expect(readExeHashes(fixture.exePath).some((entry) => entry.hash === firstHeaderHash)).toBe(true);

  const recovered = await runInstall({
    appDir: fixture.appDir,
    repoDir: fixture.repoDir,
    stateRoot: fixture.stateRoot,
    workRoot: fixture.workRoot,
    logger: nullLogger(),
    runId: "recover",
    forceUnsafeAsar: true,
  });

  expect(recovered.backupDir).toBe(first.backupDir);
  expect(readExeHashes(fixture.exePath).some((entry) => entry.hash === recovered.asarHeaderHash)).toBe(true);
});
