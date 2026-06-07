const {
  normalize,
  restoreSpace,
  translate,
  translateBody,
} = require("../src/translate/engine");

const rules = [
  { pattern: "^(\\d+) minutes? ago$", replace: "$1 分钟前", priority: 10 },
  { pattern: "^(\\d+) hours? ago$", replace: "$1 小时前", priority: 10 },
  { pattern: "^(\\d+) files?$", replace: "$1 个文件", priority: 10 },
  { pattern: "^Delete (.+)$", replace: "删除 $1", priority: 5 },
  { pattern: "^New (.+)$", replace: "新建 $1", priority: 5 },
  { pattern: "^Open (.+) in Browser$", replace: "在浏览器中打开 $1", priority: 5 },
];

test("normalizes whitespace and restores original edge spacing", () => {
  expect(normalize("  A\u00a0  B  ")).toBe("A B");
  expect(restoreSpace("  Hello  ", "你好")).toBe("  你好  ");
  expect(translate("  Hello  ", { dict: { Hello: "你好" } })).toBe("  你好  ");
});

test("uses exact dictionary matches first", () => {
  expect(translate("Connect your apps", {
    dict: { "Connect your apps": "连接你的应用" },
    rules,
  })).toBe("连接你的应用");
});

test("applies regex rules and priority order", () => {
  expect(translate("5 minutes ago", { dict: {}, rules })).toBe("5 分钟前");
  expect(translate("1 hour ago", { dict: {}, rules })).toBe("1 小时前");
  expect(translate("3 files", { dict: {}, rules })).toBe("3 个文件");
  expect(translate("Delete Report", { dict: {}, rules })).toBe("删除 Report");
  expect(translate("New Project", { dict: {}, rules })).toBe("新建 Project");
  expect(translate("Open X in Browser", { dict: {}, rules })).toBe("在浏览器中打开 X");

  const priorityRules = [
    { pattern: "^New (.+)$", replace: "低优先级 $1", priority: 1 },
    { pattern: "^New Project$", replace: "高优先级项目", priority: 20 },
  ];
  expect(translate("New Project", { dict: {}, rules: priorityRules })).toBe("高优先级项目");
});

test("does not fragment-replace placeholder templates", () => {
  const dict = { Delete: "删除", Loaded: "已加载", Hello: "你好" };

  expect(translate("Delete {name}", { dict })).toBe("Delete {name}");
  expect(translate("Loaded %s items", { dict })).toBe("Loaded %s items");
  expect(translate("Hello {{user}}", { dict })).toBe("Hello {{user}}");
});

test("accepts useful fragment replacement and rejects noisy leftovers", () => {
  expect(translate("连接 your apps", {
    dict: { "your apps": "你的应用" },
  })).toBe("连接 你的应用");

  expect(translate("Settings advanced configuration untouched residual pieces", {
    dict: { Settings: "设置" },
  })).toBe("Settings advanced configuration untouched residual pieces");
});

test("keeps protected product words while fragment-replacing around them", () => {
  expect(translate("Connect Claude MCP GitHub apps", {
    dict: {
      Connect: "连接",
      apps: "应用",
    },
  })).toBe("连接 Claude MCP GitHub 应用");
});

test("does not fragment-replace inside longer English words", () => {
  expect(translate("Allow user-added MCP servers", {
    dict: {
      All: "全部",
      Allow: "允许",
      servers: "服务器",
    },
  })).toBe("允许 user-added MCP 服务器");

  expect(translate("Model discovery", {
    dict: {
      Mode: "模式",
      discovery: "发现",
    },
  })).toBe("Model 发现");
});

test("translateBody returns null when nothing should change", () => {
  expect(translateBody("中文", { dict: {} })).toBeNull();
  expect(translateBody("No match", { dict: {} })).toBeNull();
});
