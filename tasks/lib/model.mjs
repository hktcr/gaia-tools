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
export const COMMITMENT_CLASSES = ["must", "intend", "option", "idea"];
export const BEST_WINDOWS = ["morning", "midday", "afternoon", "evening"];
export const CURRENT_SCHEMA_VERSION = 2;
export const SUPPORTED_SCHEMA_VERSIONS = Object.freeze([1, CURRENT_SCHEMA_VERSION]);

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
    schemaVersion: CURRENT_SCHEMA_VERSION,
    datasetId,
    masterRevision: 1,
    parentRevisionHash: null,
    revisionHash: "",
    timeZone: "Europe/Stockholm",
    updatedAt: nowIso(now),
    updatedBy: "gAIa",
    settings: {
      attentionWindows: ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"],
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
    commitmentClass: COMMITMENT_CLASSES.includes(input.commitmentClass)
      ? input.commitmentClass
      : "intend",
    priority,
    projectId: input.projectId || null,
    tags: Array.isArray(input.tags) ? [...new Set(input.tags.map(String))] : [],
    contexts: Array.isArray(input.contexts) ? [...new Set(input.contexts.map(String))] : [],
    bestWindows: Array.isArray(input.bestWindows)
      ? [...new Set(input.bestWindows.filter((value) => BEST_WINDOWS.includes(value)))]
      : [],
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
      deadlineSource: String(input.timing?.deadlineSource || ""),
      reviewAt: input.timing?.reviewAt || null,
      focusDate: input.timing?.focusDate || null,
    },
    attention: {
      mode: ATTENTION_MODES.includes(input.attention?.mode) ? input.attention.mode : "auto",
      muteUntil: input.attention?.muteUntil || null,
      pinnedUntil: input.attention?.pinnedUntil || null,
      lastDeferralReason: String(input.attention?.lastDeferralReason || ""),
      lastDeferralAt: input.attention?.lastDeferralAt || null,
      deferralCount: Number.isInteger(input.attention?.deferralCount)
        ? Math.max(0, input.attention.deferralCount)
        : 0,
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

export function upgradeMasterSchema(master) {
  const next = deepClone(master);
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(next.schemaVersion)) {
    throw new Error("Masterversionen kan inte uppgraderas");
  }
  next.schemaVersion = CURRENT_SCHEMA_VERSION;
  next.settings = {
    ...next.settings,
    attentionWindows: [...new Set([
      ...(Array.isArray(next.settings?.attentionWindows) ? next.settings.attentionWindows : []),
      "20:00",
    ])],
  };
  next.tasks = (next.tasks || []).map((task) => ({
    ...task,
    commitmentClass: COMMITMENT_CLASSES.includes(task.commitmentClass) ? task.commitmentClass : "intend",
    bestWindows: Array.isArray(task.bestWindows)
      ? [...new Set(task.bestWindows.filter((value) => BEST_WINDOWS.includes(value)))]
      : [],
    timing: {
      ...task.timing,
      deadlineSource: String(task.timing?.deadlineSource || ""),
    },
    attention: {
      ...task.attention,
      lastDeferralReason: String(task.attention?.lastDeferralReason || ""),
      lastDeferralAt: task.attention?.lastDeferralAt || null,
      deferralCount: Number.isInteger(task.attention?.deferralCount)
        ? Math.max(0, task.attention.deferralCount)
        : 0,
    },
  }));
  return next;
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
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(master.schemaVersion)) {
    errors.push(`SchemaVersion måste vara ${SUPPORTED_SCHEMA_VERSIONS.join(" eller ")}`);
  }
  if (typeof master.datasetId !== "string" || master.datasetId.length < 8) errors.push("Ogiltigt datasetId");
  if (!Number.isInteger(master.masterRevision) || master.masterRevision < 1) errors.push("Ogiltig masterRevision");
  if (master.timeZone !== "Europe/Stockholm") errors.push("Tidszonen måste vara Europe/Stockholm");
  if (!Array.isArray(master.projects)) errors.push("projects måste vara en lista");
  if (!Array.isArray(master.tasks)) errors.push("tasks måste vara en lista");
  if (!Array.isArray(master.tombstones)) errors.push("tombstones måste vara en lista");
  if (
    master.schemaVersion === CURRENT_SCHEMA_VERSION
    && !master.settings?.attentionWindows?.includes("20:00")
  ) {
    errors.push("Schema 2 kräver uppmärksamhetsfönstret 20:00");
  }

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
    if (!COMMITMENT_CLASSES.includes(task?.commitmentClass || "intend")) {
      errors.push(`Task ${task?.id || "?"} har ogiltig åtagandeklass`);
    }
    if (master.schemaVersion === CURRENT_SCHEMA_VERSION && !COMMITMENT_CLASSES.includes(task?.commitmentClass)) {
      errors.push(`Task ${task?.id || "?"} saknar åtagandeklass för schema 2`);
    }
    if (!Number.isInteger(task?.priority) || task.priority < 0 || task.priority > 3) {
      errors.push(`Task ${task?.id || "?"} har ogiltig prioritet`);
    }
    if (!ENERGY_LEVELS.includes(task?.energy)) errors.push(`Task ${task?.id || "?"} har ogiltig energi`);
    if (task?.bestWindows !== undefined && (
      !Array.isArray(task.bestWindows)
      || task.bestWindows.some((value) => !BEST_WINDOWS.includes(value))
    )) {
      errors.push(`Task ${task?.id || "?"} har ogiltigt tidsfönster`);
    }
    if (master.schemaVersion === CURRENT_SCHEMA_VERSION && !Array.isArray(task?.bestWindows)) {
      errors.push(`Task ${task?.id || "?"} saknar tidsfönsterlista för schema 2`);
    }
    if (!ATTENTION_MODES.includes(task?.attention?.mode)) {
      errors.push(`Task ${task?.id || "?"} har ogiltig attention mode`);
    }
    if (
      !validIsoOrNull(task.attention?.muteUntil ?? null)
      || !validIsoOrNull(task.attention?.pinnedUntil ?? null)
      || !validIsoOrNull(task.attention?.lastDeferralAt ?? null)
    ) {
      errors.push(`Task ${task?.id || "?"} har ogiltig attention-tid`);
    }
    if (!Number.isInteger(task.attention?.deferralCount ?? 0) || (task.attention?.deferralCount ?? 0) < 0) {
      errors.push(`Task ${task?.id || "?"} har ogiltigt uppskjutningsantal`);
    }
    if (master.schemaVersion === CURRENT_SCHEMA_VERSION && (
      typeof task.timing?.deadlineSource !== "string"
      || typeof task.attention?.lastDeferralReason !== "string"
      || !("lastDeferralAt" in (task.attention || {}))
      || !Number.isInteger(task.attention?.deferralCount)
    )) {
      errors.push(`Task ${task?.id || "?"} saknar schema 2-metadata`);
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
    const availableAt = task.timing?.availableFrom ? Date.parse(task.timing.availableFrom) : null;
    const deadlineAt = task.timing?.hardDeadlineAt ? Date.parse(task.timing.hardDeadlineAt) : null;
    if (
      Number.isFinite(availableAt)
      && Number.isFinite(deadlineAt)
      && availableAt > deadlineAt
    ) {
      errors.push(`Task ${task.id} blir tillgänglig efter sin hårda deadline`);
    }
  }

  for (const task of master.tasks || []) {
    for (const blocker of task.blockedBy || []) {
      if (!taskIds.has(blocker) || blocker === task.id) {
        errors.push(`Task ${task.id} har ogiltigt beroende`);
      }
    }
  }
  const tasksById = new Map((master.tasks || []).map((task) => [task.id, task]));
  const visiting = new Set();
  const visited = new Set();
  function hasDependencyCycle(taskId) {
    if (visiting.has(taskId)) return true;
    if (visited.has(taskId)) return false;
    visiting.add(taskId);
    for (const blockerId of tasksById.get(taskId)?.blockedBy || []) {
      if (blockerId !== taskId && tasksById.has(blockerId) && hasDependencyCycle(blockerId)) return true;
    }
    visiting.delete(taskId);
    visited.add(taskId);
    return false;
  }
  if ([...tasksById.keys()].some((taskId) => hasDependencyCycle(taskId))) {
    errors.push("Taskberoenden innehåller en cykel");
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

export function unresolvedBlockers(master, task) {
  const tasks = new Map((master?.tasks || []).map((item) => [item.id, item]));
  return (task.blockedBy || []).filter((id) => {
    const blocker = tasks.get(id);
    return !blocker || blocker.state !== "done";
  });
}

export function isTaskActionable(task, now = new Date(), master = null) {
  if (["done", "cancelled", "trash"].includes(task.state)) return false;
  const hardDeadline = task.timing?.hardDeadlineAt ? Date.parse(task.timing.hardDeadlineAt) : Number.NaN;
  const deadlineRelevant = Number.isFinite(hardDeadline)
    && hardDeadline - now.getTime() <= 24 * 60 * 60 * 1000;
  const followUpDue = task.state === "waiting"
    && task.waiting?.followUpAt
    && Date.parse(task.waiting.followUpAt) <= now.getTime();
  const blockerResolved = task.state === "blocked"
    && master
    && (task.blockedBy?.length || 0) > 0
    && unresolvedBlockers(master, task).length === 0;
  if (!ACTIVE_STATES.has(task.state) && !followUpDue && !blockerResolved && !deadlineRelevant) return false;
  if (task.attention?.muteUntil && Date.parse(task.attention.muteUntil) > now.getTime()) return false;
  if (task.timing?.availableFrom && Date.parse(task.timing.availableFrom) > now.getTime()) return false;
  if (task.state === "blocked" && !blockerResolved && !deadlineRelevant) return false;
  if (task.state === "waiting" && !followUpDue && !deadlineRelevant) return false;
  if (master && unresolvedBlockers(master, task).length > 0 && !deadlineRelevant) return false;
  if (task.state === "inbox" && !String(task.nextAction || "").trim() && !deadlineRelevant) return false;
  return true;
}

function localHour(now, timeZone) {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now));
}

function windowForHour(hour) {
  if (hour < 10) return "morning";
  if (hour < 13) return "midday";
  if (hour < 18) return "afternoon";
  return "evening";
}

function energyFit(taskEnergy, currentEnergy) {
  const levels = { low: 0, medium: 1, high: 2 };
  if (!(currentEnergy in levels)) return 1;
  return levels[currentEnergy] >= levels[taskEnergy] ? 2 : 0;
}

export function chooseTaskStep(task, capsule = {}) {
  const minutes = Number(capsule.availableMinutes) || null;
  const fallback = task.nextAction
    ? { level: "next", label: "Nästa steg", text: task.nextAction }
    : { level: "clarify", label: "Klargör först", text: "Beskriv nästa konkreta handling." };
  if (!minutes) {
    if (task.fullStep) return { level: "full", label: "Hela steget", text: task.fullStep };
    if (task.normalStep) return { level: "normal", label: "Lagom steg", text: task.normalStep };
    if (task.minimumStep) return { level: "minimum", label: "Minsta steget", text: task.minimumStep };
    return fallback;
  }
  if (minutes <= 10) {
    return task.minimumStep
      ? { level: "minimum", label: "Minsta steget", text: task.minimumStep }
      : fallback;
  }
  if (minutes <= 35 && (task.normalStep || task.minimumStep)) {
    return {
      level: task.normalStep ? "normal" : "minimum",
      label: task.normalStep ? "Lagom steg" : "Minsta steget",
      text: task.normalStep || task.minimumStep,
    };
  }
  const estimateKnown = Number.isFinite(task.estimateMinutes) && task.estimateMinutes > 0;
  if (estimateKnown && task.estimateMinutes <= minutes && task.fullStep) {
    return { level: "full", label: "Hela steget", text: task.fullStep };
  }
  if (task.normalStep) return { level: "normal", label: "Lagom steg", text: task.normalStep };
  if (task.minimumStep) return { level: "minimum", label: "Minsta steget", text: task.minimumStep };
  return fallback;
}

export function explainTask(task, now = new Date(), timeZone = "Europe/Stockholm", master = null, capsule = {}) {
  const nowMs = now.getTime();
  const today = startOfLocalDate(now, timeZone);
  const activeBlockers = master ? unresolvedBlockers(master, task) : task.blockedBy || [];
  const unlocks = master
    ? master.tasks.filter((item) => (
      !["done", "cancelled", "trash"].includes(item.state)
      && unresolvedBlockers(master, item).includes(task.id)
    )).length
    : 0;
  const hardDeadline = task.timing?.hardDeadlineAt
    ? Date.parse(task.timing.hardDeadlineAt)
    : null;
  let need = 1;
  let reason = "Handlingsbar nästa uppgift";
  let tone = "neutral";
  if (hardDeadline && hardDeadline <= nowMs) {
    need = 8; reason = "Skarp deadline har passerat"; tone = "critical";
  } else if (hardDeadline && hardDeadline - nowMs <= 6 * 60 * 60 * 1000) {
    need = 7; reason = "Skarp deadline inom sex timmar"; tone = "attention";
  } else if (hardDeadline && hardDeadline - nowMs <= 24 * 60 * 60 * 1000) {
    need = 6; reason = "Skarp deadline inom ett dygn"; tone = "attention";
  } else if (task.state === "waiting" && task.waiting?.followUpAt && Date.parse(task.waiting.followUpAt) <= nowMs) {
    need = 6; reason = "Tid att följa upp"; tone = "attention";
  } else if (task.state === "blocked" && (task.blockedBy?.length || 0) > 0 && activeBlockers.length === 0) {
    need = 6; reason = "Blockeraren verkar vara löst"; tone = "attention";
  } else if (task.timing?.reviewAt && Date.parse(task.timing.reviewAt) <= nowMs) {
    need = 5; reason = "Dags att granska igen"; tone = "attention";
  } else if (task.attention?.pinnedUntil && Date.parse(task.attention.pinnedUntil) >= nowMs) {
    need = 5; reason = "Uttryckligen vald som fokus"; tone = "focus";
  } else if (task.timing?.focusDate === today) {
    need = 5; reason = "Vald för i dag"; tone = "focus";
  } else if (task.timing?.softTargetDate && task.timing.softTargetDate <= today) {
    need = 4; reason = "Mjukt mål behöver planeras";
  } else if (task.commitmentClass === "must") {
    need = 3; reason = "Bekräftat åtagande";
  }

  const currentWindow = windowForHour(localHour(now, timeZone));
  const windowFit = !task.bestWindows?.length || task.bestWindows.includes(currentWindow) ? 2 : 0;
  const durationFit = !capsule.availableMinutes || !task.estimateMinutes
    ? 1
    : task.estimateMinutes <= capsule.availableMinutes
      ? 2
      : task.minimumStep
        ? 1
        : 0;
  const contextFit = !capsule.context || !task.contexts?.length
    ? 1
    : task.contexts.includes(capsule.context)
      ? 2
      : 0;
  const fit = energyFit(task.energy, capsule.energy) + windowFit + durationFit + contextFit;
  const commitment = { must: 4, intend: 3, option: 2, idea: 1 }[task.commitmentClass] || 3;
  const priority = Number.isInteger(task.priority) ? Math.min(3, Math.max(0, task.priority)) : 1;
  const step = chooseTaskStep(task, capsule);
  const incompleteEvidence = Boolean(
    (hardDeadline && !task.timing?.deadlineSource)
    || (capsule.availableMinutes && !task.estimateMinutes)
    || (capsule.context && !task.contexts?.length)
  );
  const why = [reason];
  if (capsule.availableMinutes && step.level === "minimum") {
    why.push("minsta tillgängliga steg valdes för det korta tidsfönstret");
  }
  if (capsule.context && task.contexts?.includes(capsule.context)) why.push(`passar sammanhanget ${capsule.context}`);
  if (unlocks) why.push(`låser upp ${unlocks} ${unlocks === 1 ? "annan uppgift" : "andra uppgifter"}`);
  if (priority >= 2) why.push("uttryckligen markerad som viktig");
  return {
    score: need * 1000 + fit * 100 + priority * 50 + unlocks * 10 + commitment,
    reason,
    why,
    tone,
    need,
    fit,
    leverage: unlocks,
    priority,
    commitment,
    confidence: incompleteEvidence ? "medium" : "high",
    step,
    currentWindow,
  };
}

export function rankActionableTasks(master, now = new Date(), capsule = {}) {
  return (master.tasks || [])
    .filter((task) => isTaskActionable(task, now, master))
    .map((task) => {
      const explanation = explainTask(task, now, master.timeZone, master, capsule);
      const hardDeadline = task.timing?.hardDeadlineAt
        ? Date.parse(task.timing.hardDeadlineAt)
        : Number.POSITIVE_INFINITY;
      const deadlineRelevant = hardDeadline - now.getTime() <= 24 * 60 * 60 * 1000;
      return {
        task,
        ...explanation,
        score: task.attention?.mode === "low" && !deadlineRelevant
          ? explanation.score - 2000
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

function suppressionReason(master, task, now) {
  if (["done", "cancelled", "trash"].includes(task.state)) return "terminal";
  if (task.attention?.mode === "silent") return "silent";
  if (task.attention?.muteUntil && Date.parse(task.attention.muteUntil) > now.getTime()) return "muted";
  if (task.timing?.availableFrom && Date.parse(task.timing.availableFrom) > now.getTime()) return "not-available";
  if (unresolvedBlockers(master, task).length) return "blocked";
  if (task.state === "waiting" && (!task.waiting?.followUpAt || Date.parse(task.waiting.followUpAt) > now.getTime())) return "waiting";
  if (task.state === "inbox" && !String(task.nextAction || "").trim()) return "needs-clarification";
  if (task.attention?.mode === "deadline-only") return "deadline-only";
  return "not-relevant-now";
}

export function evaluateAttentionContract(master, now = new Date(), capsule = {}, visibleLimit = 3) {
  const ranked = rankActionableTasks(master, now, capsule);
  const limit = Math.max(1, visibleLimit);
  const visible = ranked.slice(0, limit);
  const visibleIds = new Set(visible.map((item) => item.task.id));
  const rankedIds = new Set(ranked.map((item) => item.task.id));
  const suppressed = (master.tasks || [])
    .filter((task) => !visibleIds.has(task.id))
    .map((task) => ({
      taskId: task.id,
      reason: rankedIds.has(task.id) ? "attention-budget" : suppressionReason(master, task, now),
    }));
  return {
    decision: visible.length ? "candidate" : "quiet",
    focus: visible[0] || null,
    inSight: visible.slice(1),
    hiddenCount: suppressed.filter((item) => item.reason !== "terminal").length,
    suppressed,
  };
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
