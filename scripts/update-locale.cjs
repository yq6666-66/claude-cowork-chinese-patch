const fs = require("fs");
const { defaultDir, loadDictionary } = require("../src/translate/dictionary");
const { updateLocaleFile } = require("../src/translate/locale");

const localeFile = process.argv[2];
const translationsPath = process.argv[3] || defaultDir;

if (!localeFile) {
  console.error("Usage: node scripts/update-locale.cjs <locale-json> [translations-json-or-dir]");
  process.exit(1);
}

if (!fs.existsSync(localeFile)) {
  console.log(`Locale file not found, skipped: ${localeFile}`);
  process.exit(0);
}

const dictionary = loadDictionary({ source: translationsPath });
const result = updateLocaleFile(localeFile, dictionary);
console.log(`Updated ${result.changed} locale entries in ${localeFile}`);
