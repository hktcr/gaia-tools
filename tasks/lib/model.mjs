import { canonicalize, deepClone, sha256Hex } from "./codec.mjs";

export const TASK_STATES = [
  "inbox",
  "ready",
  "doing",
  "waiting",
  "blocked",
  "done",
  "cancelled",
  "trash",
];

export const TASK_HORIZONS = ["next", "later", "someday"];
export const ENERGY_LEVELS = ["low", "medium", "high"];
export const ATTENTION_MODES = ["auto", "low", "deadline-only", "silent"];

const ACTIVE_STATES = new Set(["inbox", "ready", "doing"]);
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/u;

function nowIso(now = new Date()) {
  return now.toISOString();
}

export function createId() {
  return crypto.randomUUID();
}

export function createEmptyMaster({
  datasetId = createId(),
  now = new Date(),
  projects = [],
} = {}) {
  return {
    type: "gaia-task-dataset",
    schemaVersion: 1,
    datasetId,
    masterRevision: 1,
    parentRevisionHash: null,
    revisionHash: "",
    timeZone: "Europe/Stockholm",
    updatedAt: nowIso(now),
    updatedBy: "gAIa",
    settings: {
      attentionWindows: ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00"],
      defaultAttentionMode: "auto",
      defaultAutoLockMinutes: 10,
    },
    projects,
    tasks: [],
    tombstones: [],
    appliedChangeIds: [],
  };
}

export function createProject({
  id = createId(),
  name,
  color = "#8b7cf6",
  icon = "folder",
  order = 0,
  archived = false,
  outcome = "",
} = {}) {
  return { id, name: String(name || "").trim(), color, icon, order, archived, outcome };
}

export function createTask(input = {}, now = new Date()) {
  const timestamp = nowIso(now);
  const state = TASK_STATES.includes(input.state) ? input.state : "inbox";
  const horizon = TASK_HORIZONS.includes(input.horizon) ? input.horizon : "next";
  const priority = Number.isInteger(input.priority)
    ? Math.min(3, Math.max(0, input.priority))
    : 1;
  return {
    id: input.id || createId(),
    entityVersion: Number.isInteger(input.entityVersion) ? input.entityVersion : 1,
    title: String(input.title || "").trim(),
    notes: String(input.notes || ""),
    outcome: String(input.outcome || ""),
    nextAction: String(input.nextAction || ""),
    state,
    horizon,
    priority,
    projectId: input.projectId || null,
    tags: Array.isArray(input.tags) ? [...new Set(input.tags.map(String))] : [],
    contexts: Array.isArray(input.contexts) ? [...new Set(input.contexts.map(String))] : [],
    energy: ENERGY_LEVELS.includes(input.energy) ? input.energy : "medium",
    estimateMinutes: input.estimateMinutes !== null
      && input.estimateMinutes !== ""
      && Number.isFinite(Number(input.estimateMinutes))
      ? Math.min(1440, Math.max(0, Number(input.estimateMinutes)))
      : null,
    timing: {
      availableFrom: input.timing?.availableFrom || null,
      softTargetDate: input.timing?.softTargetDate || null,
      hardDeadlineAt: input.timing?.hardDeadlineAt || null,
      reviewAt: input.timing?.reviewAt || null,
      focusDate: input.timing?.focusDate || null,
    },
    attention: {
      mode: ATTENTION_MODES.includes(input.attention?.mode) ? input.attention.mode : "auto",
      muteUntil: input.attention?.muteUntil || null,
      pinnedUntil: input.attention?.pinnedUntil || null,
    },
    waiting: {
      for: input.waiting?.for ? String(input.waiting.for) : "",
      delegatedAt: input.waiting?.delegatedAt || null,
      followUpAt: input.waiting?.followUpAt || null,
    },
    blockedBy: Array.isArray(input.blockedBy) ? [...new Set(input.blockedBy.map(String))] : [],
    recurrence: input.recurrence || null,
    calendarRefs: Array.isArray(input.calendarRefs) ? input.calendarRefs.map(String) : [],
    minimumStep: String(input.minimumStep || ""),
    normalStep: String(input.normalStep || ""),
    fullStep: String(input.fullStep || ""),
    rank: String(input.rank || timestamp),
    origin: String(input.origin || "web"),
    createdAt: input.createdAt || timestamp,
    updatedAt: timestamp,
    completedAt: state === "done" ? input.completedAt || timestamp : null,
    lastMasterRevision: Number.isInteger(input.lastMasterRevision) ? input.lastMasterRevision : null,
  };
}

function validIsoOrNull(value) {
  return value === null || (
    typeof value === "string"
    && Number.isFinite(Date.parse(value))
  );
}

export function validateMaster(master) {
  const errors = [];
  if (!master || typeof master !== "object") {
    return ["Mastern måste vara ett objekt"];
  }
  if (master.type !== "gaia-task-dataset") errors.push("Fel dataset-typ");
  if (master.schemaVersion !== 1) errors.push("SchemaVersion måste vara 1");
  if (typeof master.datasetId !== "string" || master.datasetId.length < 8) errors.push("Ogiltigt datasetId");
  if (!Number.isInteger(master.masterRevision) || master.masterRevision < 1) errors.push("Ogiltig masterRevision");
  if (master.timeZone !== "Europe/Stockholm") errors.push("Tidszonen måste vara Europe/Stockholm");
  if (!Array.isArray(master.projects)) errors.push("projects måste vara en lista");
  if (!Array.isArray(master.tasks)) errors.push("tasks måste vara en lista");
  if (!Array.isArray(master.tombstones)) errors.push("tombstones måste vara en lista");

  const projectIds = new Set();
  for (const project of master.projects || []) {
    if (!project?.id || projectIds.has(project.id)) errors.push("Projekt-id saknas eller är duplicerat");
    projectIds.add(project.id);
    if (!String(project?.name || "").trim()) errors.push(`Projekt ${project?.id || "?"} saknar namn`);
  }

  const taskIds = new Set();
  for (const task of master.tasks || []) {
    if (!task?.id || taskIds.has(task.id)) errors.push("Task-id saknas eller är duplicerat");
    taskIds.add(task.id);
    if (!String(task?.title || "").trim()) errors.push(`Task ${task?.id || "?"} saknar titel`);
    if (!TASK_STATES.includes(task?.state)) errors.push(`Task ${task?.id || "?"} har ogiltig state`);
    if (!TASK_HORIZONS.includes(task?.horizon)) errors.push(`Task ${task?.id || "?"} har ogiltig horizon`);
    if (!Number.isInteger(task?.priority) || task.priority < 0 || task.priority > 3) {
      errors.push(`Task ${task?.id || "?"} har ogiltig prioritet`);
    }
    if (!ENERGY_LEVELS.includes(task?.energy)) errors.push(`Task ${task?.id || "?"} har ogiltig energi`);
    if (!ATTENTION_MODES.includes(task?.attention?.mode)) {
      errors.push(`Task ${task?.id || "?"} har ogiltig attention mode`);
    }
    if (!validIsoOrNull(task.attention?.muteUntil ?? null) || !validIsoOrNull(task.attention?.pinnedUntil ?? null)) {
      errors.push(`Task ${task?.id || "?"} har ogiltig attention-tid`);
    }
    if (task.projectId && !projectIds.has(task.projectId)) {
      errors.push(`Task ${task.id} hänvisar till okänt projekt`);
    }
    if (task.timing?.softTargetDate && !VALID_DATE.test(task.timing.softTargetDate)) {
      errors.push(`Task ${task.id} har ogiltigt mjukt måldatum`);
    }
    if (task.timing?.focusDate && !VALID_DATE.test(task.timing.focusDate)) {
      errors.push(`Task ${task.id} har ogiltigt fokusdatum`);
    }
    for (const field of ["availableFrom", "hardDeadlineAt", "reviewAt"]) {
      if (!validIsoOrNull(task.timing?.[field] ?? null)) {
        errors.push(`Task ${task.id} har ogiltigt ${field}`);
      }
    }
  }

  for (const task of master.tasks || []) {
    for (const blocker of task.blockedBy || []) {
      if (!taskIds.has(blocker) || blocker === task.id) {
        errors.push(`Task ${task.id} har ogiltigt beroende`);
      }
    }
  }
  return errors;
}

export async function computeMasterHash(master) {
  const copy = deepClone(master);
  copy.revisionHash = "";
  return sha256Hex(canonicalize(copy));
}

export async function finalizeMaster(master, {
  previousHash = master.revisionHash || null,
  increment = false,
  updatedBy = "gAIa",
  now = new Date(),
} = {}) {
  const next = deepClone(master);
  if (increment) next.masterRevision += 1;
  next.parentRevisionHash = increment ? previousHash : next.parentRevisionHash;
  next.updatedAt = nowIso(now);
  next.updatedBy = updatedBy;
  next.revisionHash = await computeMasterHash(next);
  return next;
}

function startOfLocalDate(now, timeZone = "Europe/Stockholm") {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isTaskActionable(task, now = new Date()) {
  if (!ACTIVE_STATES.has(task.state)) return false;
  if (task.attention?.muteUntil && Date.parse(task.attention.muteUntil) > now.getTime()) return false;
  if (task.timing?.availableFrom && Date.parse(task.timing.availableFrom) > now.getTime()) return false;
  if (task.state === "blocked" || task.state === "waiting" || (task.blockedBy?.length || 0) > 0) return false;
  return true;
}

export function explainTask(task, now = new Date(), timeZone = "Europe/Stockholm") {
  const nowMs = now.getTime();
  const today = startOfLocalDate(now, timeZone);
  const hardDeadline = task.timing?.hardDeadlineAt
    ? Date.parse(task.timing.hardDeadlineAt)
    : null;
  if (hardDeadline && hardDeadline <= nowMs) {
    return { score: 100, reason: "Skarp deadline har passerat", tone: "critical" };
  }
  if (hardDeadline && hardDeadline - nowMs <= 6 * 60 * 60 * 1000) {
    return { score: 94, reason: "Skarp deadline inom sex timmar", tone: "attention" };
  }
  if (hardDeadline && hardDeadline - nowMs <= 24 * 60 * 60 * 1000) {
    return { score: 88, reason: "Skarp deadline inom ett dygn", tone: "attention" };
  }
  if (task.waiting?.followUpAt && Date.parse(task.waiting.followUpAt) <= nowMs) {
    return { score: 82, reason: "Tid att följa upp", tone: "attention" };
  }
  if (task.timing?.reviewAt && Date.parse(task.timing.reviewAt) <= nowMs) {
    return { score: 78, reason: "Dags att granska igen", tone: "attention" };
  }
  if (task.timing?.focusDate === today) {
    return { score: 74, reason: "Vald för i dag", tone: "focus" };
  }
  if (task.timing?.softTargetDate && task.timing.softTargetDate <= today) {
    return { score: 64, reason: "Mjukt mål behöver planeras", tone: "neutral" };
  }
  if (task.attention?.pinnedUntil && Date.parse(task.attention.pinnedUntil) >= nowMs) {
    return { score: 76, reason: "Uttryckligen vald som fokus", tone: "focus" };
  }
  if (task.state === "inbox") {
    return { score: 24, reason: "Behöver klargöras", tone: "neutral" };
  }
  const priorityBoost = [0, 8, 16, 24][task.priority] || 0;
  return { score: 30 + priorityBoost, reason: "Handlingsbar nästa uppgift", tone: "neutral" };
}

export function rankActionableTasks(master, now = new Date()) {
  return (master.tasks || [])
    .filter((task) => isTaskActionable(task, now))
    .map((task) => {
      const explanation = explainTask(task, now, master.timeZone);
      const hardDeadline = task.timing?.hardDeadlineAt
        ? Date.parse(task.timing.hardDeadlineAt)
        : Number.POSITIVE_INFINITY;
      const deadlineRelevant = hardDeadline - now.getTime() <= 24 * 60 * 60 * 1000;
      return {
        task,
        ...explanation,
        score: task.attention?.mode === "low" && !deadlineRelevant
          ? explanation.score - 15
          : explanation.score,
        deadlineRelevant,
      };
    })
    .filter(({ task, deadlineRelevant }) => (
      task.attention?.mode !== "silent"
      && (task.attention?.mode !== "deadline-only" || deadlineRelevant)
    ))
    .sort((left, right) => (
      right.score - left.score
      || (left.task.estimateMinutes ?? 9999) - (right.task.estimateMinutes ?? 9999)
      || left.task.rank.localeCompare(right.task.rank)
    ));
}

export function taskCounts(master) {
  const counts = Object.fromEntries(TASK_STATES.map((state) => [state, 0]));
  for (const task of master.tasks || []) counts[task.state] = (counts[task.state] || 0) + 1;
  return counts;
}

export function replaceTask(master, task) {
  const next = deepClone(master);
  const index = next.tasks.findIndex((item) => item.id === task.id);
  if (index < 0) next.tasks.push(task);
  else next.tasks[index] = task;
  return next;
}

export function removeTaskToTombstone(master, taskId, now = new Date()) {
  const next = deepClone(master);
  const index = next.tasks.findIndex((task) => task.id === taskId);
  if (index < 0) return next;
  const [removed] = next.tasks.splice(index, 1);
  next.tombstones.push({
    id: taskId,
    deletedAt: nowIso(now),
    deletedInRevision: next.masterRevision,
    priorEntityHash: null,
    priorTitle: removed.title,
  });
  return next;
}
