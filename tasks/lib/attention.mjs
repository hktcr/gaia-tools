import { canonicalize, deepClone, sha256Hex } from "./codec.mjs";

export const ATTENTION_ENGINE_VERSION = "attention-v2";
export const ATTENTION_SLOTS = Object.freeze(["06", "08", "10", "12", "14", "16", "18", "20"]);
export const ATTENTION_REASON_CODES = Object.freeze([
  "HARD_DEADLINE_BAND",
  "CALENDAR_PREP",
  "FOLLOW_UP_DUE",
  "REVIEW_DUE",
  "PINNED_FOCUS",
  "CAPACITY_CONFLICT",
  "SNOOZE_EXPIRED",
  "BLOCKER_RESOLVED",
]);
export const ATTENTION_DECISIONS = Object.freeze(["notified", "quiet", "suppressed", "error"]);

const REASON_SET = new Set(ATTENTION_REASON_CODES);
const DECISION_SET = new Set(ATTENTION_DECISIONS);
const SLOT_SET = new Set(ATTENTION_SLOTS);
const SUPPORTED_ENGINE_VERSIONS = new Set(["attention-v1", ATTENTION_ENGINE_VERSION]);

export function createAttentionRunKey(localDay, scheduledSlot) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(localDay) || !SLOT_SET.has(scheduledSlot)) {
    throw new Error("Ogiltig lokal dag eller kontrollslot");
  }
  return `${ATTENTION_ENGINE_VERSION}|${localDay}|${scheduledSlot}`;
}

export async function attentionRelevantHash(task) {
  return sha256Hex(canonicalize({
    id: task.id,
    state: task.state,
    horizon: task.horizon,
    commitmentClass: task.commitmentClass,
    priority: task.priority,
    projectId: task.projectId,
    contexts: task.contexts,
    bestWindows: task.bestWindows,
    energy: task.energy,
    estimateMinutes: task.estimateMinutes,
    nextAction: task.nextAction,
    minimumStep: task.minimumStep,
    normalStep: task.normalStep,
    fullStep: task.fullStep,
    timing: task.timing,
    attention: task.attention,
    waiting: task.waiting,
    blockedBy: task.blockedBy,
    calendarRefs: task.calendarRefs,
  }));
}

export async function createNoticeId({
  datasetId,
  taskId,
  reasonCode,
  thresholdBand,
  reasonSpecificState,
  calendarEffectHash = "none",
  localDayOrSlotGroup,
}) {
  if (!REASON_SET.has(reasonCode)) throw new Error("Okänd reason code");
  if (!String(datasetId || "").trim() || !String(taskId || "").trim()) {
    throw new Error("datasetId och taskId krävs för notice-id");
  }
  if (reasonSpecificState === undefined || reasonSpecificState === null) {
    throw new Error("Reason-specifikt tillstånd krävs för notice-id");
  }
  return sha256Hex(canonicalize({
    version: "dedupe-v2",
    datasetId,
    taskId,
    reasonCode,
    thresholdBand: thresholdBand || "none",
    reasonSpecificState,
    calendarEffectHash,
    localDayOrSlotGroup,
  }));
}

export function validateAttentionLog(log) {
  const errors = [];
  if (!log || log.type !== "gaia-task-attention-log") errors.push("Fel loggtyp");
  if (log?.schemaVersion !== 1) errors.push("Fel schemaVersion");
  if (!SUPPORTED_ENGINE_VERSIONS.has(log?.engineVersion)) errors.push("Fel engineVersion");
  if (typeof log?.datasetId !== "string") errors.push("datasetId saknas");
  if (!Number.isInteger(log?.logRevision) || log.logRevision < 1) errors.push("Ogiltig logRevision");
  if (!Array.isArray(log?.entries)) errors.push("entries måste vara en lista");
  const runKeys = new Set();
  for (const entry of log?.entries || []) {
    if (!entry?.runKey || runKeys.has(entry.runKey)) errors.push("runKey saknas eller är duplicerad");
    runKeys.add(entry?.runKey);
    if (!SUPPORTED_ENGINE_VERSIONS.has(entry?.engineVersion)) errors.push("Entry har fel engineVersion");
    if (!String(entry?.runKey || "").startsWith(`${entry?.engineVersion}|`)) {
      errors.push("Entry har runKey för fel engineVersion");
    }
    if (!SLOT_SET.has(entry?.scheduledSlot)) errors.push("Entry har ogiltig scheduledSlot");
    if (!DECISION_SET.has(entry?.decision)) errors.push("Entry har ogiltigt decision");
    if (!Number.isInteger(entry?.masterRevision) || entry.masterRevision < 1) {
      errors.push("Entry har ogiltig masterRevision");
    }
    if (!Array.isArray(entry?.notices)) errors.push("Entry notices måste vara en lista");
    for (const notice of entry?.notices || []) {
      if (!/^[a-f0-9]{64}$/u.test(notice?.noticeId || "")) errors.push("Ogiltigt noticeId");
      if (!REASON_SET.has(notice?.reasonCode)) errors.push("Ogiltig reasonCode");
    }
  }
  return errors;
}

export function upgradeAttentionLog(log) {
  const errors = validateAttentionLog(log);
  if (errors.length) throw new Error(`Ogiltig attention-logg: ${errors.join("; ")}`);
  const next = deepClone(log);
  next.engineVersion = ATTENTION_ENGINE_VERSION;
  return next;
}

export function appendAttentionRun(log, run, {
  expectedLogRevision,
  now = new Date(),
} = {}) {
  const errors = validateAttentionLog(log);
  if (errors.length) throw new Error(`Ogiltig attention-logg: ${errors.join("; ")}`);
  if (log.logRevision !== expectedLogRevision) {
    throw new Error("Attention-loggen ändrades efter läsning");
  }
  if (log.entries.some((entry) => entry.runKey === run.runKey)) {
    return { log: deepClone(log), alreadyRecorded: true };
  }
  const next = upgradeAttentionLog(log);
  next.entries.push(deepClone(run));
  next.logRevision += 1;
  next.updatedAt = now.toISOString();
  const nextErrors = validateAttentionLog(next);
  if (nextErrors.length) throw new Error(`Ny attention-logg är ogiltig: ${nextErrors.join("; ")}`);
  return { log: next, alreadyRecorded: false };
}
