const path = require("path");
const { injectBundles } = require("../src/inject/inject-bundle");
const { defaultDir, loadDictionary } = require("../src/translate/dictionary");

const appDir = process.argv[2];
const translationsPath = process.argv[3] || defaultDir;

if (!appDir) {
  console.error("Usage: node scripts/patch-asar.cjs <extracted-app-dir> [translations-json-or-dir]");
  process.exit(1);
}

const buildDir = path.join(appDir, ".vite", "build");
const dictionary = loadDictionary({ source: translationsPath });
const result = injectBundles({
  appDir,
  buildDir,
  dict: dictionary.dict,
  rules: dictionary.rules,
  protectedWords: dictionary.protectedWords,
  collectMissing: process.env.COWORK_ZH_COLLECT === "1" || process.env.CLAUDE_ZH_COLLECT_MISSING === "1",
  logger: {
    warn(message, meta) {
      console.warn(`${message}: ${meta.file}`);
    },
  },
});

for (const target of result.preload) {
  console.log(`${target.changed ? "Appended" : "Found existing"} DOM translator in ${target.file}`);
}

if (result.main.warning) {
  console.warn(`Main-process translator not injected: ${result.main.warning}`);
} else {
  console.log(`${result.main.changed ? "Injected" : "Found existing"} main-process translator in ${result.main.file}`);
}

console.log(`Patch complete (${result.marker})`);
