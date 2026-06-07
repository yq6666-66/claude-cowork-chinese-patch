function statementStart(source, index) {
  const semicolon = source.lastIndexOf(";", index - 1);
  const newline = source.lastIndexOf("\n", index - 1);
  return Math.max(semicolon, newline) + 1;
}

function statementEnd(source, index) {
  const semicolon = source.indexOf(";", index);
  return semicolon === -1 ? index : semicolon + 1;
}

function findMainHooks(indexJsSource) {
  const source = String(indexJsSource || "");
  const hooks = [];
  const seen = new Set();
  const pattern = /([A-Za-z_$][\w$]*)\.webContents\.on\(\s*(["'])dom-ready\2\s*,\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\)/g;
  let match;

  while ((match = pattern.exec(source))) {
    const varName = match[1];
    const start = statementStart(source, match.index);
    const end = statementEnd(source, pattern.lastIndex);
    const matchText = source.slice(start, end);
    const key = `${varName}:${start}:${end}`;

    if (seen.has(key)) continue;
    seen.add(key);

    const anchors = [`${varName}.webContents`, "dom-ready"];
    const prefix = matchText.slice(0, Math.max(0, match.index - start));
    if (new RegExp(`${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.webContents\\)`).test(prefix)) {
      anchors.push("webContents-wrapper-call");
    }

    hooks.push({
      index: end,
      matchText,
      varName,
      anchors,
    });
  }

  return hooks;
}

module.exports = {
  findMainHooks,
};
