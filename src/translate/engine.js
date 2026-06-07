const DEFAULT_PROTECTED_WORDS = [
  "Claude",
  "Opus",
  "Sonnet",
  "Haiku",
  "MCP",
  "API",
  "URL",
  "GitHub",
  "Google",
  "Slack",
  "Notion",
  "Linear",
  "Figma",
  "Chrome",
  "Windows",
  "macOS",
  "BLE",
  "USB",
  "DXT",
  "VM",
  "3P",
];

function normalize(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function restoreSpace(raw, body) {
  const text = String(raw);
  const start = text.match(/^\s*/)?.[0] || "";
  const end = text.match(/\s*$/)?.[0] || "";
  return start + body + end;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function protectedRegExp(protectedWords = DEFAULT_PROTECTED_WORDS) {
  if (protectedWords instanceof RegExp) return protectedWords;
  if (typeof protectedWords === "string") return new RegExp(protectedWords, "g");
  const words = Array.isArray(protectedWords) ? protectedWords : DEFAULT_PROTECTED_WORDS;
  return new RegExp(words.map(escapeRegExp).join("|"), "g");
}

function normalizeRule(rule) {
  if (Array.isArray(rule)) {
    return {
      pattern: rule[0],
      replace: rule[1],
      priority: Number(rule[2] || 0),
    };
  }

  return {
    pattern: rule.pattern,
    replace: rule.replace,
    priority: Number(rule.priority || 0),
  };
}

function compileRules(rules = []) {
  return rules
    .map(normalizeRule)
    .filter((rule) => rule.pattern && rule.replace !== undefined)
    .sort((a, b) => b.priority - a.priority)
    .map((rule) => ({
      regexp: rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern),
      replace: rule.replace,
      priority: rule.priority,
    }));
}

function hasPlaceholder(value) {
  return /\{[^}]+\}|%[sd]|\{\{[^}]+\}\}/.test(value);
}

function replaceFragment(value, from, to) {
  if (/^[A-Za-z0-9_]+$/.test(from)) {
    const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(from)}(?=$|[^A-Za-z0-9_])`, "g");
    return value.replace(pattern, (_match, prefix) => `${prefix}${to}`);
  }

  return value.split(from).join(to);
}

function translateBody(body, ctx = {}) {
  const normalized = normalize(body);
  if (!normalized || !/[A-Za-z]/.test(normalized)) return null;

  const dict = ctx.dict || {};
  if (dict[normalized]) return dict[normalized];

  for (const rule of compileRules(ctx.rules || [])) {
    if (rule.regexp.test(normalized)) {
      return normalized.replace(rule.regexp, rule.replace);
    }
  }

  if (hasPlaceholder(normalized)) return null;

  const minFragmentLen = ctx.minFragmentLen === undefined ? 3 : ctx.minFragmentLen;
  const maxResidualEnglish = ctx.maxResidualEnglish === undefined ? 2 : ctx.maxResidualEnglish;
  const entries = Object.entries(dict).sort((a, b) => b[0].length - a[0].length);
  let replaced = normalized;

  for (const [from, to] of entries) {
    if (from.length < minFragmentLen) continue;
    if (replaced.includes(from)) replaced = replaceFragment(replaced, from, to);
  }

  if (replaced === normalized) return null;

  const remainder = replaced.replace(protectedRegExp(ctx.protectedWords), "");
  const longEnglish = remainder.match(/[A-Za-z]{6,}/g);
  if (!longEnglish || longEnglish.length <= maxResidualEnglish) return replaced;

  return null;
}

function translate(text, ctx = {}) {
  if (!text || !/[A-Za-z]/.test(String(text))) return text;
  const translated = translateBody(text, ctx);
  return translated ? restoreSpace(text, translated) : text;
}

module.exports = {
  DEFAULT_PROTECTED_WORDS,
  compileRules,
  normalize,
  restoreSpace,
  translate,
  translateBody,
};
