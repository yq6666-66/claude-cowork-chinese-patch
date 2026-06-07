const { computeHeaderHash } = require("../src/core/integrity");

const archive = process.argv[2];
if (!archive) {
  console.error("Usage: node scripts/get-asar-header-hash.cjs <app.asar>");
  process.exit(1);
}

console.log(computeHeaderHash(archive));
