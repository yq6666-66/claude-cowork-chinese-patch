const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { defaultDir, validate: validateDictionary } = require("../src/translate/dictionary");

const root = path.resolve(__dirname, "..");
const forbiddenExtensions = new Set([".asar", ".exe", ".bak", ".tmp", ".log"]);
const ignoredDirs = new Set([".git", "node_modules"]);
const scripts = [
  "scripts/patch-asar.cjs",
  "scripts/update-locale.cjs",
  "scripts/patch-exe-hash.cjs",
  "scripts/get-asar-header-hash.cjs",
  "scripts/collect-missing.cjs",
  "scripts/create-backup.cjs",
  "scripts/doctor.cjs",
  "scripts/inspect-bundle.cjs",
  "scripts/locate-doctor.cjs",
  "scripts/resolve-app-dir.cjs",
  "scripts/restore-backup.cjs",
  "scripts/run-install.cjs",
  "scripts/validate-release.cjs",
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const translationPath = path.join(root, "translations", "zh-CN.json");
try {
  const parsed = JSON.parse(fs.readFileSync(translationPath, "utf8"));
  const count = Object.keys(parsed).length;
  if (count < 50) fail(`Translation table looks too small: ${count} entries`);
  else console.log(`Translation table OK: ${count} entries`);

  const dictionaryResult = validateDictionary({ source: defaultDir });
  if (!dictionaryResult.ok) fail(`Split dictionary validation failed: ${JSON.stringify(dictionaryResult.errors)}`);
  else console.log(`Split dictionary OK: ${defaultDir}`);
} catch (error) {
  fail(`Cannot parse translations/zh-CN.json: ${error.message}`);
}

const syntaxTargets = [
  ...scripts.map((script) => path.join(root, script)),
  ...walk(path.join(root, "src")).filter((file) => /\.(cjs|js)$/.test(file)),
];

for (const target of syntaxTargets) {
  const result = spawnSync(process.execPath, ["--check", target], {
    encoding: "utf8",
  });
  const rel = path.relative(root, target).replace(/\\/g, "/");
  if (result.status !== 0) fail(`Syntax check failed for ${rel}\n${result.stderr || result.stdout}`);
  else console.log(`Syntax OK: ${rel}`);
}

const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
for (const required of ["*.asar", "*.exe", "*.bak", "_missing.json", "logs/"]) {
  if (!gitignore.includes(required)) fail(`.gitignore missing required pattern: ${required}`);
}

for (const file of walk(root)) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const ext = path.extname(file).toLowerCase();
  if (forbiddenExtensions.has(ext)) fail(`Forbidden release file: ${rel}`);
}

if (!process.exitCode) console.log("Release validation passed.");
