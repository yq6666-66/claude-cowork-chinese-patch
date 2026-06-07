const fs = require("fs");
const os = require("os");
const path = require("path");
const asarOps = require("../src/core/asar");
const {
  computeHeaderHash,
  knownHashes,
  readExeHashes,
  writeExeHash,
} = require("../src/core/integrity");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function createArchive(root, name, files) {
  const src = path.join(root, `${name}-src`);
  const archive = path.join(root, `${name}.asar`);
  fs.mkdirSync(src, { recursive: true });
  for (const [file, body] of Object.entries(files)) {
    const full = path.join(src, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  await asarOps.pack(src, archive);
  return { src, archive };
}

test("computes stable and content-sensitive ASAR header hashes", async () => {
  const root = tempDir("claude-zh-asar-");
  const one = await createArchive(root, "one", { "package.json": "{}", "index.js": "one" });
  const two = await createArchive(root, "two", { "package.json": "{}", "index.js": "two" });

  const oneHash = computeHeaderHash(one.archive);
  expect(oneHash).toMatch(/^[a-f0-9]{64}$/);
  expect(computeHeaderHash(one.archive)).toBe(oneHash);
  expect(computeHeaderHash(two.archive)).not.toBe(oneHash);
});

test("extracts and repacks archives with deterministic header hash reads", async () => {
  const root = tempDir("claude-zh-asar-roundtrip-");
  const source = await createArchive(root, "source", { "nested/file.txt": "hello" });
  const extracted = path.join(root, "extracted");
  const repacked = path.join(root, "repacked.asar");

  asarOps.extract(source.archive, extracted);
  await asarOps.pack(extracted, repacked);

  expect(fs.readFileSync(path.join(extracted, "nested/file.txt"), "utf8")).toBe("hello");
  expect(computeHeaderHash(repacked)).toMatch(/^[a-f0-9]{64}$/);
  expect(computeHeaderHash(repacked)).toBe(computeHeaderHash(repacked));
});

test("reads and writes Claude.exe ASAR integrity hashes", () => {
  const root = tempDir("claude-zh-exe-");
  const exe = path.join(root, "Claude.exe");
  const oldHash = knownHashes[0];
  const newHash = "a".repeat(64);

  fs.writeFileSync(exe, Buffer.from(`prefix-${oldHash}-suffix`, "ascii"));

  expect(readExeHashes(exe)).toContainEqual({ hash: oldHash, offset: 7, known: true });
  expect(writeExeHash(exe, newHash)).toBe(true);
  expect(fs.readFileSync(exe, "ascii")).toContain(newHash);
  expect(writeExeHash(exe, newHash)).toBe(false);
  expect(readExeHashes(exe)).toContainEqual({ hash: newHash, offset: 7, known: false });
});

test("writes an additional caller-provided current ASAR hash", () => {
  const root = tempDir("claude-zh-exe-current-hash-");
  const exe = path.join(root, "Claude.exe");
  const currentHash = "c".repeat(64);
  const nextHash = "d".repeat(64);

  fs.writeFileSync(exe, Buffer.from(`prefix-${currentHash}-suffix`, "ascii"));

  expect(writeExeHash(exe, nextHash, { additionalKnownHashes: [currentHash] })).toBe(true);
  expect(fs.readFileSync(exe, "ascii")).toContain(nextHash);
});

test("refuses to patch when a known hash appears more than once", () => {
  const root = tempDir("claude-zh-exe-duplicate-");
  const exe = path.join(root, "Claude.exe");
  const oldHash = knownHashes[0];

  fs.writeFileSync(exe, Buffer.from(`${oldHash}\n${oldHash}`, "ascii"));

  expect(() => writeExeHash(exe, "b".repeat(64))).toThrow(/appears more than once/);
});
