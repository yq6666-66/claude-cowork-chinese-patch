const { locateClaude } = require("../src/core/locate");

const explicitDir = process.argv[2];

try {
  const result = locateClaude({ explicitDir });
  console.log("[locate-ok]");
  console.log(`appDir: ${result.appDir}`);
  console.log(`exePath: ${result.exePath}`);
  console.log(`asarPath: ${result.asarPath}`);
  console.log(`version: ${result.version || "unknown"}`);
  console.log(`bundleFingerprint: ${result.bundleFingerprint}`);
} catch (error) {
  console.error("[locate-failed]");
  console.error(error.message);

  if (Array.isArray(error.attempted) && error.attempted.length > 0) {
    console.error("attempted:");
    for (const entry of error.attempted) {
      console.error(`- ${entry.strategy}: ${entry.candidate}`);
    }
  }

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    console.error("errors:");
    for (const entry of error.errors) {
      const candidate = entry.candidate ? ` (${entry.candidate})` : "";
      console.error(`- ${entry.strategy}${candidate}: ${entry.message}`);
    }
  }

  process.exitCode = 1;
}
