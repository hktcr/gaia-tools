import {
  base64UrlToBytes,
  bytesToBase64Url,
  canonicalize,
  deepClone,
  fromUtf8,
  gzip,
  gunzip,
  safeJsonParse,
  sha256Hex,
  utf8,
} from "./codec.mjs";
import {
  CURRENT_SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  computeMasterHash,
  upgradeMasterSchema,
  validateMaster,
} from "./model.mjs";

const PREFIX = "GAIAREV1";
const MAX_CODE_CHARACTERS = 5 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 20 * 1024 * 1024;
const ALLOWED_OPERATION_TYPES = new Set([
  "task.create",
  "task.update",
  "task.complete",
  "task.delete",
  "task.move",
  "project.create",
  "project.update",
  "project.delete",
]);
const TASK_MUTABLE_FIELDS = new Set([
  "title",
  "notes",
  "outcome",
  "nextAction",
  "state",
  "horizon",
  "commitmentClass",
  "priority",
  "projectId",
  "tags",
  "contexts",
  "bestWindows",
  "energy",
  "estimateMinutes",
  "timing",
  "attention",
  "waiting",
  "blockedBy",
  "recurrence",
  "calendarRefs",
  "minimumStep",
  "normalStep",
  "fullStep",
  "rank",
  "origin",
  "completedAt",
]);
const PROJECT_MUTABLE_FIELDS = new Set([
  "name",
  "color",
  "icon",
  "order",
  "archived",
  "outcome",
]);

function jsonEqual(left, right) {
  return canonicalize(left) === canonicalize(right);
}

async function deriveRevisionAuthKey(dataKey, datasetId) {
  if (!(dataKey instanceof Uint8Array) || dataKey.byteLength !== 32) {
    throw new Error("Datanyckel krävs för att autentisera revisionen");
  }
  const material = await crypto.subtle.importKey("raw", dataKey, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: utf8(`gaia-tasks:${datasetId}`),
      info: utf8("gaia-task/revision-auth/v1"),
    },
    material,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"],
  );
}

function revisionMacBytes(payload) {
  const copy = deepClone(payload);
  copy.integrity.payloadHash = "";
  copy.integrity.revisionMac = "";
  return utf8(canonicalize(copy));
}

async function calculateRevisionMac(payload, dataKey) {
  const key = await deriveRevisionAuthKey(dataKey, payload.datasetId);
  const signature = await crypto.subtle.sign("HMAC", key, revisionMacBytes(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function verifyRevisionAuthentication(payload, dataKey) {
  const key = await deriveRevisionAuthKey(dataKey, payload.datasetId);
  let claimed;
  try {
    claimed = base64UrlToBytes(payload.integrity?.revisionMac || "");
  } catch {
    return false;
  }
  if (claimed.byteLength !== 32) return false;
  return crypto.subtle.verify("HMAC", key, claimed, revisionMacBytes(payload));
}

export async function entityHash(entity) {
  return sha256Hex(canonicalize(entity));
}

function revisionResultView(master) {
  return {
    datasetId: master.datasetId,
    schemaVersion: master.schemaVersion,
    timeZone: master.timeZone,
    settings: deepClone(master.settings),
    projects: deepClone(master.projects),
    tasks: master.tasks.map((task) => {
      const copy = deepClone(task);
      delete copy.entityVersion;
      delete copy.updatedAt;
      delete copy.lastMasterRevision;
      return copy;
    }),
    tombstones: deepClone(master.tombstones),
  };
}

export async function computeRevisionResultHash(master) {
  return sha256Hex(canonicalize(revisionResultView(master)));
}

export async function buildTaskOperation(type, before, after, {
  opId = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
} = {}) {
  if (!ALLOWED_OPERATION_TYPES.has(type) || !type.startsWith("task.")) {
    throw new Error("Otillåten task-operation");
  }
  if (type === "task.create") {
    return {
      opId,
      type,
      taskId: after.id,
      createdAt,
      baseEntityHash: null,
      baseValues: null,
      set: deepClone(after),
      unset: [],
    };
  }
  if (!before?.id || before.id !== after?.id) throw new Error("Operationens task-id matchar inte");
  const baseValues = {};
  const set = {};
  const unset = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (!TASK_MUTABLE_FIELDS.has(key)) continue;
    if (!(key in after)) {
      baseValues[key] = deepClone(before[key]);
      unset.push(key);
    } else if (!(key in before) || !jsonEqual(before[key], after[key])) {
      baseValues[key] = key in before ? deepClone(before[key]) : null;
      set[key] = deepClone(after[key]);
    }
  }
  return {
    opId,
    type,
    taskId: before.id,
    createdAt,
    baseEntityHash: await entityHash(before),
    baseValues,
    set,
    unset,
  };
}

export async function buildProjectOperation(type, before, after, {
  opId = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
} = {}) {
  if (!ALLOWED_OPERATION_TYPES.has(type) || !type.startsWith("project.")) {
    throw new Error("Otillåten projekt-operation");
  }
  if (type === "project.create") {
    return {
      opId,
      type,
      projectId: after.id,
      createdAt,
      baseEntityHash: null,
      baseValues: null,
      set: deepClone(after),
      unset: [],
    };
  }
  if (!before?.id || before.id !== after?.id) throw new Error("Operationens projekt-id matchar inte");
  const baseValues = {};
  const set = {};
  const unset = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!(key in after)) {
      baseValues[key] = deepClone(before[key]);
      unset.push(key);
    } else if (!(key in before) || !jsonEqual(before[key], after[key])) {
      baseValues[key] = key in before ? deepClone(before[key]) : null;
      set[key] = deepClone(after[key]);
    }
  }
  return {
    opId,
    type,
    projectId: before.id,
    createdAt,
    baseEntityHash: await entityHash(before),
    baseValues,
    set,
    unset,
  };
}

export async function createRevisionPayload({
  baseMaster,
  workingMaster,
  operations,
  sourceDeviceId,
  dataKey,
  codeId = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
}) {
  const errors = validateMaster(workingMaster);
  if (errors.length) throw new Error(`Ogiltig lokal snapshot: ${errors.join("; ")}`);
  const baseHash = baseMaster.revisionHash || await computeMasterHash(baseMaster);
  const snapshotHash = await computeRevisionResultHash(workingMaster);
  const payload = {
    type: "gaia-task-revision",
    formatVersion: 1,
    schemaVersion: workingMaster.schemaVersion,
    minimumReaderVersion: workingMaster.schemaVersion >= 2 ? 2 : 1,
    datasetId: workingMaster.datasetId,
    codeId,
    sourceDeviceId,
    createdAt,
    base: {
      masterRevision: baseMaster.masterRevision,
      snapshotHash: baseHash,
    },
    operations: deepClone(operations),
    result: {
      snapshotHash,
      taskCount: workingMaster.tasks.length,
      projectCount: workingMaster.projects.length,
    },
    integrity: {
      canonicalization: "sorted-json-v1",
      hash: "SHA-256",
      payloadHash: "",
      authentication: "HMAC-SHA-256",
      keyDerivation: "HKDF-SHA-256:gaia-task/revision-auth/v1",
      revisionMac: "",
    },
  };
  payload.integrity.revisionMac = await calculateRevisionMac(payload, dataKey);
  return payload;
}

export async function encodeRevision(payload) {
  const copy = deepClone(payload);
  copy.integrity.payloadHash = "";
  const canonical = canonicalize(copy);
  copy.integrity.payloadHash = await sha256Hex(canonical);
  const packed = await gzip(utf8(canonicalize(copy)));
  const checksum = await sha256Hex(packed.bytes);
  const algorithm = packed.algorithm === "gzip" ? "GZ" : "RAW";
  return `${PREFIX}${algorithm}.${bytesToBase64Url(packed.bytes)}.${checksum}`;
}

function validateRevisionPayload(payload) {
  if (
    !payload
    || payload.type !== "gaia-task-revision"
    || payload.formatVersion !== 1
    || !SUPPORTED_SCHEMA_VERSIONS.includes(payload.schemaVersion)
    || !Number.isInteger(payload.minimumReaderVersion)
    || payload.minimumReaderVersion < 1
    || payload.minimumReaderVersion > CURRENT_SCHEMA_VERSION
    || (payload.schemaVersion >= 2 && payload.minimumReaderVersion < 2)
  ) {
    throw new Error("Revisionsformatet stöds inte");
  }
  if (!Array.isArray(payload.operations) || payload.operations.length > 20_000) {
    throw new Error("Operationerna är ogiltiga eller för många");
  }
  if (
    typeof payload.result?.snapshotHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(payload.result.snapshotHash)
    || !Number.isInteger(payload.result?.taskCount)
    || payload.result.taskCount < 0
    || !Number.isInteger(payload.result?.projectCount)
    || payload.result.projectCount < 0
  ) throw new Error("Revisionens resultatmetadata är ogiltig");
  if (
    typeof payload.codeId !== "string"
    || payload.codeId.length < 4
    || !Number.isInteger(payload.base?.masterRevision)
    || payload.base.masterRevision < 1
    || !/^[a-f0-9]{64}$/u.test(payload.base?.snapshotHash || "")
  ) throw new Error("Revisionens basmetadata är ogiltig");
  if (
    payload.integrity?.authentication !== "HMAC-SHA-256"
    || payload.integrity?.keyDerivation !== "HKDF-SHA-256:gaia-task/revision-auth/v1"
    || typeof payload.integrity?.revisionMac !== "string"
  ) throw new Error("Revisionens autentisering stöds inte");
  const operationIds = new Set();
  for (const operation of payload.operations) {
    if (!operation?.opId || !ALLOWED_OPERATION_TYPES.has(operation.type)) {
      throw new Error("Revisionen innehåller en otillåten operation");
    }
    if (operationIds.has(operation.opId)) throw new Error("Revisionen innehåller duplicerade operationer");
    operationIds.add(operation.opId);
    const taskOperation = operation.type.startsWith("task.");
    const entityId = taskOperation ? operation.taskId : operation.projectId;
    if (typeof entityId !== "string" || entityId.length < 4) {
      throw new Error("Revisionen innehåller ett ogiltigt entitets-id");
    }
    if (!operation.set || typeof operation.set !== "object" || Array.isArray(operation.set)) {
      throw new Error("Revisionens fältändringar är ogiltiga");
    }
    if (!Array.isArray(operation.unset)) throw new Error("Revisionens unset-lista är ogiltig");
    const allowed = taskOperation ? TASK_MUTABLE_FIELDS : PROJECT_MUTABLE_FIELDS;
    const create = operation.type.endsWith(".create");
    for (const field of [...Object.keys(operation.set), ...operation.unset]) {
      if (!allowed.has(field) && !(create && field === "id") && !(create && taskOperation && [
        "entityVersion",
        "createdAt",
        "updatedAt",
        "lastMasterRevision",
      ].includes(field))) {
        throw new Error(`Revisionen försöker ändra skyddat fält: ${field}`);
      }
    }
    if (create && operation.set.id !== entityId) {
      throw new Error("Revisionens skapade id matchar inte operationen");
    }
    if (operation.type === "task.complete" && operation.set.state !== "done") {
      throw new Error("En complete-operation måste sätta state=done");
    }
    if (operation.type === "task.delete" && operation.set.state !== "trash") {
      throw new Error("En delete-operation måste sätta state=trash");
    }
  }
}

export async function decodeRevision(code) {
  const compact = String(code || "").replace(/\s+/gu, "");
  if (!compact || compact.length > MAX_CODE_CHARACTERS) throw new Error("Revideringskoden är för stor eller tom");
  const [prefix, encoded, checksum, ...rest] = compact.split(".");
  if (rest.length || !encoded || !checksum || !/^GAIAREV1(?:GZ|RAW)$/u.test(prefix)) {
    throw new Error("Revideringskoden har fel format");
  }
  const packed = base64UrlToBytes(encoded);
  if (await sha256Hex(packed) !== checksum.toLowerCase()) {
    throw new Error("Revideringskodens checksumma stämmer inte");
  }
  const algorithm = prefix.endsWith("GZ") ? "gzip" : "none";
  const unpacked = await gunzip(packed, algorithm, MAX_UNPACKED_BYTES);
  const payload = safeJsonParse(fromUtf8(unpacked), MAX_UNPACKED_BYTES);
  validateRevisionPayload(payload);

  const copy = deepClone(payload);
  const claimedPayloadHash = copy.integrity?.payloadHash;
  copy.integrity.payloadHash = "";
  if (await sha256Hex(canonicalize(copy)) !== claimedPayloadHash) {
    throw new Error("Revisionens interna hash stämmer inte");
  }
  return payload;
}

function applyFieldChanges(entity, operation, conflicts) {
  const next = deepClone(entity);
  for (const [field, newValue] of Object.entries(operation.set || {})) {
    const baseValue = operation.baseValues?.[field];
    const currentValue = next[field];
    if (jsonEqual(currentValue, baseValue) || jsonEqual(currentValue, newValue)) {
      next[field] = deepClone(newValue);
    } else {
      conflicts.push({
        opId: operation.opId,
        entityId: entity.id,
        field,
        baseValue,
        currentValue: deepClone(currentValue),
        localValue: deepClone(newValue),
      });
    }
  }
  for (const field of operation.unset || []) {
    const baseValue = operation.baseValues?.[field];
    if (jsonEqual(next[field], baseValue) || !(field in next)) delete next[field];
    else {
      conflicts.push({
        opId: operation.opId,
        entityId: entity.id,
        field,
        baseValue,
        currentValue: deepClone(next[field]),
        localValue: undefined,
      });
    }
  }
  return next;
}

export async function mergeRevisionIntoMaster(currentMaster, payload, now = new Date()) {
  validateRevisionPayload(payload);
  const masterErrors = validateMaster(currentMaster);
  if (masterErrors.length) throw new Error(`Aktuell master är ogiltig: ${masterErrors.join("; ")}`);
  const currentHash = await computeMasterHash(currentMaster);
  if (currentMaster.revisionHash !== currentHash) {
    throw new Error("Aktuell masters lagrade hash stämmer inte");
  }
  if (currentMaster.datasetId !== payload.datasetId) throw new Error("Revisionen tillhör ett annat dataset");
  if (currentMaster.masterRevision < payload.base.masterRevision) {
    throw new Error("Revisionens bas ligger före aktuell master");
  }
  const exactBase = currentMaster.masterRevision === payload.base.masterRevision;
  if (exactBase && currentHash !== payload.base.snapshotHash) {
    throw new Error("Revisionens bashash matchar inte aktuell master");
  }
  const alreadyApplied = new Set(currentMaster.appliedChangeIds || []);
  if (alreadyApplied.has(payload.codeId)) {
    return { master: currentMaster, conflicts: [], alreadyApplied: true };
  }
  const operations = payload.operations.filter((operation) => !alreadyApplied.has(operation.opId));
  if (!operations.length) {
    return { master: currentMaster, conflicts: [], alreadyApplied: true };
  }
  const targetSchemaVersion = Math.max(currentMaster.schemaVersion, payload.schemaVersion);
  let next = targetSchemaVersion >= 2
    ? upgradeMasterSchema(currentMaster)
    : deepClone(currentMaster);
  const conflicts = [];
  const changedTaskIds = new Set();
  const changedProjectIds = new Set();

  for (const operation of operations) {
    if (operation.type.startsWith("task.")) {
      const index = next.tasks.findIndex((task) => task.id === operation.taskId);
      if (operation.type === "task.create") {
        if (index < 0 && !next.tombstones.some((item) => item.id === operation.taskId)) {
          next.tasks.push(deepClone(operation.set));
          changedTaskIds.add(operation.taskId);
        } else if (index >= 0 && !jsonEqual(next.tasks[index], operation.set)) {
          conflicts.push({ opId: operation.opId, entityId: operation.taskId, field: "*", reason: "create-collision" });
        }
        continue;
      }
      if (index < 0) {
        conflicts.push({ opId: operation.opId, entityId: operation.taskId, field: "*", reason: "task-missing" });
        continue;
      }
      const changed = applyFieldChanges(next.tasks[index], operation, conflicts);
      next.tasks[index] = changed;
      changedTaskIds.add(operation.taskId);
    } else {
      const index = next.projects.findIndex((project) => project.id === operation.projectId);
      if (operation.type === "project.create") {
        if (index < 0) {
          next.projects.push(deepClone(operation.set));
          changedProjectIds.add(operation.projectId);
        } else if (!jsonEqual(next.projects[index], operation.set)) {
          conflicts.push({ opId: operation.opId, entityId: operation.projectId, field: "*", reason: "create-collision" });
        }
        continue;
      }
      if (index < 0) {
        conflicts.push({ opId: operation.opId, entityId: operation.projectId, field: "*", reason: "project-missing" });
        continue;
      }
      next.projects[index] = applyFieldChanges(next.projects[index], operation, conflicts);
      changedProjectIds.add(operation.projectId);
    }
  }

  if (conflicts.length) return { master: null, conflicts };
  if (targetSchemaVersion >= 2) next = upgradeMasterSchema(next);
  if (exactBase) {
    const resultHash = await computeRevisionResultHash(next);
    if (
      resultHash !== payload.result.snapshotHash
      || next.tasks.length !== payload.result.taskCount
      || next.projects.length !== payload.result.projectCount
    ) {
      throw new Error("Revisionens operationer motsvarar inte deklarerat resultat");
    }
  }

  const previousHash = currentHash;
  next.masterRevision = currentMaster.masterRevision + 1;
  next.parentRevisionHash = previousHash;
  next.updatedAt = now.toISOString();
  next.updatedBy = "gAIa revision import";
  for (const task of next.tasks) {
    if (changedTaskIds.has(task.id)) {
      task.entityVersion = (Number(task.entityVersion) || 0) + 1;
      task.updatedAt = now.toISOString();
      task.lastMasterRevision = next.masterRevision;
    }
  }
  next.appliedChangeIds = [...new Set([
    ...(currentMaster.appliedChangeIds || []),
    payload.codeId,
    ...operations.map((operation) => operation.opId),
  ])];
  next.revisionHash = await computeMasterHash(next);
  const errors = validateMaster(next);
  if (errors.length) throw new Error(`Merge gav ogiltig master: ${errors.join("; ")}`);
  return { master: next, conflicts: [], alreadyApplied: false };
}

export const revisionFormat = Object.freeze({
  prefix: PREFIX,
  maximumCodeCharacters: MAX_CODE_CHARACTERS,
  maximumUnpackedBytes: MAX_UNPACKED_BYTES,
});
