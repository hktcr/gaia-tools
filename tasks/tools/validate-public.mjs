#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import process from "node:process";

const root = resolve(process.argv[2] || new URL("..", import.meta.url).pathname);
const forbiddenFilePatterns = [
  /master.*\.json$/iu,
  /recovery/iu,
  /data[-_]?key/iu,
  /\.map$/iu,
  /\.gaiarev$/iu,
];
const forbiddenTextPatterns = [
  /GAIA_TASKS_PASSWORD/u,
  /"type"\s*:\s*"gaia-task-dataset"/u,
  /"tasks"\s*:\s*\[\s*\{\s*"id"/u,
];
const textExtensions = new Set([".html", ".css", ".js", ".mjs", ".json", ".md", ".svg", ".webmanifest"]);
const allowedDatasetSourceFiles = new Set([
  "lib/model.mjs",
  "lib/revision.mjs",
  "tools/vault-cli.mjs",
  "tools/validate-public.mjs",
  "test/model.test.mjs",
  "test/revision.test.mjs",
  "README.md",
]);

async function walk(directory) {
  const entries = await readdir(directory);
  const output = [];
  for (const name of entries) {
    const path = join(directory, name);
    const info = await stat(path);
    if (info.isDirectory()) output.push(...await walk(path));
    else output.push(path);
  }
  return output;
}

const failures = [];
for (const path of await walk(root)) {
  const rel = relative(root, path);
  if (forbiddenFilePatterns.some((pattern) => pattern.test(rel))) {
    failures.push(`${rel}: förbjudet filnamn i Pages-källan`);
  }
  if (!textExtensions.has(extname(path)) && !path.endsWith(".webmanifest")) continue;
  const text = await readFile(path, "utf8");
  for (const pattern of forbiddenTextPatterns) {
    if (pattern.test(text) && !allowedDatasetSourceFiles.has(rel)) {
      failures.push(`${rel}: möjlig klartext-master eller hemlighetsreferens`);
    }
  }
}

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("Publik task-artefakt: inga kända klartextläckor hittades.\n");

