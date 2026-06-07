const fs = require("fs");
const path = require("path");
const asar = require("@electron/asar");

function uncache(asarPath) {
  if (typeof asar.uncache === "function") {
    asar.uncache(asarPath);
  }
}

function extract(asarPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  uncache(asarPath);
  asar.extractAll(asarPath, destDir);
}

async function pack(srcDir, asarPath) {
  fs.mkdirSync(path.dirname(asarPath), { recursive: true });
  await asar.createPackage(srcDir, asarPath);
  uncache(asarPath);
}

function readHeader(asarPath) {
  uncache(asarPath);
  return asar.getRawHeader(asarPath);
}

function archivePathCandidates(archivePath) {
  const value = String(archivePath);
  const slashPath = value.replace(/\\/g, "/");
  const nativePath = value.replace(/\//g, "\\");
  const ordered = process.platform === "win32" ? [nativePath, slashPath, value] : [slashPath, nativePath, value];
  return Array.from(new Set(ordered));
}

function readFile(asarPath, archivePath) {
  let lastError = null;

  uncache(asarPath);
  for (const candidate of archivePathCandidates(archivePath)) {
    try {
      return asar.extractFile(asarPath, candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`ASAR entry not found: ${archivePath}`);
}

function readText(asarPath, archivePath) {
  return readFile(asarPath, archivePath).toString("utf8");
}

function archiveContainsText(asarPath, text, archivePaths) {
  return archivePaths.some((archivePath) => {
    try {
      return readText(asarPath, archivePath).includes(text);
    } catch {
      return false;
    }
  });
}

module.exports = {
  archiveContainsText,
  extract,
  pack,
  readFile,
  readHeader,
  readText,
  uncache,
};
