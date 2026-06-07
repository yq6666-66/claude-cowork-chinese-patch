const fs = require("fs");
const os = require("os");
const path = require("path");
const { createLogger } = require("../src/core/logger");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "claude-zh-logger-"));
}

test("writes parseable JSON lines with step duration", () => {
  const logDir = tempDir();
  const logger = createLogger({ runId: "run", logDir, console: null });

  logger.info("start", { phase: 1 });
  logger.step("backup").ok({ files: 2 });
  logger.flush();

  const lines = fs.readFileSync(logger.logPath, "utf8").trim().split(/\r?\n/);
  const parsed = lines.map((line) => JSON.parse(line));

  expect(parsed[0]).toMatchObject({ runId: "run", level: "info", message: "start", phase: 1 });
  expect(parsed[1]).toMatchObject({ runId: "run", level: "info", step: "backup", files: 2 });
  expect(parsed[1].durationMs).toEqual(expect.any(Number));
});

test("falls back to console-only when logDir cannot be created", () => {
  const root = tempDir();
  const fileAsDir = path.join(root, "not-a-directory");
  fs.writeFileSync(fileAsDir, "x");

  const logger = createLogger({ runId: "run", logDir: fileAsDir, console: null });

  expect(() => logger.warn("still works")).not.toThrow();
});
