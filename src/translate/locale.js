const fs = require("fs");
const { translate } = require("./engine");

function visit(value, dictionary, counter) {
  if (typeof value === "string") {
    const next = translate(value, dictionary);
    if (next !== value) counter.changed += 1;
    return next;
  }

  if (Array.isArray(value)) return value.map((item) => visit(item, dictionary, counter));

  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) value[key] = visit(value[key], dictionary, counter);
  }

  return value;
}

function updateLocaleFile(localeFile, dictionary) {
  if (!fs.existsSync(localeFile)) {
    return { file: localeFile, skipped: true, changed: 0 };
  }

  const locale = JSON.parse(fs.readFileSync(localeFile, "utf8"));
  const counter = { changed: 0 };
  visit(locale, dictionary, counter);
  fs.writeFileSync(localeFile, `${JSON.stringify(locale, null, 2)}\n`, "utf8");
  return { file: localeFile, skipped: false, changed: counter.changed };
}

module.exports = {
  updateLocaleFile,
};
