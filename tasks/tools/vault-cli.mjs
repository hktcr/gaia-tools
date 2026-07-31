#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

import { canonicalize, safeJsonParse, sha256Hex } from "../lib/codec.mjs";
import {
  createVault,
  decodeDataKey,
  decryptVault,
  encodeDataKey,
  generateDataKey,
} from "../lib/crypto.mjs";
import { computeMasterHash, validateMaster } from "../lib/model.mjs";
import {
  decodeRevision,
  mergeRevisionIntoMaster,
  verifyRevisionAuthentication,
} from "../lib/revision.mjs";

function fail(message, exitCode = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) fail(`Värde saknas för ${name}`);
  return value;
}

async function readJson(path) {
  return safeJsonParse(await readFile(resolve(path), "utf8"));
}

async function writeJson(path, value) {
  const outputPath = resolve(path);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function readDataKey(path) {
  if (!path) return generateDataKey();
  return decodeDataKey(await readFile(resolve(path), "utf8"));
}

async function commandValidate() {
  const masterPath = option("--master");
  if (!masterPath) fail("--master krävs");
  const master = await readJson(masterPath);
  const errors = validateMaster(master);
  if (errors.length) fail(errors.map((error) => `- ${error}`).join("\n"));
  const calculated = await computeMasterHash(master);
  if (master.revisionHash && calculated !== master.revisionHash) {
    fail("Lagrad masterhash stämmer inte med innehållet");
  }
  process.stdout.write(JSON.stringify({
    valid: true,
    datasetId: master.datasetId,
    masterRevision: master.masterRevision,
    tasks: master.tasks.length,
    projects: master.projects.length,
    calculatedRevisionHash: calculated,
    storedRevisionHash: master.revisionHash || null,
  }, null, 2) + "\n");
}

async function commandFinalize() {
  const masterPath = option("--master");
  const outputPath = option("--out");
  if (!masterPath || !outputPath) fail("finalize kräver --master och --out");
  const master = await readJson(masterPath);
  const errors = validateMaster(master);
  if (errors.length) fail(errors.map((error) => `- ${error}`).join("\n"));
  master.revisionHash = await computeMasterHash(master);
  await writeJson(outputPath, master);
  process.stdout.write(JSON.stringify({
    finalized: true,
    output: resolve(outputPath),
    masterRevision: master.masterRevision,
    revisionHash: master.revisionHash,
  }, null, 2) + "\n");
}

async function commandEncrypt() {
  const masterPath = option("--master");
  const outputDirectory = option("--out-dir");
  const manifestPath = option("--manifest");
  const dataKeyPath = option("--data-key");
  const writeDataKeyPath = option("--write-data-key");
  const password = process.env.GAIA_TASKS_PASSWORD;
  if (!masterPath || !outputDirectory || !manifestPath) {
    fail("encrypt kräver --master, --out-dir och --manifest");
  }
  if (!password) fail("GAIA_TASKS_PASSWORD saknas i miljön");
  const master = await readJson(masterPath);
  const errors = validateMaster(master);
  if (errors.length) fail(`Ogiltig master:\n${errors.join("\n")}`);
  master.revisionHash = await computeMasterHash(master);
  const dataKey = await readDataKey(dataKeyPath);
  if (!dataKeyPath && writeDataKeyPath) {
    const keyPath = resolve(writeDataKeyPath);
    await mkdir(dirname(keyPath), { recursive: true });
    await writeFile(keyPath, `${encodeDataKey(dataKey)}\n`, { mode: 0o600 });
  }
  const { vault } = await createVault(master, password, { dataKey });
  const vaultText = `${JSON.stringify(vault)}\n`;
  const vaultHash = await sha256Hex(vaultText);
  const fileName = `tasks.${vaultHash.slice(0, 24)}.vault.json`;
  const outPath = join(resolve(outputDirectory), fileName);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, vaultText, { mode: 0o644 });
  await writeJson(manifestPath, {
    type: "gaia-task-public-manifest",
    version: 1,
    datasetId: master.datasetId,
    masterRevision: master.masterRevision,
    vaultFile: `./${fileName}`,
    vaultSha256: vaultHash,
  });
  process.stdout.write(JSON.stringify({
    vault: outPath,
    manifest: resolve(manifestPath),
    masterRevision: master.masterRevision,
    vaultSha256: vaultHash,
  }, null, 2) + "\n");
}

async function commandRecoverDataKey() {
  const vaultPath = option("--vault");
  const outputPath = option("--out");
  const password = process.env.GAIA_TASKS_PASSWORD;
  if (!vaultPath || !outputPath) fail("recover-data-key kräver --vault och --out");
  if (!password) fail("GAIA_TASKS_PASSWORD saknas i miljön");
  const vault = await readJson(vaultPath);
  const { dataKey } = await decryptVault(vault, password);
  const keyPath = resolve(outputPath);
  await mkdir(dirname(keyPath), { recursive: true });
  await writeFile(keyPath, `${encodeDataKey(dataKey)}\n`, { mode: 0o600 });
  process.stdout.write(JSON.stringify({
    recovered: true,
    output: keyPath,
    datasetId: vault.datasetId,
    masterRevision: vault.masterRevision,
  }, null, 2) + "\n");
}

async function readRevisionCode() {
  const codePath = option("--code");
  if (codePath) return readFile(resolve(codePath), "utf8");
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function commandInspectRevision() {
  const payload = await decodeRevision(await readRevisionCode());
  const dataKeyPath = option("--data-key");
  const authenticated = dataKeyPath
    ? await verifyRevisionAuthentication(payload, await readDataKey(dataKeyPath))
    : false;
  process.stdout.write(JSON.stringify({
    valid: true,
    authenticated,
    datasetId: payload.datasetId,
    codeId: payload.codeId,
    createdAt: payload.createdAt,
    baseRevision: payload.base.masterRevision,
    operations: payload.operations.map((operation) => ({
      opId: operation.opId,
      type: operation.type,
      entityId: operation.taskId || operation.projectId,
      changedFields: Object.keys(operation.set || {}),
    })),
    snapshot: {
      tasks: payload.result.taskCount,
      projects: payload.result.projectCount,
      hash: payload.result.snapshotHash,
    },
  }, null, 2) + "\n");
}

async function commandApplyRevision() {
  const masterPath = option("--master");
  const outputPath = option("--out");
  const dataKeyPath = option("--data-key");
  if (!masterPath || !outputPath || !dataKeyPath) {
    fail("apply-revision kräver --master, --out och --data-key");
  }
  const master = await readJson(masterPath);
  const payload = await decodeRevision(await readRevisionCode());
  if (!await verifyRevisionAuthentication(payload, await readDataKey(dataKeyPath))) {
    fail("Revideringskodens HMAC-autentisering misslyckades");
  }
  const { master: merged, conflicts, alreadyApplied } = await mergeRevisionIntoMaster(master, payload);
  if (conflicts.length) {
    process.stderr.write(`${JSON.stringify({ applied: false, conflicts }, null, 2)}\n`);
    process.exit(2);
  }
  await writeJson(outputPath, merged);
  process.stdout.write(JSON.stringify({
    applied: !alreadyApplied,
    alreadyApplied: Boolean(alreadyApplied),
    output: resolve(outputPath),
    masterRevision: merged.masterRevision,
    revisionHash: merged.revisionHash,
  }, null, 2) + "\n");
}

async function commandCanonicalize() {
  const path = option("--json");
  if (!path) fail("--json krävs");
  process.stdout.write(`${canonicalize(await readJson(path))}\n`);
}

const command = process.argv[2];
try {
  if (command === "validate") await commandValidate();
  else if (command === "finalize") await commandFinalize();
  else if (command === "encrypt") await commandEncrypt();
  else if (command === "recover-data-key") await commandRecoverDataKey();
  else if (command === "inspect-revision") await commandInspectRevision();
  else if (command === "apply-revision") await commandApplyRevision();
  else if (command === "canonicalize") await commandCanonicalize();
  else {
    fail([
      "Användning:",
      "  vault-cli.mjs validate --master FILE",
      "  vault-cli.mjs finalize --master FILE --out FILE",
      "  vault-cli.mjs encrypt --master FILE --out-dir DIR --manifest FILE [--data-key FILE | --write-data-key FILE]",
      "  vault-cli.mjs recover-data-key --vault FILE --out FILE",
      "  vault-cli.mjs inspect-revision [--code FILE] [--data-key FILE]",
      "  vault-cli.mjs apply-revision --master FILE --out FILE --data-key FILE [--code FILE]",
      "  vault-cli.mjs canonicalize --json FILE",
    ].join("\n"));
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
