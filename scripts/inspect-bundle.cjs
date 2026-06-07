const fs = require("fs");
const os = require("os");
const path = require("path");
const asarOps = require("../src/core/asar");
const { locateClaude } = require("../src/core/locate");
const { findMainHooks } = require("../src/inject/locate-hooks");

const appDirArg = process.argv[2];
const keepTemp = process.argv.includes("--keep");
const maxScanBytes = 32 * 1024 * 1024;

function rel(root, file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function readText(file) {
  const stat = fs.statSync(file);
  if (stat.size > maxScanBytes) return null;
  return fs.readFileSync(file, "utf8");
}

function containsAny(source, needles) {
  return needles.some((needle) => source.includes(needle));
}

function fileSummary(root, file) {
  const stat = fs.statSync(file);
  return {
    path: rel(root, file),
    size: stat.size,
  };
}

function likelyPreload(source, name) {
  const base = path.basename(name);
  if (/^main(View|Window)\.js$/i.test(base)) return true;
  if (!containsAny(source, ["document", "window", "MutationObserver", "addEventListener"])) return false;
  return !source.includes(".webContents");
}

function inspect(extractedDir) {
  const buildDir = path.join(extractedDir, ".vite", "build");
  const buildDirExists = fs.existsSync(buildDir);
  const jsFiles = walk(extractedDir).filter((file) => path.extname(file).toLowerCase() === ".js");
  const buildFiles = buildDirExists
    ? fs.readdirSync(buildDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => fileSummary(extractedDir, path.join(buildDir, entry.name)))
        .sort((a, b) => a.path.localeCompare(b.path))
    : [];

  const expected = ["mainView.js", "mainWindow.js", "index.js"].map((name) => ({
    name,
    exists: fs.existsSync(path.join(buildDir, name)),
  }));

  const mainCandidates = [];
  const preloadCandidates = [];
  const skippedFiles = [];

  for (const file of jsFiles) {
    const text = readText(file);
    if (text === null) {
      skippedFiles.push(fileSummary(extractedDir, file));
      continue;
    }

    const hooks = findMainHooks(text);
    if (text.includes("webContents") || text.includes("dom-ready") || hooks.length > 0) {
      mainCandidates.push({
        ...fileSummary(extractedDir, file),
        hasWebContents: text.includes("webContents"),
        hasDomReady: text.includes("dom-ready"),
        hookCount: hooks.length,
        hooks: hooks.slice(0, 10).map((hook) => ({
          varName: hook.varName,
          anchors: hook.anchors,
        })),
      });
    }

    if (likelyPreload(text, file)) {
      preloadCandidates.push({
        ...fileSummary(extractedDir, file),
        currentPriorityName: /main(View|Window)\.js$/i.test(path.basename(file)),
        hasDocument: text.includes("document"),
        hasWindow: text.includes("window"),
        hasMutationObserver: text.includes("MutationObserver"),
      });
    }
  }

  mainCandidates.sort((a, b) => b.hookCount - a.hookCount || a.path.localeCompare(b.path));
  preloadCandidates.sort((a, b) => Number(b.currentPriorityName) - Number(a.currentPriorityName) || a.path.localeCompare(b.path));

  return {
    buildDir: buildDirExists ? rel(extractedDir, buildDir) : null,
    buildDirExists,
    buildFiles,
    expected,
    jsFileCount: jsFiles.length,
    skippedFiles,
    preloadCandidates: preloadCandidates.slice(0, 20),
    mainCandidates: mainCandidates.slice(0, 20),
  };
}

function printReport(app, tempDir, report) {
  console.log("Claude bundle inspection report");
  console.log(`appDir: ${app.appDir}`);
  console.log(`asarPath: ${app.asarPath}`);
  console.log(`version: ${app.version || "unknown"}`);
  console.log(`bundleFingerprint: ${app.bundleFingerprint}`);
  console.log(`tempDir: ${tempDir}`);
  console.log("");

  console.log(`buildDir: ${report.buildDir || "not found"}`);
  console.log(`jsFileCount: ${report.jsFileCount}`);
  console.log(`skippedTooLarge: ${report.skippedFiles.length}`);
  console.log("expected files:");
  for (const item of report.expected) {
    console.log(`- ${item.name}: ${item.exists ? "yes" : "no"}`);
  }

  console.log("");
  console.log("build files:");
  if (report.buildFiles.length === 0) {
    console.log("- none");
  } else {
    for (const item of report.buildFiles) {
      console.log(`- ${item.path} (${item.size} bytes)`);
    }
  }

  console.log("");
  console.log("main candidates:");
  if (report.mainCandidates.length === 0) {
    console.log("- none");
  } else {
    for (const item of report.mainCandidates) {
      const hooks = item.hooks.map((hook) => `${hook.varName}[${hook.anchors.join(",")}]`).join("; ") || "none";
      console.log(`- ${item.path} (${item.size} bytes), webContents=${item.hasWebContents}, dom-ready=${item.hasDomReady}, hooks=${item.hookCount}: ${hooks}`);
    }
  }

  console.log("");
  console.log("preload candidates:");
  if (report.preloadCandidates.length === 0) {
    console.log("- none");
  } else {
    for (const item of report.preloadCandidates) {
      console.log(`- ${item.path} (${item.size} bytes), priorityName=${item.currentPriorityName}, document=${item.hasDocument}, window=${item.hasWindow}, MutationObserver=${item.hasMutationObserver}`);
    }
  }

  const expectedMap = Object.fromEntries(report.expected.map((item) => [item.name, item.exists]));
  const currentPreloadOk = Boolean(expectedMap["mainView.js"] || expectedMap["mainWindow.js"]);
  const currentMainOk = Boolean(expectedMap["index.js"] && report.mainCandidates.some((item) => item.path === ".vite/build/index.js" && item.hookCount > 0));

  console.log("");
  console.log("verdict:");
  console.log(`- buildDir .vite/build: ${report.buildDirExists ? "ok" : "needs adaptation"}`);
  console.log(`- current preload names: ${currentPreloadOk ? "ok" : "needs adaptation"}`);
  console.log(`- current main hook in index.js: ${currentMainOk ? "ok" : "warn-only or needs adaptation"}`);
}

let tempDir = null;

try {
  const app = locateClaude({ explicitDir: appDirArg });
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-cowork-bundle-inspect-"));
  asarOps.extract(app.asarPath, tempDir);
  const report = inspect(tempDir);
  printReport(app, tempDir, report);
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
} finally {
  if (tempDir && !keepTemp) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
