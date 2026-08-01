import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyMaster,
  createTask,
  chooseTaskStep,
  evaluateAttentionContract,
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

test("förfallen väntande uppföljning blir synlig", () => {
  let master = createEmptyMaster({ datasetId: "test-dataset-0004" });
  const waiting = createTask({
    id: "waiting-follow-up",
    title: "Följ upp svar",
    state: "waiting",
    waiting: { for: "ett svar", followUpAt: "2026-08-01T08:00:00Z" },
  }, new Date("2026-07-31T08:00:00Z"));
  master = replaceTask(master, waiting);
  const ranked = rankActionableTasks(master, new Date("2026-08-01T09:00:00Z"));
  assert.equal(ranked[0].task.id, "waiting-follow-up");
  assert.equal(ranked[0].reason, "Tid att följa upp");
});

test("löst blockerare lyfter uppgiften men aktiv blockerare håller den tyst", () => {
  let master = createEmptyMaster({ datasetId: "test-dataset-0005" });
  const blocker = createTask({ id: "blocker-task", title: "Förarbete", state: "ready", nextAction: "Gör förarbetet" });
  const blocked = createTask({
    id: "blocked-task",
    title: "Nästa steg",
    state: "blocked",
    nextAction: "Fortsätt",
    blockedBy: [blocker.id],
  });
  master = replaceTask(replaceTask(master, blocker), blocked);
  assert.equal(rankActionableTasks(master).some(({ task }) => task.id === blocked.id), false);
  master = replaceTask(master, createTask({
    ...blocker,
    id: blocker.id,
    entityVersion: blocker.entityVersion,
    createdAt: blocker.createdAt,
    state: "done",
  }));
  const resolved = rankActionableTasks(master).find(({ task }) => task.id === blocked.id);
  assert.equal(resolved.reason, "Blockeraren verkar vara löst");
});

test("saknad blockerare tolkas säkert som olöst", () => {
  let master = createEmptyMaster({ datasetId: "test-dataset-missing-blocker" });
  master = replaceTask(master, createTask({
    id: "blocked-by-missing",
    title: "Vänta på okänd blockerare",
    state: "blocked",
    nextAction: "Fortsätt",
    blockedBy: ["missing-task"],
  }));
  assert.equal(rankActionableTasks(master).length, 0);
});

test("oklar inkorg konkurrerar inte om fokus", () => {
  let master = createEmptyMaster({ datasetId: "test-dataset-0006" });
  master = replaceTask(master, createTask({ id: "unclear-inbox", title: "En tanke", state: "inbox" }));
  assert.equal(rankActionableTasks(master).length, 0);
});

test("kontextkapseln väljer ett minsta steg som ryms", () => {
  let master = createEmptyMaster({ datasetId: "test-dataset-0007" });
  master = replaceTask(master, createTask({
    id: "step-task",
    title: "Stor uppgift",
    state: "ready",
    nextAction: "Arbeta vidare",
    minimumStep: "Öppna dokumentet och skriv första meningen",
    normalStep: "Skriv ett stycke",
    fullStep: "Skriv hela avsnittet",
    estimateMinutes: 60,
    contexts: ["dator"],
  }));
  const [ranked] = rankActionableTasks(master, new Date("2026-08-01T08:00:00Z"), {
    availableMinutes: 5,
    energy: "low",
    context: "dator",
  });
  assert.equal(ranked.step.level, "minimum");
  assert.match(ranked.step.text, /första meningen/u);
  assert.equal(ranked.why.some((reason) => reason.includes("korta tidsfönstret")), true);
});

test("stegväljaren lovar inte ett helt långt steg i ett kortare fönster", () => {
  const task = createTask({
    title: "Lång uppgift",
    state: "ready",
    estimateMinutes: 240,
    minimumStep: "Öppna underlaget",
    normalStep: "Bearbeta första delen",
    fullStep: "Gör hela arbetet",
  });
  assert.deepEqual(
    chooseTaskStep(task, { availableMinutes: 60 }),
    { level: "normal", label: "Lagom steg", text: "Bearbeta första delen" },
  );
});

test("nära hård deadline bryter igenom även när inkorgen behöver klargöras", () => {
  let master = createEmptyMaster({ datasetId: "test-dataset-urgent-inbox" });
  master = replaceTask(master, createTask({
    id: "urgent-unclear-inbox",
    title: "Brådskande men oklar",
    state: "inbox",
    timing: { hardDeadlineAt: "2026-08-01T09:00:00Z", deadlineSource: "bekräftat mejl" },
  }));
  const [ranked] = rankActionableTasks(master, new Date("2026-08-01T08:00:00Z"));
  assert.equal(ranked.task.id, "urgent-unclear-inbox");
  assert.equal(ranked.step.level, "clarify");
  assert.match(ranked.reason, /Skarp deadline/u);
});

test("uttrycklig prioritet påverkar ordningen utan att slå ut deadlines", () => {
  let master = createEmptyMaster({ datasetId: "test-dataset-priority" });
  master = replaceTask(master, createTask({
    id: "low-priority",
    title: "Låg prioritet",
    state: "ready",
    nextAction: "Gör steget",
    priority: 0,
    rank: "0",
  }));
  master = replaceTask(master, createTask({
    id: "high-priority",
    title: "Hög prioritet",
    state: "ready",
    nextAction: "Gör steget",
    priority: 3,
    rank: "9",
  }));
  assert.equal(rankActionableTasks(master)[0].task.id, "high-priority");
});

test("avbruten blockerare kräver omplanering och räknas inte som löst", () => {
  let master = createEmptyMaster({ datasetId: "test-dataset-cancelled-blocker" });
  const blocker = createTask({ id: "cancelled-blocker", title: "Avbrutet förarbete", state: "cancelled" });
  const blocked = createTask({
    id: "still-blocked",
    title: "Beroende uppgift",
    state: "blocked",
    nextAction: "Fortsätt",
    blockedBy: [blocker.id],
  });
  master = replaceTask(replaceTask(master, blocker), blocked);
  assert.equal(rankActionableTasks(master).some(({ task }) => task.id === blocked.id), false);
});

test("valideringen stoppar beroendecykler", () => {
  let master = createEmptyMaster({ datasetId: "test-dataset-cycle" });
  master = replaceTask(master, createTask({
    id: "cycle-a",
    title: "Cykel A",
    state: "blocked",
    blockedBy: ["cycle-b"],
  }));
  master = replaceTask(master, createTask({
    id: "cycle-b",
    title: "Cykel B",
    state: "blocked",
    blockedBy: ["cycle-a"],
  }));
  assert.equal(validateMaster(master).some((error) => error.includes("cykel")), true);
});

test("valideringen stoppar tillgänglighet efter hård deadline", () => {
  let master = createEmptyMaster({ datasetId: "test-dataset-impossible-window" });
  master = replaceTask(master, createTask({
    id: "impossible-window",
    title: "Omöjligt tidsfönster",
    state: "ready",
    nextAction: "Gör steget",
    timing: {
      availableFrom: "2026-08-01T12:00:00Z",
      hardDeadlineAt: "2026-08-01T10:00:00Z",
      deadlineSource: "bekräftat",
    },
  }));
  assert.equal(validateMaster(master).some((error) => error.includes("efter sin hårda deadline")), true);
});

test("uppmärksamhetskontraktet kan fatta ett granskningsbart quiet-beslut", () => {
  let master = createEmptyMaster({ datasetId: "test-dataset-0008" });
  master = replaceTask(master, createTask({
    id: "silent-task",
    title: "Tyst uppgift",
    state: "ready",
    nextAction: "Gör något",
    attention: { mode: "silent" },
  }));
  const decision = evaluateAttentionContract(master, new Date("2026-08-01T08:00:00Z"));
  assert.equal(decision.decision, "quiet");
  assert.equal(decision.focus, null);
  assert.deepEqual(decision.suppressed, [{ taskId: "silent-task", reason: "silent" }]);
});

test("synliga kandidater utanför gränsen förklaras med uppmärksamhetsbudgeten", () => {
  let master = createEmptyMaster({ datasetId: "test-dataset-attention-budget" });
  for (let index = 0; index < 4; index += 1) {
    master = replaceTask(master, createTask({
      id: `budget-task-${index}`,
      title: `Uppgift ${index}`,
      state: "ready",
      nextAction: "Gör nästa steg",
      rank: String(index),
    }));
  }
  const decision = evaluateAttentionContract(master, new Date("2026-08-01T08:00:00Z"));
  assert.equal(decision.focus.task.id, "budget-task-0");
  assert.equal(decision.inSight.length, 2);
  assert.deepEqual(decision.suppressed, [{ taskId: "budget-task-3", reason: "attention-budget" }]);
});
