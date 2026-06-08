const { diagnose } = require("../src/pipeline/doctor");

const appDir = process.argv[2];

try {
  const result = diagnose({ appDir });
  const label = {
    healthy: "健康",
    "needs-install": "需安装",
    "needs-repatch": "需重打",
    broken: "异常",
  }[result.status] || result.status;

  console.log(`[${label}] ${result.reason}`);
  if (result.app) {
    console.log(`App: ${result.app.appDir}`);
    console.log(`ASAR: ${result.app.asarPath}`);
    console.log(`Header hash: ${result.currentHeaderHash}`);
    if (result.mode) console.log(`Mode: ${result.mode}`);
  }
  process.exitCode = result.code;
} catch (error) {
  console.error(`[异常] ${error.message}`);
  process.exitCode = 1;
}
