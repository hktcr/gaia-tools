import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyMaster,
  createTask,
  finalizeMaster,
  rankActionableTasks,
  replaceTask,
  validateMaster,
} from "../lib/model.mjs";

test("en tom master kan finaliseras och valideras", async () => {
  const master = await finalizeMaster(createEmptyMaster({
    datasetId: "test-dataset-0001",
    now: new Date("2026-07-31T08:00:00Z"),
  }), { now: new Date("2026-07-31T08:00:00Z") });
  assert.deepEqual(validateMaster(master), []);
  assert.match(master.revisionHash, /^[a-f0-9]{64}$/u);
});

test("skarp deadline rankas före vanlig prioritet", () => {
  let master = createEmptyMaster({
    datasetId: "test-dataset-0002",
    now: new Date("2026-07-31T08:00:00Z"),
  });
  const ordinary = createTask({
    id: "ordinary-task",
    title: "Vanlig uppgift",
    state: "ready",
    priority: 3,
  }, new Date("2026-07-31T08:00:00Z"));
  const deadline = createTask({
    id: "deadline-task",
    title: "Nära deadline",
    state: "ready",
    priority: 1,
    timing: { hardDeadlineAt: "2026-07-31T10:00:00Z" },
  }, new Date("2026-07-31T08:00:00Z"));
  master = replaceTask(replaceTask(master, ordinary), deadline);
  assert.equal(rankActionableTasks(master, new Date("2026-07-31T08:30:00Z"))[0].task.id, "deadline-task");
});

test("deadline-only visas bara när skarp deadline ligger inom ett dygn", () => {
  let master = createEmptyMaster({
    datasetId: "test-dataset-0003",
    now: new Date("2026-07-31T08:00:00Z"),
  });
  const noDeadline = createTask({
    id: "deadline-only-no-deadline",
    title: "Ingen deadline",
    state: "ready",
    attention: { mode: "deadline-only" },
  }, new Date("2026-07-31T08:00:00Z"));
  const nearDeadline = createTask({
    id: "deadline-only-near",
    title: "Nära deadline",
    state: "ready",
    attention: { mode: "deadline-only" },
    timing: { hardDeadlineAt: "2026-08-01T07:00:00Z" },
  }, new Date("2026-07-31T08:00:00Z"));
  master = replaceTask(replaceTask(master, noDeadline), nearDeadline);
  const ranked = rankActionableTasks(master, new Date("2026-07-31T08:00:00Z"));
  assert.deepEqual(ranked.map(({ task }) => task.id), ["deadline-only-near"]);
});
