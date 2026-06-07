const { findMainHooks } = require("../src/inject/locate-hooks");

test("finds historical exact minified main-process hooks", () => {
  const source = [
    'YFn(o.webContents),o.webContents.on("dom-ready",()=>{xJ()});',
    'Tm(s.webContents),ccr(s.webContents),s.webContents.on("dom-ready",()=>{poA()});',
  ].join("");

  const hooks = findMainHooks(source);

  expect(hooks).toHaveLength(2);
  expect(hooks[0]).toMatchObject({ varName: "o", anchors: expect.arrayContaining(["dom-ready"]) });
  expect(hooks[1]).toMatchObject({ varName: "s", anchors: expect.arrayContaining(["webContents-wrapper-call"]) });
});

test("finds structurally similar hooks without relying on minified function names", () => {
  const source = "abc(windowRef.webContents), windowRef.webContents.on('dom-ready',()=>{ boot(); });";
  const hooks = findMainHooks(source);

  expect(hooks).toHaveLength(1);
  expect(hooks[0].varName).toBe("windowRef");
  expect(hooks[0].index).toBeGreaterThan(hooks[0].matchText.length - 1);
});

test("returns an empty list when no hook exists", () => {
  expect(findMainHooks("const x = 1;")).toEqual([]);
});
