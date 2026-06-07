const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadDictionary } = require("../src/translate/dictionary");
const { translate } = require("../src/translate/engine");
const { shouldSkipMissing } = require("../src/translate/missing-filter");

const prefix = "__claudeCoworkZhPatchMissing__";
const root = path.resolve(__dirname, "..");
const defaultLogDir = path.join(process.env.USERPROFILE || os.homedir(), ".claude-cowork-zh-patch", "logs");
const defaultOut = path.join(root, "translations", "_missing.json");

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

const logDir = argValue("--log-dir", defaultLogDir);
const outFile = argValue("--out", defaultOut);

function loadCurrentDictionary() {
  try {
    return loadDictionary();
  } catch {
    return null;
  }
}

function parseMissing(line) {
  const index = line.indexOf(prefix);
  if (index === -1) return null;

  const tail = line
    .slice(index + prefix.length)
    .split(prefix)[0]
    .replace(/^[:\s,"]+/, "")
    .replace(/["\s]+$/, "");
  if (!tail) return null;

  try {
    const parsed = JSON.parse(tail);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed.text === "string") return parsed.text;
  } catch {}

  return tail;
}

const dictionary = loadCurrentDictionary();

function isAlreadyCovered(text) {
  return dictionary ? translate(text, dictionary) !== text : false;
}

function readExisting(file) {
  if (!fs.existsSync(file)) return new Map();
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const entries = Array.isArray(parsed) ? parsed.map((item) => [item.text, item.count || 1]) : Object.entries(parsed);
  return new Map(
    entries
      .filter(([text]) => text && !shouldSkipMissing(text) && !isAlreadyCovered(text))
      .map(([text, count]) => [text, Number(count || 1)])
  );
}

if (!fs.existsSync(logDir)) {
  console.log(`Log directory not found, nothing collected: ${logDir}`);
  process.exit(0);
}

const counts = readExisting(outFile);
const logs = fs
  .readdirSync(logDir)
  .filter((name) => name.endsWith(".log"))
  .map((name) => path.join(logDir, name))
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

for (const log of logs) {
  for (const line of fs.readFileSync(log, "utf8").split(/\r?\n/)) {
    const text = parseMissing(line);
    if (!text || shouldSkipMissing(text) || isAlreadyCovered(text)) continue;
    counts.set(text, (counts.get(text) || 0) + 1);
  }
}

const sorted = Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
console.log(`Collected ${Object.keys(sorted).length} missing translations into ${outFile}`);
