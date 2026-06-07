const fs = require("fs");
const os = require("os");
const path = require("path");
const asarOps = require("../src/core/asar");
const { computeHeaderHash, knownHashes, writeExeHash } = require("../src/core/integrity");
const { appInfo } = require("../src/core/locate");
const { diagnose } = require("../src/pipeline/doctor");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function createClaudeFixture(root, { marker = "__claudeCoworkZhPatch_abc123def456", exeHash = knownHashes[0] } = {}) {
  const appDir = path.join(root, "Claude_1.2.3.0_x64__pzs8sxrjxfjjc", "app");
  const resources = path.join(appDir, "resources");
  const asarSrc = path.join(root, "asar-src");
  fs.mkdirSync(path.join(asarSrc, ".vite", "build"), { recursive: true });
  fs.mkdirSync(resources, { recursive: true });
  fs.writeFileSync(path.join(asarSrc, ".vite", "build", "mainView.js"), `const marker = "${marker}";`, "utf8");
  await asarOps.pack(asarSrc, path.join(resources, "app.asar"));
  fs.writeFileSync(path.join(appDir, "Claude.exe"), `prefix-${exeHash}-suffix`, "ascii");
  return appDir;
}

test("locates explicit Claude app dir with version and bundle fingerprint", async () => {
  const root = tempDir("claude-zh-locate-");
  const appDir = await createClaudeFixture(root);
  const info = appInfo(appDir);

  expect(info.version).toBe("1.2.3.0");
  expect(info.bundleFingerprint).toMatch(/^[a-f0-9]{16}$/);
});

test("doctor reports healthy when marker and exe hash match", async () => {
  const root = tempDir("claude-zh-doctor-healthy-");
  const stateRoot = path.join(root, "state");
  const appDir = await createClaudeFixture(root);
  const asarPath = path.join(appDir, "resources", "app.asar");
  const exePath = path.join(appDir, "Claude.exe");
  const headerHash = computeHeaderHash(asarPath);
  writeExeHash(exePath, headerHash);
  fs.mkdirSync(stateRoot);
  fs.writeFileSync(
    path.join(stateRoot, "latest.json"),
    JSON.stringify({
      appDir,
      bundleFingerprint: appInfo(appDir).bundleFingerprint,
      patchFingerprint: "abc123def456",
    }),
    "utf8"
  );

  expect(diagnose({ stateRoot }).status).toBe("healthy");
});

test("doctor reports needs-repatch when marker is missing", async () => {
  const root = tempDir("claude-zh-doctor-repatch-");
  const stateRoot = path.join(root, "state");
  const appDir = await createClaudeFixture(root, { marker: "no-current-marker" });
  const asarPath = path.join(appDir, "resources", "app.asar");
  const exePath = path.join(appDir, "Claude.exe");
  writeExeHash(exePath, computeHeaderHash(asarPath));
  fs.mkdirSync(stateRoot);
  fs.writeFileSync(
    path.join(stateRoot, "latest.json"),
    JSON.stringify({
      appDir,
      bundleFingerprint: appInfo(appDir).bundleFingerprint,
      patchFingerprint: "abc123def456",
    }),
    "utf8"
  );

  expect(diagnose({ stateRoot }).status).toBe("needs-repatch");
});

test("doctor reports broken when exe hash does not match asar header", async () => {
  const root = tempDir("claude-zh-doctor-broken-");
  const stateRoot = path.join(root, "state");
  const appDir = await createClaudeFixture(root);
  fs.mkdirSync(stateRoot);
  fs.writeFileSync(
    path.join(stateRoot, "latest.json"),
    JSON.stringify({
      appDir,
      bundleFingerprint: appInfo(appDir).bundleFingerprint,
      patchFingerprint: "abc123def456",
    }),
    "utf8"
  );

  expect(diagnose({ stateRoot }).status).toBe("broken");
});
