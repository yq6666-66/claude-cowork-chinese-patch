const fs = require("fs");
const os = require("os");
const path = require("path");

function defaultRunId() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function defaultLogDir() {
  const home = process.env.USERPROFILE || os.homedir();
  return path.join(home, ".claude-cowork-zh-patch", "logs");
}

function serializeError(error) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

function createLogger(options = {}) {
  const runId = options.runId || defaultRunId();
  const logDir = options.logDir || defaultLogDir();
  const consoleLike = options.console === undefined ? console : options.console;
  const logPath = path.join(logDir, `install-${runId}.log`);
  let fileEnabled = true;

  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    fileEnabled = false;
  }

  function write(level, message, meta = {}) {
    const entry = {
      time: new Date().toISOString(),
      runId,
      level,
      message: String(message),
      ...meta,
    };

    const stepPart = entry.step ? ` [${entry.step}]` : "";
    const durationPart = typeof entry.durationMs === "number" ? ` ${entry.durationMs}ms` : "";
    const line = `${entry.time} ${level.toUpperCase()}${stepPart}${durationPart} ${entry.message}`;

    try {
      if (consoleLike) {
        const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
        if (typeof consoleLike[method] === "function") consoleLike[method](line);
      }
    } catch {}

    if (!fileEnabled) return entry;

    try {
      fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
    } catch {
      fileEnabled = false;
    }

    return entry;
  }

  function step(name) {
    const startedAt = Date.now();
    const finish = (level, message, meta = {}) =>
      write(level, message, {
        ...meta,
        step: name,
        durationMs: Date.now() - startedAt,
      });

    return {
      ok(meta) {
        return finish("info", `${name} ok`, meta);
      },
      warn(message, meta) {
        return finish("warn", message || `${name} warning`, meta);
      },
      fail(error, meta = {}) {
        return finish("error", error && error.message ? error.message : String(error), {
          ...meta,
          error: serializeError(error),
        });
      },
    };
  }

  return {
    runId,
    logPath,
    info(message, meta) {
      return write("info", message, meta);
    },
    warn(message, meta) {
      return write("warn", message, meta);
    },
    error(message, meta) {
      return write("error", message, meta);
    },
    step,
    flush() {},
  };
}

module.exports = {
  createLogger,
};
