const fs = require("fs");
const path = require("path");
const { defaultDir, loadDictionary } = require("./dictionary");
const { translate } = require("./engine");

const defaultMissingFile = path.resolve(__dirname, "..", "..", "translations", "_missing.json");

function normalizeMissingFile(parsed) {
  if (Array.isArray(parsed)) {
    return parsed.map((entry) => ({
      text: typeof entry === "string" ? entry : entry.text,
      count: typeof entry === "string" ? 1 : Number(entry.count || 1),
    }));
  }

  if (parsed && typeof parsed === "object") {
    return Object.entries(parsed).map(([text, count]) => ({ text, count: Number(count || 1) }));
  }

  return [];
}

function readMissing(missingFile = defaultMissingFile) {
  if (!fs.existsSync(missingFile)) return [];
  return normalizeMissingFile(JSON.parse(fs.readFileSync(missingFile, "utf8"))).filter((entry) => entry.text);
}

function report(options = {}) {
  const dir = options.dir || defaultDir;
  const missingFile = options.missingFile || defaultMissingFile;
  const dictionary = loadDictionary({ source: dir });
  const missing = readMissing(missingFile);
  const uncovered = missing.filter((entry) => translate(entry.text, dictionary) === entry.text);
  const coveredMissing = missing.length - uncovered.length;
  const coverageEstimate = missing.length === 0 ? 1 : coveredMissing / missing.length;
  const result = {
    dictEntries: Object.keys(dictionary.dict).length,
    rules: dictionary.rules.length,
    missingEntries: missing.length,
    uncoveredMissing: uncovered.length,
    coverageEstimate,
  };

  if (options.print !== false) {
    console.log(`Dictionary entries: ${result.dictEntries}`);
    console.log(`Regex rules: ${result.rules}`);
    console.log(`Missing entries: ${result.missingEntries}`);
    console.log(`Uncovered missing entries: ${result.uncoveredMissing}`);
    console.log(`Coverage estimate: ${(coverageEstimate * 100).toFixed(1)}%`);
  }

  return result;
}

module.exports = {
  defaultMissingFile,
  readMissing,
  report,
};
