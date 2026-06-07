const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { findMainHooks } = require("./locate-hooks");
const { buildRuntimeScript } = require("./runtime-translator");

const PATCH_BLOCK_START = "/* __claudeCoworkZhPatch_BLOCK_START__ */";
const PATCH_BLOCK_END = "/* __claudeCoworkZhPatch_BLOCK_END__ */";

function fingerprintPayload({ dict = {}, rules = [] }) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ dict, rules }))
    .digest("hex")
    .slice(0, 12);
}

function stripPatchBlocks(source) {
  const pattern = new RegExp(`${escapeRegExp(PATCH_BLOCK_START)}[\\s\\S]*?${escapeRegExp(PATCH_BLOCK_END)}\\s*`, "g");
  return source.replace(pattern, "");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function block(runtimeScript) {
  return `\n${PATCH_BLOCK_START}\n${runtimeScript}\n${PATCH_BLOCK_END}\n`;
}

function findPreloadTargets(buildDir) {
  return [
    path.join(buildDir, "mainView.js"),
    path.join(buildDir, "mainWindow.js"),
  ].filter((file) => fs.existsSync(file));
}

function injectPreload(target, runtimeScript, marker) {
  const original = fs.readFileSync(target, "utf8");
  if (original.includes(marker) && !original.includes(PATCH_BLOCK_START)) return { file: target, changed: false };

  const next = `${stripPatchBlocks(original).trimEnd()}${block(runtimeScript)}`;
  if (next === original) return { file: target, changed: false };
  fs.writeFileSync(target, next, "utf8");
  return { file: target, changed: true };
}

function stripMainInjection(source, mainMarker) {
  const escaped = mainMarker ? escapeRegExp(mainMarker) : "__claudeCoworkZhPatchMain_[A-Za-z0-9_]+";
  const pattern = new RegExp(`;const (${escaped})=\\(\\)=>\\{[\\s\\S]*?\\};[\\s\\S]*?;\\1\\(\\);`, "g");
  return source.replace(pattern, "");
}

function buildConsoleCapture({ webContents, mainMarker, missingLogFile }) {
  if (!missingLogFile) return "";

  const flag = `${mainMarker}_console`;
  const prefix = "__claudeCoworkZhPatchMissing__";
  return [
    `;try{`,
    `const ${mainMarker}Fs=require("fs"),${mainMarker}Path=require("path"),${mainMarker}LogFile=${JSON.stringify(missingLogFile)},${mainMarker}Prefix=${JSON.stringify(prefix)};`,
    `const ${mainMarker}Log=(...A)=>{try{const M=A.find(V=>typeof V==="string"&&V.includes(${mainMarker}Prefix));if(!M)return;${mainMarker}Fs.mkdirSync(${mainMarker}Path.dirname(${mainMarker}LogFile),{recursive:!0});${mainMarker}Fs.appendFileSync(${mainMarker}LogFile,M+"\\n")}catch{}};`,
    `if(!${webContents}[${JSON.stringify(flag)}]){Object.defineProperty(${webContents},${JSON.stringify(flag)},{value:!0});${webContents}.on("console-message",${mainMarker}Log)}`,
    `}catch{}`,
  ].join("");
}

function injectMain(target, runtimeScript, marker, options = {}) {
  const original = fs.readFileSync(target, "utf8");
  const mainMarker = marker.replace("__claudeCoworkZhPatch_", "__claudeCoworkZhPatchMain_");
  const source = stripMainInjection(original);
  const hooks = findMainHooks(source);
  if (hooks.length === 0) {
    return { file: target, changed: false, hooks, warning: "main-process injection point not found" };
  }

  const hook = hooks[0];
  const webContents = `${hook.varName}.webContents`;
  const injection = [
    `;const ${mainMarker}=()=>{`,
    `${webContents}.executeJavaScript(${JSON.stringify(runtimeScript)},!0).catch(()=>{})`,
    `};`,
    buildConsoleCapture({ webContents, mainMarker, missingLogFile: options.missingLogFile }),
    `${webContents}.on("did-finish-load",${mainMarker});`,
    `${mainMarker}();`,
  ].join("");

  const next = `${source.slice(0, hook.index)}${injection}${source.slice(hook.index)}`;
  if (next === original) return { file: target, changed: false, hooks };
  fs.writeFileSync(target, next, "utf8");
  return { file: target, changed: true, hooks };
}

function injectBundles(options = {}) {
  const appDir = options.appDir;
  const buildDir = options.buildDir || (appDir ? path.join(appDir, ".vite", "build") : null);
  if (!buildDir) throw new Error("injectBundles requires appDir or buildDir.");

  const mainIndex = options.mainIndex || path.join(buildDir, "index.js");
  const preloadTargets = options.preloadTargets || findPreloadTargets(buildDir);
  if (preloadTargets.length === 0) {
    throw new Error(`Cannot find Claude preload bundles under: ${buildDir}`);
  }

  const fingerprint = options.fingerprint || fingerprintPayload(options);
  const marker = options.marker || `__claudeCoworkZhPatch_${fingerprint}`;
  const runtimeScript =
    options.runtimeScript ||
    buildRuntimeScript({
      dict: options.dict || {},
      rules: options.rules || [],
      protectedWords: options.protectedWords,
      marker,
      collectMissing: options.collectMissing,
    });

  const preload = preloadTargets.map((target) => injectPreload(target, runtimeScript, marker));
  let main = { file: mainIndex, changed: false, hooks: [], warning: "main bundle not found" };

  if (fs.existsSync(mainIndex)) {
    main = injectMain(mainIndex, runtimeScript, marker, {
      missingLogFile: options.collectMissing ? options.missingLogFile : null,
    });
  }

  if (main.warning && options.logger && typeof options.logger.warn === "function") {
    options.logger.warn(main.warning, { file: main.file });
  }

  return {
    fingerprint,
    marker,
    preload,
    main,
  };
}

module.exports = {
  fingerprintPayload,
  injectBundles,
  injectMain,
  injectPreload,
  stripMainInjection,
  stripPatchBlocks,
};
