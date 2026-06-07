const { readExeHashes, writeExeHash } = require("../src/core/integrity");

const exe = process.argv[2];
const newHash = process.argv[3];

if (!exe || !newHash || !/^[a-f0-9]{64}$/i.test(newHash)) {
  console.error("Usage: node scripts/patch-exe-hash.cjs <Claude.exe> <electron-asar-integrity-hash>");
  process.exit(1);
}

try {
  const before = readExeHashes(exe).find((entry) => entry.known);
  const changed = writeExeHash(exe, newHash);
  if (!changed) {
    console.log("Claude.exe already contains target ASAR integrity hash.");
    process.exit(0);
  }
  if (before) {
    console.log(`Patched Claude.exe hash at offset ${before.offset}: ${before.hash} -> ${newHash}`);
  } else {
    console.log(`Patched Claude.exe ASAR integrity hash -> ${newHash}`);
  }
} catch (error) {
  if (!/Could not find a known ASAR integrity hash/.test(error.message)) throw error;
  throw new Error("Could not find a known ASAR integrity hash in Claude.exe. Add this Claude version's original hash to scripts/patch-exe-hash.cjs.");
}
