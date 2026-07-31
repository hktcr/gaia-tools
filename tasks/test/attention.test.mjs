import test from "node:test";
import assert from "node:assert/strict";

import {
  ATTENTION_ENGINE_VERSION,
  appendAttentionRun,
  createAttentionRunKey,
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
