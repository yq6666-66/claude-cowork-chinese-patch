const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const appDir = process.argv[2];
const translationsPath = process.argv[3] || path.join(__dirname, "..", "translations", "zh-CN.json");

if (!appDir) {
  console.error("Usage: node scripts/patch-asar.cjs <extracted-app-dir> [translations-json]");
  process.exit(1);
}

const buildDir = path.join(appDir, ".vite", "build");
const mainIndex = path.join(buildDir, "index.js");
const preloadTargets = [
  path.join(buildDir, "mainView.js"),
  path.join(buildDir, "mainWindow.js"),
].filter((file) => fs.existsSync(file));

if (!fs.existsSync(mainIndex)) {
  throw new Error(`Cannot find Claude bundle entry: ${mainIndex}`);
}

if (preloadTargets.length === 0) {
  throw new Error(`Cannot find Claude preload bundles under: ${buildDir}`);
}

const dict = JSON.parse(fs.readFileSync(translationsPath, "utf8"));

const regexRules = [
  ["^You(?:'|’)re running Claude through your organization(?:'|’)s own inference provider \\((.+)\\)\\. Your conversations are sent there, not to Anthropic, and are governed by your organization(?:'|’)s agreement with that provider\\.$", "你正在通过组织自己的推理服务提供方 ($1) 运行 Claude。你的对话会发送到该提供方，而不是 Anthropic，并受组织与该提供方之间协议的约束。"],
  ["^(.+[\\u4e00-\\u9fff].*) safely\\.$", "$1。"],
  ["^(\\d+) minutes? ago$", "$1 分钟前"],
  ["^(\\d+) hours? ago$", "$1 小时前"],
  ["^(\\d+) days? ago$", "$1 天前"],
  ["^(\\d+) files?$", "$1 个文件"],
  ["^(\\d+) folders?$", "$1 个文件夹"],
  ["^(\\d+) projects?$", "$1 个项目"],
  ["^(\\d+) tasks?$", "$1 个任务"],
  ["^(\\d+) messages?$", "$1 条消息"],
  ["^(.+) selected$", "已选择 $1"],
  ["^Open (.+) in Browser$", "在浏览器中打开 $1"],
  ["^Delete (.+)$", "删除 $1"],
  ["^Create (.+)$", "创建 $1"],
  ["^New (.+)$", "新建 $1"],
  ["^Search (.+)$", "搜索 $1"],
];

const patchFingerprint = crypto
  .createHash("sha256")
  .update(JSON.stringify({ dict, regexRules }))
  .digest("hex")
  .slice(0, 12);
const domMarker = `__claudeCoworkZhPatch_${patchFingerprint}`;
const mainMarker = `__claudeCoworkZhPatchMain_${patchFingerprint}`;

function buildDomPatch() {
  const payload = JSON.stringify({ dict, regexRules });
  return `
;(() => {
  const MARK = ${JSON.stringify(domMarker)};
  if (window[MARK]) return;
  try { Object.defineProperty(window, MARK, { value: true, configurable: false }); } catch { window[MARK] = true; }

  const payload = ${payload};
  const dict = payload.dict;
  const entries = Object.entries(dict).sort((a, b) => b[0].length - a[0].length);
  const rules = payload.regexRules.map(([source, target]) => [new RegExp(source), target]);
  const attrs = ["placeholder", "title", "aria-label", "alt", "data-tooltip", "data-title", "data-label"];
  const skipSelector = "script,style,code,pre,textarea,kbd,samp,[contenteditable='true'],[data-cowork-zh-no-translate]";
  const protectedWords = /Claude|Opus|Sonnet|Haiku|MCP|API|URL|GitHub|Google|Slack|Notion|Linear|Figma|Chrome|Windows|macOS|BLE|USB|DXT|VM|3P/g;

  const normalize = (value) => String(value || "").replace(/\\u00a0/g, " ").replace(/\\s+/g, " ").trim();
  const restoreSpace = (raw, body) => {
    const text = String(raw);
    const start = text.match(/^\\s*/)?.[0] || "";
    const end = text.match(/\\s*$/)?.[0] || "";
    return start + body + end;
  };

  function translateBody(body) {
    const normalized = normalize(body);
    if (!normalized || !/[A-Za-z]/.test(normalized)) return null;
    if (dict[normalized]) return dict[normalized];
    for (const [rule, target] of rules) {
      if (rule.test(normalized)) return normalized.replace(rule, target);
    }
    if (/\\{[^}]+\\}/.test(normalized)) return null;
    let replaced = normalized;
    for (const [from, to] of entries) {
      if (from.length < 3) continue;
      if (replaced.includes(from)) replaced = replaced.split(from).join(to);
    }
    if (replaced !== normalized) {
      const remainder = replaced.replace(protectedWords, "");
      const longEnglish = remainder.match(/[A-Za-z]{6,}/g);
      if (!longEnglish || longEnglish.length <= 2) return replaced;
    }
    return null;
  }

  function translate(raw) {
    if (!raw || !/[A-Za-z]/.test(String(raw))) return raw;
    const translated = translateBody(raw);
    return translated ? restoreSpace(raw, translated) : raw;
  }

  function shouldSkipElement(element) {
    if (!element || element.nodeType !== 1) return false;
    if (element.closest(skipSelector)) return true;
    return Boolean(element.closest("[role='textbox'], .cm-editor, .monaco-editor"));
  }

  function translateTextNode(node) {
    const parent = node.parentElement;
    if (!parent || shouldSkipElement(parent)) return;
    const original = node.nodeValue;
    if (!original || original.length > 500) return;
    const next = translate(original);
    if (next !== original) node.nodeValue = next;
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
    return () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = 0;
        scan(document);
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
    setInterval(() => scan(document), 1500);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  window.addEventListener("load", schedule, { passive: true });
  window.addEventListener("popstate", schedule, { passive: true });
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

const domPatch = buildDomPatch();

for (const target of preloadTargets) {
  let content = fs.readFileSync(target, "utf8");
  if (!content.includes(domMarker)) {
    content += "\n" + domPatch + "\n";
    fs.writeFileSync(target, content, "utf8");
    console.log(`Appended DOM translator to ${target}`);
  } else {
    console.log(`DOM translator already present in ${target}`);
  }
}

let index = fs.readFileSync(mainIndex, "utf8");
if (!index.includes(mainMarker)) {
  const injections = [
    {
      needle: `YFn(o.webContents),o.webContents.on("dom-ready",()=>{xJ()});`,
      replacement: `YFn(o.webContents);const ${mainMarker}=()=>{o.webContents.executeJavaScript(${JSON.stringify(domPatch)},!0).catch(()=>{})};o.webContents.on("dom-ready",()=>{xJ(),${mainMarker}()}),o.webContents.on("did-finish-load",${mainMarker});`,
    },
    {
      needle: `Tm(s.webContents),ccr(s.webContents),s.webContents.on("dom-ready",()=>{poA()});`,
      replacement: `Tm(s.webContents),ccr(s.webContents);const ${mainMarker}=()=>{s.webContents.executeJavaScript(${JSON.stringify(domPatch)},!0).catch(()=>{})};s.webContents.on("dom-ready",()=>{poA(),${mainMarker}()}),s.webContents.on("did-finish-load",${mainMarker});`,
    },
  ];
  const injection = injections.find(({ needle }) => index.includes(needle));
  if (!injection && !index.includes("__claudeCoworkZhPatchMain")) {
    throw new Error("Main process injection point not found. Claude may have changed its bundle layout.");
  } else if (!injection) {
    console.log("Main-process translator from an earlier patch is already present; relying on preload injection for this dictionary update.");
  } else {
    index = index.replace(injection.needle, injection.replacement);
    fs.writeFileSync(mainIndex, index, "utf8");
    console.log(`Injected main-process translator into ${mainIndex}`);
  }
} else {
  console.log(`Main-process translator already present in ${mainIndex}`);
}

console.log("Patch complete");
