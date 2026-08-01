import test from "node:test";
import assert from "node:assert/strict";

import {
  ATTENTION_ENGINE_VERSION,
  appendAttentionRun,
  attentionRelevantHash,
  createAttentionRunKey,
  createNoticeId,
  upgradeAttentionLog,
  validateAttentionLog,
} from "../lib/attention.mjs";

function emptyLog() {
  return {
    type: "gaia-task-attention-log",
    schemaVersion: 1,
    engineVersion: ATTENTION_ENGINE_VERSION,
    datasetId: "attention-dataset-0001",
    logRevision: 1,
    updatedAt: "2026-07-31T08:00:00Z",
    entries: [],
  };
}

test("attention-körning läggs till idempotent med revisionskontroll", () => {
  const run = {
    runKey: createAttentionRunKey("2026-07-31", "08"),
    evaluatedAt: "2026-07-31T06:00:12Z",
    scheduledSlot: "08",
    source: "scheduled",
    engineVersion: ATTENTION_ENGINE_VERSION,
    masterRevision: 1,
    decision: "quiet",
    notices: [],
  };
  const first = appendAttentionRun(emptyLog(), run, {
    expectedLogRevision: 1,
    now: new Date("2026-07-31T06:00:13Z"),
  });
  assert.equal(first.log.logRevision, 2);
  assert.deepEqual(validateAttentionLog(first.log), []);
  const replay = appendAttentionRun(first.log, run, { expectedLogRevision: 2 });
  assert.equal(replay.alreadyRecorded, true);
  assert.equal(replay.log.logRevision, 2);
  assert.throws(
    () => appendAttentionRun(first.log, {
      ...run,
      runKey: createAttentionRunKey("2026-07-31", "10"),
    }, { expectedLogRevision: 1 }),
    /ändrades efter läsning/u,
  );
});

test("kvällsbron klockan 20 är en giltig slot", () => {
  assert.equal(
    createAttentionRunKey("2026-08-01", "20"),
    "attention-v2|2026-08-01|20",
  );
});

test("historisk v1-logg migreras utan att historiken skrivs om", () => {
  const legacy = {
    ...emptyLog(),
    engineVersion: "attention-v1",
    entries: [{
      runKey: "attention-v1|2026-07-31|08",
      evaluatedAt: "2026-07-31T06:00:12Z",
      scheduledSlot: "08",
      source: "scheduled",
      engineVersion: "attention-v1",
      masterRevision: 1,
      decision: "quiet",
      notices: [],
    }],
  };
  const upgraded = upgradeAttentionLog(legacy);
  assert.equal(upgraded.engineVersion, ATTENTION_ENGINE_VERSION);
  assert.equal(upgraded.entries[0].engineVersion, "attention-v1");
  assert.deepEqual(validateAttentionLog(upgraded), []);
});

test("relevanshashen ändras när kontext eller stege ändras", async () => {
  const task = {
    id: "attention-task",
    state: "ready",
    horizon: "next",
    commitmentClass: "intend",
    priority: 1,
    projectId: null,
    contexts: ["dator"],
    bestWindows: ["morning"],
    energy: "medium",
    estimateMinutes: 30,
    nextAction: "Öppna dokumentet",
    minimumStep: "Skriv en mening",
    normalStep: "Skriv ett stycke",
    fullStep: "Skriv avsnittet",
    timing: {},
    attention: {},
    waiting: {},
    blockedBy: [],
    calendarRefs: [],
  };
  assert.notEqual(
    await attentionRelevantHash(task),
    await attentionRelevantHash({ ...task, contexts: ["telefon"] }),
  );
  assert.notEqual(
    await attentionRelevantHash(task),
    await attentionRelevantHash({ ...task, minimumStep: "Skriv rubriken" }),
  );
});

test("notice-id följer anledningens eget tillstånd, inte orelaterade taskfält", async () => {
  const base = {
    datasetId: "attention-dataset-0001",
    taskId: "deadline-task",
    reasonCode: "HARD_DEADLINE_BAND",
    thresholdBand: "within-6h",
    reasonSpecificState: {
      hardDeadlineAt: "2026-08-01T10:00:00Z",
      band: "within-6h",
    },
    localDayOrSlotGroup: "2026-08-01",
  };
  const first = await createNoticeId(base);
  assert.equal(first, await createNoticeId({ ...base }));
  assert.notEqual(first, await createNoticeId({
    ...base,
    thresholdBand: "overdue",
    reasonSpecificState: { ...base.reasonSpecificState, band: "overdue" },
  }));
});
