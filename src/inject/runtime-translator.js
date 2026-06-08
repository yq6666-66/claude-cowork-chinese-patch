const { DEFAULT_PROTECTED_WORDS } = require("../translate/engine");
const { shouldSkipMissing } = require("../translate/missing-filter");

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

function normalizeProtectedWords(protectedWords) {
  if (!protectedWords) return DEFAULT_PROTECTED_WORDS;
  if (Array.isArray(protectedWords)) return protectedWords;
  if (protectedWords instanceof RegExp) return [protectedWords.source];
  return [String(protectedWords)];
}

function buildRuntimeScript({ dict = {}, rules = [], protectedWords, marker } = {}) {
  const payload = {
    dict,
    rules: rules.map(normalizeRule),
    protectedWords: normalizeProtectedWords(protectedWords),
    collectMissing: Boolean(arguments[0] && arguments[0].collectMissing),
  };
  const mark = marker || "__claudeCoworkZhPatch_runtime";
  const shouldSkipMissingSource = shouldSkipMissing.toString();

  return `
;(() => {
  const MARK = ${JSON.stringify(mark)};
  if (window[MARK]) return;
  try { Object.defineProperty(window, MARK, { value: true, configurable: false }); } catch { window[MARK] = true; }

  const payload = ${JSON.stringify(payload)};
  const dict = payload.dict || {};
  const entries = Object.entries(dict).sort((a, b) => b[0].length - a[0].length);
  const rules = (payload.rules || [])
    .slice()
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .map((rule) => [new RegExp(rule.pattern), rule.replace]);
  const attrs = ["placeholder", "title", "aria-label", "alt", "data-tooltip", "data-title", "data-label"];
  const skipSelector = "script,style,code,pre,textarea,kbd,samp,[contenteditable='true'],[data-cowork-zh-no-translate]";
  const userContentSelector = [
    "[data-message-author-role]",
    "[data-testid*='message']",
    "[data-testid*='conversation']",
    "[data-testid*='transcript']",
    "[data-testid*='artifact']",
    "[data-testid*='tool-result']",
    "[class*='markdown']",
    "[class*='Markdown']",
    "[class*='prose']",
    "[class*='Prose']",
    "[class*='message-content']",
    "[class*='MessageContent']",
  ].join(",");
  const interactiveSelector = "button,a,label,summary,select,input,[role='button'],[role='menuitem'],[role='tab'],[role='checkbox'],[role='radio'],[aria-label]";
  const escapeRegExp = (value) => String(value).replace(/[|\\\\{}()[\\]^$+*?.]/g, "\\\\$&");
  const protectedWords = new RegExp((payload.protectedWords || []).map(escapeRegExp).join("|"), "g");
  const translatedNodes = new WeakSet();
  const lastText = new WeakMap();
  const missingTexts = new Set();

  const normalize = (value) => String(value || "").replace(/\\u00a0/g, " ").replace(/\\s+/g, " ").trim();
  const shouldSkipMissing = ${shouldSkipMissingSource};
  const restoreSpace = (raw, body) => {
    const text = String(raw);
    const start = text.match(/^\\s*/)?.[0] || "";
    const end = text.match(/\\s*$/)?.[0] || "";
    return start + body + end;
  };
  const replaceFragment = (value, from, to) => {
    if (/^[A-Za-z0-9_]+$/.test(from)) {
      const pattern = new RegExp("(^|[^A-Za-z0-9_])" + escapeRegExp(from) + "(?=$|[^A-Za-z0-9_])", "g");
      return value.replace(pattern, (_match, prefix) => prefix + to);
    }
    return value.split(from).join(to);
  };

  function translateBody(body) {
    const normalized = normalize(body);
    if (!normalized || !/[A-Za-z]/.test(normalized)) return null;
    if (dict[normalized]) return dict[normalized];
    for (const [rule, target] of rules) {
      if (rule.test(normalized)) return normalized.replace(rule, target);
    }
    if (/\\{[^}]+\\}|%[sd]|\\{\\{[^}]+\\}\\}/.test(normalized)) return null;
    let replaced = normalized;
    for (const [from, to] of entries) {
      if (from.length < 3) continue;
      if (replaced.includes(from)) replaced = replaceFragment(replaced, from, to);
    }
    if (replaced !== normalized) {
      const remainder = replaced.replace(protectedWords, "");
      const longEnglish = remainder.match(/[A-Za-z]{6,}/g);
      if (!longEnglish || longEnglish.length <= 2) return replaced;
    }
    recordMissing(normalized);
    return null;
  }

  function recordMissing(text) {
    if (!payload.collectMissing || missingTexts.has(text) || shouldSkipMissing(text)) return;
    missingTexts.add(text);
    try { console.info("__claudeCoworkZhPatchMissing__", text); } catch {}
  }

  function translate(raw) {
    if (!raw || !/[A-Za-z]/.test(String(raw))) return raw;
    const translated = translateBody(raw);
    return translated ? restoreSpace(raw, translated) : raw;
  }

  function shouldSkipElement(element) {
    if (!element || element.nodeType !== 1) return false;
    if (element.closest(skipSelector)) return true;
    if (element.closest(userContentSelector) && !element.closest(interactiveSelector)) return true;
    return Boolean(element.closest("[role='textbox'], .cm-editor, .monaco-editor"));
  }

  function translateTextNode(node) {
    const parent = node.parentElement;
    if (!parent || shouldSkipElement(parent)) return;
    const original = node.nodeValue;
    if (!original || original.length > 500) return;
    if (translatedNodes.has(node) && lastText.get(node) === original) return;
    const next = translate(original);
    lastText.set(node, next);
    if (next !== original) {
      node.nodeValue = next;
      translatedNodes.add(node);
    }
  }

  function translateElement(element) {
    if (!element || element.nodeType !== 1 || shouldSkipElement(element)) return;
    for (const attr of attrs) {
      if (!element.hasAttribute(attr)) continue;
      const original = element.getAttribute(attr);
      const next = translate(original);
      if (next !== original) element.setAttribute(attr, next);
    }
    if ((element.tagName === "INPUT" || element.tagName === "BUTTON") && /^(button|submit|reset)$/i.test(element.type || "button")) {
      const original = element.value;
      const next = translate(original);
      if (next !== original) element.value = next;
    }
    if (element.shadowRoot) scan(element.shadowRoot);
  }

  function scan(root = document) {
    try {
      if (root.nodeType === 1) translateElement(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
        else translateElement(node);
      }
    } catch {}
  }

  const schedule = (() => {
    let timer = 0;
    return (root = document) => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = 0;
        scan(root);
      }, 80);
    };
  })();

  try {
    document.documentElement.lang = "zh-CN";
    document.documentElement.setAttribute("translate", "no");
  } catch {}

  const start = () => {
    scan(document);
    try {
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "characterData") translateTextNode(mutation.target);
          else if (mutation.type === "attributes") translateElement(mutation.target);
          else schedule();
        }
      }).observe(document.documentElement || document, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: attrs,
      });
    } catch {}
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  window.addEventListener("load", () => schedule(), { passive: true });
  window.addEventListener("popstate", () => schedule(), { passive: true });
  window.addEventListener("visibilitychange", () => schedule(), { passive: true });
  for (const key of ["pushState", "replaceState"]) {
    try {
      const original = history[key];
      history[key] = function (...args) {
        const result = original.apply(this, args);
        schedule();
        return result;
      };
    } catch {}
  }
  try {
    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (...args) {
      const root = originalAttachShadow.apply(this, args);
      setTimeout(() => scan(root), 0);
      return root;
    };
  } catch {}
})();
`;
}

module.exports = {
  buildRuntimeScript,
};
