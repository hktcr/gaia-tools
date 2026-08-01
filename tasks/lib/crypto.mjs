import {
  base64UrlToBytes,
  bytesToBase64Url,
  canonicalize,
  fromUtf8,
  gzip,
  gunzip,
  safeJsonParse,
  utf8,
} from "./codec.mjs";
import { SUPPORTED_SCHEMA_VERSIONS, computeMasterHash, validateMaster } from "./model.mjs";

const DEFAULT_ITERATIONS = 600_000;

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function vaultAad(vault, purpose) {
  return utf8(canonicalize({
    type: vault.type,
    envelopeVersion: vault.envelopeVersion,
    datasetId: vault.datasetId,
    schemaVersion: vault.schemaVersion,
    masterRevision: vault.masterRevision,
    purpose,
  }));
}

async function importPassword(password) {
  return crypto.subtle.importKey(
    "raw",
    utf8(password.normalize("NFC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
}

async function derivePasswordKey(password, salt, iterations) {
  if (iterations !== DEFAULT_ITERATIONS) {
    throw new Error("KDF-profilen stöds inte");
  }
  const material = await importPassword(password);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function derivePurposeKey(dekBytes, datasetId, purpose) {
  const material = await crypto.subtle.importKey(
    "raw",
    dekBytes,
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: utf8(`gaia-tasks:${datasetId}`),
      info: utf8(purpose),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptAesGcm(key, plaintext, aad) {
  const iv = randomBytes(12);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
    key,
    plaintext,
  ));
  return { iv, ciphertext };
}

async function decryptAesGcm(key, iv, ciphertext, aad) {
  return new Uint8Array(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
    key,
    ciphertext,
  ));
}

export function generateDataKey() {
  return randomBytes(32);
}

export function encodeDataKey(dekBytes) {
  if (!(dekBytes instanceof Uint8Array) || dekBytes.byteLength !== 32) {
    throw new Error("Datanyckeln måste vara 32 byte");
  }
  return bytesToBase64Url(dekBytes);
}

export function decodeDataKey(value) {
  const bytes = base64UrlToBytes(value.trim());
  if (bytes.byteLength !== 32) throw new Error("Ogiltig datanyckel");
  return bytes;
}

export async function createVault(master, password, {
  dataKey = generateDataKey(),
  iterations = DEFAULT_ITERATIONS,
} = {}) {
  const errors = validateMaster(master);
  if (errors.length) throw new Error(`Ogiltig master: ${errors.join("; ")}`);
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Lösenfrasen är för kort");
  }
  const salt = randomBytes(16);
  const passwordKey = await derivePasswordKey(password, salt, iterations);
  const vault = {
    type: "gaia-task-vault",
    envelopeVersion: 1,
    datasetId: master.datasetId,
    schemaVersion: master.schemaVersion,
    masterRevision: master.masterRevision,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: bytesToBase64Url(salt),
      iterations,
      normalization: "NFC",
    },
    keyDerivation: {
      name: "HKDF",
      hash: "SHA-256",
      snapshotInfo: "gaia-task/snapshot-encryption/v1",
      localInfo: "gaia-task/local-encryption/v1",
    },
    wrappedKey: {
      algorithm: "AES-256-GCM",
      iv: "",
      ciphertext: "",
    },
    payload: {
      algorithm: "AES-256-GCM",
      compression: "gzip",
      iv: "",
      ciphertext: "",
    },
  };

  const wrapped = await encryptAesGcm(passwordKey, dataKey, vaultAad(vault, "wrapped-key"));
  vault.wrappedKey.iv = bytesToBase64Url(wrapped.iv);
  vault.wrappedKey.ciphertext = bytesToBase64Url(wrapped.ciphertext);

  const compressed = await gzip(utf8(canonicalize(master)));
  vault.payload.compression = compressed.algorithm;
  const snapshotKey = await derivePurposeKey(dataKey, master.datasetId, "gaia-task/snapshot-encryption/v1");
  const encrypted = await encryptAesGcm(
    snapshotKey,
    compressed.bytes,
    vaultAad(vault, "snapshot"),
  );
  vault.payload.iv = bytesToBase64Url(encrypted.iv);
  vault.payload.ciphertext = bytesToBase64Url(encrypted.ciphertext);
  return { vault, dataKey };
}

function validateVaultEnvelope(vault) {
  if (!vault || vault.type !== "gaia-task-vault" || vault.envelopeVersion !== 1) {
    throw new Error("Vault-formatet stöds inte");
  }
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(vault.schemaVersion) || !Number.isInteger(vault.masterRevision)) {
    throw new Error("Vault-metadata är ogiltig");
  }
  if (vault.kdf?.name !== "PBKDF2" || vault.kdf?.hash !== "SHA-256") {
    throw new Error("Vaultens KDF stöds inte");
  }
  if (vault.wrappedKey?.algorithm !== "AES-256-GCM" || vault.payload?.algorithm !== "AES-256-GCM") {
    throw new Error("Vaultens kryptering stöds inte");
  }
}

export async function decryptVault(vault, password) {
  validateVaultEnvelope(vault);
  try {
    const salt = base64UrlToBytes(vault.kdf.salt);
    if (salt.byteLength !== 16) throw new Error("salt");
    const passwordKey = await derivePasswordKey(password, salt, vault.kdf.iterations);
    const dataKey = await decryptAesGcm(
      passwordKey,
      base64UrlToBytes(vault.wrappedKey.iv),
      base64UrlToBytes(vault.wrappedKey.ciphertext),
      vaultAad(vault, "wrapped-key"),
    );
    if (dataKey.byteLength !== 32) throw new Error("key");
    const snapshotKey = await derivePurposeKey(
      dataKey,
      vault.datasetId,
      vault.keyDerivation?.snapshotInfo || "gaia-task/snapshot-encryption/v1",
    );
    const compressed = await decryptAesGcm(
      snapshotKey,
      base64UrlToBytes(vault.payload.iv),
      base64UrlToBytes(vault.payload.ciphertext),
      vaultAad(vault, "snapshot"),
    );
    const plaintext = await gunzip(compressed, vault.payload.compression, 20 * 1024 * 1024);
    const master = safeJsonParse(fromUtf8(plaintext));
    const errors = validateMaster(master);
    if (
      errors.length
      || master.datasetId !== vault.datasetId
      || master.masterRevision !== vault.masterRevision
      || master.schemaVersion !== vault.schemaVersion
      || master.revisionHash !== await computeMasterHash(master)
    ) {
      throw new Error("schema");
    }
    return { master, dataKey };
  } catch {
    throw new Error("Fel lösenfras eller skadad data");
  }
}

function localAad(datasetId, baseMasterRevision) {
  return utf8(canonicalize({
    type: "gaia-task-local",
    envelopeVersion: 1,
    datasetId,
    baseMasterRevision,
    purpose: "local-overlay",
  }));
}

export async function encryptLocalRecord(record, dataKey) {
  if (
    !record
    || record.type !== "gaia-task-local-record"
    || typeof record.datasetId !== "string"
    || !Number.isInteger(record.baseMasterRevision)
  ) {
    throw new Error("Ogiltig lokal post");
  }
  const localKey = await derivePurposeKey(dataKey, record.datasetId, "gaia-task/local-encryption/v1");
  const compressed = await gzip(utf8(canonicalize(record)));
  const encrypted = await encryptAesGcm(
    localKey,
    compressed.bytes,
    localAad(record.datasetId, record.baseMasterRevision),
  );
  return {
    type: "gaia-task-local-envelope",
    envelopeVersion: 1,
    datasetId: record.datasetId,
    baseMasterRevision: record.baseMasterRevision,
    compression: compressed.algorithm,
    iv: bytesToBase64Url(encrypted.iv),
    ciphertext: bytesToBase64Url(encrypted.ciphertext),
  };
}

export async function decryptLocalRecord(envelope, dataKey) {
  if (!envelope || envelope.type !== "gaia-task-local-envelope" || envelope.envelopeVersion !== 1) {
    throw new Error("Lokalt dataformat stöds inte");
  }
  const localKey = await derivePurposeKey(dataKey, envelope.datasetId, "gaia-task/local-encryption/v1");
  const compressed = await decryptAesGcm(
    localKey,
    base64UrlToBytes(envelope.iv),
    base64UrlToBytes(envelope.ciphertext),
    localAad(envelope.datasetId, envelope.baseMasterRevision),
  );
  const plaintext = await gunzip(compressed, envelope.compression, 20 * 1024 * 1024);
  const record = safeJsonParse(fromUtf8(plaintext));
  if (
    record.type !== "gaia-task-local-record"
    || record.datasetId !== envelope.datasetId
    || record.baseMasterRevision !== envelope.baseMasterRevision
  ) {
    throw new Error("Den lokala posten är skadad");
  }
  return record;
}

export const cryptoParameters = Object.freeze({
  defaultIterations: DEFAULT_ITERATIONS,
  minimumIterations: DEFAULT_ITERATIONS,
  maximumIterations: DEFAULT_ITERATIONS,
});
