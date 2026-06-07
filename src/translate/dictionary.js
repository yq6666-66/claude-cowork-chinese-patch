const fs = require("fs");
const path = require("path");
const { DEFAULT_PROTECTED_WORDS } = require("./engine");

const root = path.resolve(__dirname, "..", "..");
const defaultDir = path.join(root, "translations", "zh-CN");
const legacyFile = path.join(root, "translations", "zh-CN.json");
const metaFiles = new Set(["protected.json", "rules.json", "schema.json"]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function resolveSource(source) {
  if (!source) return fs.existsSync(defaultDir) ? defaultDir : legacyFile;
  return path.resolve(source);
}

function isDirectory(source) {
  return fs.existsSync(source) && fs.statSync(source).isDirectory();
}

function dictionaryFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json") && !metaFiles.has(name))
    .sort()
    .map((name) => path.join(dir, name));
}

function loadRules(dir) {
  const rulesPath = path.join(dir, "rules.json");
  if (!fs.existsSync(rulesPath)) return [];
  return readJson(rulesPath)
    .slice()
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
}

function loadProtectedWords(dir) {
  const protectedPath = path.join(dir, "protected.json");
  if (!fs.existsSync(protectedPath)) return DEFAULT_PROTECTED_WORDS;
  return readJson(protectedPath);
}

function mergeDictionary(files) {
  const dict = {};
  const sources = {};
  const warnings = [];
  const errors = [];

  for (const file of files) {
    const parsed = readJson(file);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.push({ file, reason: "dictionary-file-must-be-object" });
      continue;
    }

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string" || value.length === 0) {
        errors.push({ file, key, reason: "translation-must-be-non-empty-string" });
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(dict, key)) {
        if (dict[key] !== value) {
          errors.push({
            file,
            key,
            reason: "conflicting-translation",
            previousFile: sources[key],
          });
        } else {
          warnings.push({
            file,
            key,
            reason: "duplicate-identical-translation",
            previousFile: sources[key],
          });
        }
        continue;
      }

      dict[key] = value;
      sources[key] = file;
    }
  }

  return { dict, sources, warnings, errors };
}

function validateRules(rules, file) {
  const errors = [];
  for (const [index, rule] of rules.entries()) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      errors.push({ file, index, reason: "rule-must-be-object" });
      continue;
    }
    if (typeof rule.pattern !== "string" || !rule.pattern) {
      errors.push({ file, index, reason: "rule-pattern-required" });
      continue;
    }
    if (typeof rule.replace !== "string") {
      errors.push({ file, index, reason: "rule-replace-required" });
    }
    try {
      new RegExp(rule.pattern);
    } catch (error) {
      errors.push({ file, index, reason: "invalid-regexp", message: error.message });
    }
  }
  return errors;
}

function validateProtected(words, file) {
  if (!Array.isArray(words)) return [{ file, reason: "protected-words-must-be-array" }];
  return words.flatMap((word, index) =>
    typeof word === "string" && word.length > 0 ? [] : [{ file, index, reason: "protected-word-must-be-string" }]
  );
}

function loadDictionary(options = {}) {
  const source = resolveSource(options.source || options.dir || options.file);

  if (!fs.existsSync(source)) {
    throw new Error(`Dictionary source not found: ${source}`);
  }

  if (!isDirectory(source)) {
    const parsed = readJson(source);
    return {
      dict: parsed,
      rules: [],
      protectedWords: DEFAULT_PROTECTED_WORDS,
      sources: Object.fromEntries(Object.keys(parsed).map((key) => [key, source])),
      warnings: [],
      source,
    };
  }

  const files = dictionaryFiles(source);
  const merged = mergeDictionary(files);
  if (merged.errors.length > 0) {
    const error = new Error(`Dictionary validation failed: ${JSON.stringify(merged.errors)}`);
    error.errors = merged.errors;
    throw error;
  }

  return {
    dict: merged.dict,
    rules: loadRules(source),
    protectedWords: loadProtectedWords(source),
    sources: merged.sources,
    warnings: merged.warnings,
    source,
  };
}

function validate(options = {}) {
  const source = resolveSource(options.source || options.dir || options.file);
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(source)) {
    return { ok: false, errors: [{ file: source, reason: "source-not-found" }], warnings };
  }

  if (!isDirectory(source)) {
    const parsed = readJson(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.push({ file: source, reason: "dictionary-file-must-be-object" });
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  const merged = mergeDictionary(dictionaryFiles(source));
  errors.push(...merged.errors);
  warnings.push(...merged.warnings);

  const rulesPath = path.join(source, "rules.json");
  if (fs.existsSync(rulesPath)) errors.push(...validateRules(readJson(rulesPath), rulesPath));

  const protectedPath = path.join(source, "protected.json");
  if (fs.existsSync(protectedPath)) errors.push(...validateProtected(readJson(protectedPath), protectedPath));

  return { ok: errors.length === 0, errors, warnings };
}

module.exports = {
  defaultDir,
  legacyFile,
  loadDictionary,
  validate,
};
