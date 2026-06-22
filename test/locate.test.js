const fs = require("fs");
const os = require("os");
const path = require("path");
const asarOps = require("../src/core/asar");
const { appInfo, locateClaude } = require("../src/core/locate");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function createClaudeApp(appDir, options = {}) {
  const resources = path.join(appDir, "resources");
  const asarSrc = path.join(path.dirname(appDir), `asar-src-${path.basename(appDir)}`);
  fs.mkdirSync(resources, { recursive: true });
  fs.mkdirSync(asarSrc, { recursive: true });
  fs.writeFileSync(path.join(appDir, "Claude.exe"), "fake exe", "ascii");
  fs.writeFileSync(path.join(asarSrc, "package.json"), JSON.stringify({ version: options.asarVersion || "9.9.9" }), "utf8");
  await asarOps.pack(asarSrc, path.join(resources, "app.asar"));

  if (options.packageVersion) {
    const unpackedApp = path.join(resources, "app");
    fs.mkdirSync(unpackedApp, { recursive: true });
    fs.writeFileSync(path.join(unpackedApp, "package.json"), JSON.stringify({ version: options.packageVersion }), "utf8");
  }
}

function quietOptions(extra = {}) {
  return {
    env: {},
    localAppData: null,
    processPaths: [],
    appxInstallLocations: [],
    registryInstallLocations: [],
    windowsAppsRoot: null,
    ...extra,
  };
}

test("locates explicit app dir and reads package version outside WindowsApps", async () => {
  const root = tempDir("claude-zh-locate-explicit-");
  const appDir = path.join(root, "Claude", "app");
  await createClaudeApp(appDir, { packageVersion: "2.3.4" });

  const info = locateClaude(quietOptions({ explicitDir: appDir }));

  expect(info.appDir).toBe(path.resolve(appDir));
  expect(info.version).toBe("2.3.4");
  expect(info.bundleFingerprint).toMatch(/^[a-f0-9]{16}$/);
});

test("COWORK_ZH_APP_DIR is the manual fallback after explicit dir", async () => {
  const root = tempDir("claude-zh-locate-env-");
  const appDir = path.join(root, "ManualClaude");
  await createClaudeApp(appDir, { packageVersion: "3.4.5" });

  const info = locateClaude(quietOptions({ env: { COWORK_ZH_APP_DIR: appDir } }));

  expect(info.appDir).toBe(path.resolve(appDir));
  expect(info.version).toBe("3.4.5");
});

test("WindowsApps lookup accepts any publisher suffix", async () => {
  const root = tempDir("claude-zh-locate-windowsapps-");
  const appDir = path.join(root, "Claude_1.2.3.0_x64__abc123xyz", "app");
  await createClaudeApp(appDir);

  const info = locateClaude(quietOptions({ windowsAppsRoot: root }));

  expect(info.appDir).toBe(path.resolve(appDir));
  expect(info.version).toBe("1.2.3.0");
});

test("AppxPackage lookup accepts Windows Store install root", async () => {
  const root = tempDir("claude-zh-locate-appx-");
  const installRoot = path.join(root, "Claude_1.11847.5.0_x64__pzs8sxrjxfjjc");
  const appDir = path.join(installRoot, "app");
  await createClaudeApp(appDir);

  const info = locateClaude(quietOptions({ appxInstallLocations: [installRoot] }));

  expect(info.appDir).toBe(path.resolve(appDir));
  expect(info.version).toBe("1.11847.5.0");
});

test("command timeout can be configured for slow Windows lookup commands", () => {
  const calls = [];

  expect(() =>
    locateClaude({
      ...quietOptions({
        processPaths: null,
        appxInstallLocations: null,
      }),
      platform: "win32",
      commandTimeoutMs: 22000,
      execFileSync(command, args, options) {
        calls.push({ command, args, timeout: options.timeout });
        throw new Error("simulated timeout");
      },
    })
  ).toThrow(/Cannot find Claude Desktop installation/);

  expect(calls.length).toBeGreaterThan(0);
  expect(calls.every((entry) => entry.timeout === 22000)).toBe(true);
});

test("LOCALAPPDATA Programs lookup finds non-Store installs", async () => {
  const root = tempDir("claude-zh-locate-programs-");
  const appDir = path.join(root, "Programs", "Claude", "app");
  await createClaudeApp(appDir, { packageVersion: "4.5.6" });

  const info = locateClaude(quietOptions({ localAppData: root }));

  expect(info.appDir).toBe(path.resolve(appDir));
  expect(info.version).toBe("4.5.6");
});

test("running process lookup derives app dir from Claude.exe path", async () => {
  const root = tempDir("claude-zh-locate-process-");
  const appDir = path.join(root, "ClaudeProcess");
  await createClaudeApp(appDir, { packageVersion: "5.6.7" });

  const info = locateClaude(quietOptions({ processPaths: [path.join(appDir, "Claude.exe")] }));

  expect(info.appDir).toBe(path.resolve(appDir));
  expect(info.version).toBe("5.6.7");
});

test("registry lookup accepts InstallLocation pointing at install root", async () => {
  const root = tempDir("claude-zh-locate-registry-");
  const installRoot = path.join(root, "AnthropicClaude");
  const appDir = path.join(installRoot, "app");
  await createClaudeApp(appDir, { packageVersion: "6.7.8" });

  const info = locateClaude(quietOptions({ registryInstallLocations: [installRoot] }));

  expect(info.appDir).toBe(path.resolve(appDir));
  expect(info.version).toBe("6.7.8");
});

test("failure includes strategy errors and attempted candidates", () => {
  const root = tempDir("claude-zh-locate-fail-");

  expect(() =>
    locateClaude(
      quietOptions({
        env: { COWORK_ZH_APP_DIR: path.join(root, "missing-env") },
        explicitDir: path.join(root, "missing-explicit"),
        windowsAppsRoot: path.join(root, "missing-windowsapps"),
        localAppData: root,
      })
    )
  ).toThrow(/Cannot find Claude Desktop installation/);

  try {
    locateClaude(
      quietOptions({
        env: { COWORK_ZH_APP_DIR: path.join(root, "missing-env") },
        explicitDir: path.join(root, "missing-explicit"),
        windowsAppsRoot: path.join(root, "missing-windowsapps"),
        localAppData: root,
      })
    );
  } catch (error) {
    expect(error.errors.length).toBeGreaterThan(0);
    expect(error.attempted.map((entry) => entry.strategy)).toEqual(expect.arrayContaining(["explicitDir", "COWORK_ZH_APP_DIR"]));
  }
});

test("appInfo falls back to package.json inside app.asar for version", async () => {
  const root = tempDir("claude-zh-locate-asar-version-");
  const appDir = path.join(root, "ClaudePortable");
  await createClaudeApp(appDir, { asarVersion: "7.8.9" });

  expect(appInfo(appDir).version).toBe("7.8.9");
});
