import test from "node:test";
import assert from "node:assert/strict";

import { generateDataKey } from "../lib/crypto.mjs";
import {
  createEmptyMaster,
  createTask,
  finalizeMaster,
  replaceTask,
} from "../lib/model.mjs";
import {
  buildTaskOperation,
  createRevisionPayload,
  decodeRevision,
  encodeRevision,
  mergeRevisionIntoMaster,
  verifyRevisionAuthentication,
} from "../lib/revision.mjs";

test("revideringskod är diffbaserad, autentiserad och kan mergas", async () => {
  const base = await finalizeMaster(createEmptyMaster({
    datasetId: "revision-dataset-0001",
    now: new Date("2026-07-31T08:00:00Z"),
  }), { now: new Date("2026-07-31T08:00:00Z") });
  const task = createTask({
    id: "new-task",
    title: "Ny lokal uppgift",
    state: "inbox",
  }, new Date("2026-07-31T08:10:00Z"));
  const working = replaceTask(base, task);
  const operation = await buildTaskOperation("task.create", null, task, {
    opId: "operation-0001",
    createdAt: "2026-07-31T08:10:00Z",
  });
  const dataKey = generateDataKey();
  const payload = await createRevisionPayload({
    baseMaster: base,
    workingMaster: working,
    operations: [operation],
    sourceDeviceId: "device-0001",
    dataKey,
    codeId: "code-0001",
    createdAt: "2026-07-31T08:11:00Z",
  });
  assert.equal("snapshot" in payload.result, false);
  const decoded = await decodeRevision(await encodeRevision(payload));
  assert.equal(await verifyRevisionAuthentication(decoded, dataKey), true);
  assert.equal(await verifyRevisionAuthentication(decoded, generateDataKey()), false);
  const merged = await mergeRevisionIntoMaster(base, decoded, new Date("2026-07-31T08:12:00Z"));
  assert.equal(merged.conflicts.length, 0);
  assert.equal(merged.master.tasks[0].title, "Ny lokal uppgift");
  assert.equal(merged.master.masterRevision, 2);
  const replay = await mergeRevisionIntoMaster(merged.master, decoded, new Date("2026-07-31T08:13:00Z"));
  assert.equal(replay.alreadyApplied, true);
  assert.equal(replay.master.masterRevision, 2);
});

test("resultatmetadata måste motsvara operationerna", async () => {
  const base = await finalizeMaster(createEmptyMaster({
    datasetId: "revision-dataset-0002",
    now: new Date("2026-07-31T08:00:00Z"),
  }), { now: new Date("2026-07-31T08:00:00Z") });
  const task = createTask({
    id: "expected-task",
    title: "Förväntad",
    state: "inbox",
  }, new Date("2026-07-31T08:10:00Z"));
  const operation = await buildTaskOperation("task.create", null, task);
  const payload = await createRevisionPayload({
    baseMaster: base,
    workingMaster: replaceTask(base, task),
    operations: [operation],
    sourceDeviceId: "device-0002",
    dataKey: generateDataKey(),
  });
  payload.result.snapshotHash = "0".repeat(64);
  await assert.rejects(
    mergeRevisionIntoMaster(base, payload),
    /motsvarar inte deklarerat resultat/u,
  );
});

test("skyddade identitetsfält avvisas", async () => {
  const base = await finalizeMaster(createEmptyMaster({
    datasetId: "revision-dataset-0003",
    now: new Date("2026-07-31T08:00:00Z"),
  }), { now: new Date("2026-07-31T08:00:00Z") });
  const task = createTask({ id: "task-safe-id", title: "Säker", state: "ready" });
  const withTask = await finalizeMaster(replaceTask(base, task), {
    now: new Date("2026-07-31T08:01:00Z"),
  });
  const payload = await createRevisionPayload({
    baseMaster: withTask,
    workingMaster: withTask,
    operations: [{
      opId: "bad-operation-id",
      type: "task.update",
      taskId: task.id,
      createdAt: "2026-07-31T08:02:00Z",
      baseEntityHash: "0".repeat(64),
      baseValues: { id: task.id },
      set: { id: "renamed-task" },
      unset: [],
    }],
    sourceDeviceId: "device-0003",
    dataKey: generateDataKey(),
  });
  await assert.rejects(
    mergeRevisionIntoMaster(withTask, payload),
    /skyddat fält/u,
  );
});
