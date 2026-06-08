const { buildRuntimeScript } = require("../src/inject/runtime-translator");

test("builds parseable runtime script with marker and payload", () => {
  const script = buildRuntimeScript({
    marker: "__test_marker",
    dict: { Hello: "你好" },
    rules: [{ pattern: "^New (.+)$", replace: "新建 $1", priority: 1 }],
  });

  expect(script).toContain("__test_marker");
  expect(script).toContain("WeakSet");
  expect(script).toContain("data-message-author-role");
  expect(script).toContain("tool-result");
  expect(script).not.toContain("setInterval");
  expect(() => new Function(script)).not.toThrow();
});
