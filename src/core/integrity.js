const crypto = require("crypto");
const fs = require("fs");
const { readHeader } = require("./asar");

const knownHashes = [
  "ef224ab6b4afe8e801caea06ca92b7191d9c3becb15b1053f4c5c8629644fd23",
  "b0a23bbe92b3b988d1ce943bb76e99e9c763b3e7a7aaa4f856448d86078f2ae6",
  "c52ff064254da5baecfa800156c6014838884387d0c1cea19e490f19550c0de6",
  "8aa9083e3ea2fac019e725e35e0428dc06c4784e4fac3b38bee3fe4c273ad236",
  "caecc530646ab1aae9c592a7f6480c00891fd52646704a451ac61001b7e64a42",
  "6eb97fad1890523c2d877acb4106d3a92873309c90e1c3c3e9e7eea2f9cbf243",
  "8e2b06ff857158f6e7996d297c486bccd5e33ad9a2b6cd6775be3a5cdaa4d49a",
  "c53294dfc4cbad042fe041b235f8e0f36bd34e63f16450ad39f9a99a9944b72c",
  "954db768c9fe6304098606960ec74c3ce5ef103508ba8c4b02e3d7ac550318b7",
  "d3ed5dccaaac6c9f7926715c0a3f953a70c5639f2b1632904fcb8595dfaa5936",
];

function assertHash(hash) {
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    throw new Error("ASAR integrity hash must be a 64-character hexadecimal string.");
  }
}

function computeHeaderHash(asarPath) {
  const raw = readHeader(asarPath);
  return crypto.createHash("sha256").update(raw.headerString).digest("hex");
}

function readExeHashes(exePath) {
  const text = fs.readFileSync(exePath).toString("latin1");
  const matches = [];
  const seen = new Set();
  const pattern = /[a-f0-9]{64}/gi;
  let match;

  while ((match = pattern.exec(text))) {
    const hash = match[0].toLowerCase();
    const key = `${hash}:${match.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({
      hash,
      offset: match.index,
      known: knownHashes.includes(hash),
    });
  }

  return matches;
}

function writeExeHash(exePath, newHash, options = {}) {
  assertHash(newHash);

  const bytes = fs.readFileSync(exePath);
  const target = Buffer.from(newHash.toLowerCase(), "ascii");

  if (bytes.indexOf(target) !== -1) {
    return false;
  }

  const replacementHashes = [
    ...knownHashes,
    ...(options.additionalKnownHashes || []),
  ]
    .map((hash) => String(hash || "").toLowerCase())
    .filter((hash, index, hashes) => /^[a-f0-9]{64}$/.test(hash) && hashes.indexOf(hash) === index);

  for (const oldHash of replacementHashes) {
    if (oldHash === newHash.toLowerCase()) continue;
    const source = Buffer.from(oldHash, "ascii");
    const offset = bytes.indexOf(source);

    if (offset !== -1) {
      if (bytes.indexOf(source, offset + 1) !== -1) {
        throw new Error(`Hash ${oldHash} appears more than once; refusing to patch.`);
      }
      target.copy(bytes, offset);
      fs.writeFileSync(exePath, bytes);
      return true;
    }
  }

  throw new Error("Could not find a known ASAR integrity hash in Claude.exe. Add this Claude version's original hash to src/core/integrity.js.");
}

module.exports = {
  computeHeaderHash,
  knownHashes,
  readExeHashes,
  writeExeHash,
};
