const { locateClaude } = require("../src/core/locate");

try {
  const explicitDir = process.argv[2];
  process.stdout.write(locateClaude({ explicitDir }).appDir);
} catch (error) {
  console.error(error.message);
  if (Array.isArray(error.errors)) {
    console.error(JSON.stringify(error.errors, null, 2));
  }
  process.exitCode = 1;
}
