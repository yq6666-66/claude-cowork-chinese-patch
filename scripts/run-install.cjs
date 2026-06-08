const path = require("path");
const { runInstall } = require("../src/pipeline/install");

const args = process.argv.slice(2);
const forceUnsafeAsar = args.includes("--force-unsafe-asar") || process.env.CLAUDE_ZH_FORCE_UNSAFE_ASAR === "1";
const modeArg = args.find((arg) => arg.startsWith("--mode="));
const appDir = args.find((arg) => !arg.startsWith("--")) || process.env.CLAUDE_COWORK_APP_DIR;
const repoDir = path.resolve(__dirname, "..");
const collectMissing = process.env.COWORK_ZH_COLLECT === "1" || process.env.CLAUDE_ZH_COLLECT_MISSING === "1";

runInstall({
  appDir,
  repoDir,
  collectMissing,
  forceUnsafeAsar,
  mode: modeArg ? modeArg.slice("--mode=".length) : undefined,
})
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    if (error.restoreError) {
      console.error(`Restore failed: ${error.restoreError.stack || error.restoreError.message}`);
    }
    process.exitCode = 1;
  });
