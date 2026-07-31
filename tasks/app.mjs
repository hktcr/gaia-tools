import { decryptLocalRecord, decryptVault, encryptLocalRecord } from "./lib/crypto.mjs";
import {
  createProject,
  createTask,
  rankActionableTasks,
  replaceTask,
  taskCounts,
  validateMaster,
} from "./lib/model.mjs";
import {
  buildProjectOperation,
  buildTaskOperation,
  createRevisionPayload,
  encodeRevision,
} from "./lib/revision.mjs";
import { safeJsonParse, sha256Hex } from "./lib/codec.mjs";
import {
  clearEncryptedLocal,
  getOrCreateDeviceId,
  loadEncryptedLocal,
  loadUiSettings,
  saveEncryptedLocal,
  saveUiSettings,
} from "./lib/store.mjs";

const VIEW_COPY = {
  now: ["Ditt lugna nästa steg", "Nu"],
  today: ["En realistisk dag", "Idag"],
  inbox: ["Fånga först, klargör sedan", "Inkorg"],
  tasks: ["Hela systemet", "Uppgifter"],
  projects: ["Resultat som kräver flera steg", "Projekt"],
  changes: ["Lokal kö till gAIa", "Ändringar"],
};

const STATE_LABELS = {
  inbox: "Inkorg",
  ready: "Redo",
  doing: "Pågår",
  waiting: "Väntar",
  blocked: "Blockerad",
  done: "Klar",
  cancelled: "Avbruten",
  trash: "Papperskorg",
};

const OPERATION_LABELS = {
  "task.create": "Ny",
  "task.update": "Ändrad",
  "task.complete": "Klar",
  "task.delete": "Borttagen",
  "task.move": "Flyttad",
  "project.create": "Nytt projekt",
  "project.update": "Projekt",
  "project.delete": "Projekt bort",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clone = (value) => structuredClone(value);

const dom = {
  lockScreen: $("#lock-screen"),
  appShell: $("#app-shell"),
  loadingStatus: $("#loading-status"),
  unlockForm: $("#unlock-form"),
  unlockButton: $("#unlock-button"),
  unlockError: $("#unlock-error"),
  password: $("#password"),
  viewKicker: $("#view-kicker"),
  viewTitle: $("#view-title"),
  revisionStatus: $("#revision-status"),
  localStatus: $("#local-status"),
  networkStatus: $("#network-status"),
  staleBanner: $("#stale-banner"),
  inboxCount: $("#inbox-count"),
  changeCount: $("#change-count"),
  taskDialog: $("#task-dialog"),
  taskForm: $("#task-form"),
  projectDialog: $("#project-dialog"),
  projectForm: $("#project-form"),
  revisionDialog: $("#revision-dialog"),
  revisionCode: $("#revision-code"),
  snackbar: $("#snackbar"),
  snackbarMessage: $("#snackbar-message"),
  snackbarAction: $("#snackbar-action"),
  liveRegion: $("#live-region"),
};

let vaultEnvelope = null;
let publishedMaster = null;
let baseMaster = null;
let workingMaster = null;
let operations = [];
let dataKey = null;
let deviceId = null;
let currentView = "now";
let staleBase = false;
let undoHistory = [];
let lastRevisionCode = "";
let lockDeadline = 0;
let snackbarTimer = null;
let dialogOpener = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className, attributes = {}) {
  const node = element("button", className, text);
  node.type = "button";
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: workingMaster?.timeZone || "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function formatDate(value, withTime = false) {
  if (!value) return "";
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: workingMaster?.timeZone || "Europe/Stockholm",
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function projectFor(task) {
  return workingMaster.projects.find((project) => project.id === task.projectId) || null;
}

function taskById(id) {
  return workingMaster.tasks.find((task) => task.id === id) || null;
}

function operationTitle(operation) {
  if (operation.type.startsWith("task.")) {
    const task = taskById(operation.taskId);
    return task?.title || operation.set?.title || "Uppgift";
  }
  const project = workingMaster.projects.find((item) => item.id === operation.projectId);
  return project?.name || operation.set?.name || "Projekt";
}

function emptyState(title, description, actionText = "Lägg till en uppgift") {
  const outer = element("div", "empty-state");
  const inner = element("div", "empty-state-inner");
  const icon = element("div", "empty-icon", "✦");
  const heading = element("h3", "", title);
  const copy = element("p", "", description);
  const action = button(actionText, "button button-primary", { "data-add-state": "inbox" });
  inner.append(icon, heading, copy, action);
  outer.append(inner);
  return outer;
}

function taskCard(task, reason = "") {
  const card = element("article", `task-card${task.state === "done" ? " is-done" : ""}`);
  card.dataset.taskId = task.id;

  const complete = button(task.state === "done" ? "↶" : "✓", "complete-button", {
    "data-complete-task": task.id,
    "aria-label": task.state === "done" ? `Återöppna ${task.title}` : `Markera ${task.title} som klar`,
  });
  if (["trash", "cancelled"].includes(task.state)) complete.disabled = true;

  const body = button("", "task-body-button", {
    "data-edit-task": task.id,
    "aria-label": `Redigera ${task.title}`,
  });
  body.append(element("span", "task-title", task.title));
  const meta = element("span", "task-meta");
  const project = projectFor(task);
  if (project) {
    const projectMeta = element("span");
    const dot = element("span", "project-dot");
    dot.style.setProperty("--project-color", project.color);
    projectMeta.append(dot, document.createTextNode(project.name));
    meta.append(projectMeta);
  }
  meta.append(element("span", "", STATE_LABELS[task.state] || task.state));
  if (task.estimateMinutes) meta.append(element("span", "", `${task.estimateMinutes} min`));
  if (task.timing?.hardDeadlineAt) {
    meta.append(element("span", "meta-reason", `Deadline ${formatDate(task.timing.hardDeadlineAt, true)}`));
  } else if (task.timing?.softTargetDate) {
    meta.append(element("span", "", `Mål ${formatDate(task.timing.softTargetDate)}`));
  }
  if (reason) meta.append(element("span", "meta-reason", reason));
  body.append(meta);

  const edit = button("•••", "icon-button task-menu-button", {
    "data-edit-task": task.id,
    "aria-label": `Fler val för ${task.title}`,
  });
  card.append(complete, body, edit);
  return card;
}

function taskList(tasks, reasons = new Map()) {
  const list = element("div", "task-list");
  for (const task of tasks) list.append(taskCard(task, reasons.get(task.id) || ""));
  return list;
}

function renderNow() {
  const root = $("#now-content");
  root.replaceChildren();
  const ranked = rankActionableTasks(workingMaster);
  const counts = taskCounts(workingMaster);
  const hero = element("div", "hero-grid");
  const focus = element("section", "focus-panel");
  const focusItem = ranked[0];

  if (focusItem) {
    focus.append(element("span", "focus-label", "Föreslaget nästa fokus"));
    focus.append(element("h3", "", focusItem.task.title));
    focus.append(element("p", "focus-next", focusItem.task.nextAction || "Öppna uppgiften och välj minsta möjliga nästa steg."));
    focus.append(element("p", "focus-reason", `✦ ${focusItem.reason}`));
    const actions = element("div", "focus-actions");
    actions.append(
      button("Markera klar", "button button-primary", { "data-complete-task": focusItem.task.id }),
      button("Öppna", "button button-secondary", { "data-edit-task": focusItem.task.id }),
    );
    focus.append(actions);
  } else {
    focus.append(element("span", "focus-label", "Lugnt läge"));
    focus.append(element("h3", "", "Inget kräver din uppmärksamhet just nu."));
    focus.append(element("p", "focus-next", "Fånga något nytt om du vill, eller låt systemet vara tyst."));
    const actions = element("div", "focus-actions");
    actions.append(button("Lägg till uppgift", "button button-primary", { "data-add-state": "inbox" }));
    focus.append(actions);
  }

  const metrics = element("aside", "quiet-panel");
  metrics.append(
    element("h3", "", "Systempuls"),
    element("p", "", "En överblick utan att allt blir bråttom."),
  );
  const stack = element("div", "metric-stack");
  for (const [label, value] of [
    ["Handlingsbara", ranked.length],
    ["I inkorgen", counts.inbox || 0],
    ["Väntar", counts.waiting || 0],
  ]) {
    const row = element("div", "metric");
    row.append(element("span", "", label), element("strong", "", String(value)));
    stack.append(row);
  }
  metrics.append(stack);
  hero.append(focus, metrics);
  root.append(hero);

  const attention = element("section", "attention-section");
  const heading = element("div", "subheading");
  const headingLeft = element("div");
  headingLeft.append(element("h3", "", "Därefter"), element("p", "", "Högst tre andra saker att hålla i sikte."));
  heading.append(headingLeft);
  attention.append(heading);
  const next = ranked.slice(1, 4);
  if (next.length) {
    attention.append(taskList(next.map((item) => item.task), new Map(next.map((item) => [item.task.id, item.reason]))));
  } else {
    attention.append(element("div", "quiet-panel", "Inget mer behöver lyftas fram."));
  }
  root.append(attention);
}

function renderToday() {
  const root = $("#today-content");
  const today = todayKey();
  const tasks = workingMaster.tasks
    .filter((task) => !["done", "cancelled", "trash"].includes(task.state))
    .filter((task) => (
      task.timing?.focusDate === today
      || task.timing?.softTargetDate === today
      || (task.timing?.hardDeadlineAt && todayKey(new Date(task.timing.hardDeadlineAt)) === today)
      || (task.attention?.pinnedUntil && Date.parse(task.attention.pinnedUntil) >= Date.now())
    ));
  root.replaceChildren(tasks.length
    ? taskList(tasks)
    : emptyState("Dagen är inte överlastad", "Välj bara en uppgift som fokus om det faktiskt hjälper.", "Lägg till något för idag"));
}

function renderInbox() {
  const root = $("#inbox-content");
  const tasks = workingMaster.tasks.filter((task) => task.state === "inbox");
  root.replaceChildren(tasks.length
    ? taskList(tasks)
    : emptyState("Inkorgen är tom", "Nya tankar kan fångas här utan att direkt bli en deadline."));
}

function renderTasks() {
  const search = $("#task-search").value.trim().toLocaleLowerCase("sv");
  const state = $("#state-filter").value;
  const projectId = $("#project-filter").value;
  let tasks = [...workingMaster.tasks];
  if (state === "active") tasks = tasks.filter((task) => !["done", "cancelled", "trash"].includes(task.state));
  else if (state !== "all") tasks = tasks.filter((task) => task.state === state);
  if (projectId) tasks = tasks.filter((task) => task.projectId === projectId);
  if (search) {
    tasks = tasks.filter((task) => {
      const project = projectFor(task);
      return [task.title, task.notes, task.nextAction, project?.name]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase("sv").includes(search));
    });
  }
  tasks.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const root = $("#tasks-content");
  if (tasks.length) {
    root.replaceChildren(taskList(tasks));
    return;
  }
  const empty = emptyState("Inga uppgifter matchar", "Justera filtren eller skapa en ny uppgift.");
  if (search || state !== "active" || projectId) {
    empty.querySelector(".empty-state-inner").append(
      button("Rensa filter", "button button-secondary", { "data-clear-filters": "" }),
    );
  }
  root.replaceChildren(empty);
}

function renderProjects() {
  const root = $("#projects-content");
  root.replaceChildren();
  const projects = workingMaster.projects.filter((project) => !project.archived);
  if (!projects.length) {
    root.append(emptyState("Inga projekt ännu", "Skapa ett projekt när ett resultat behöver flera steg.", "Skapa projekt"));
    root.querySelector("[data-add-state]")?.setAttribute("data-add-project", "");
    root.querySelector("[data-add-state]")?.removeAttribute("data-add-state");
    return;
  }
  for (const project of projects) {
    const tasks = workingMaster.tasks.filter((task) => task.projectId === project.id);
    const open = tasks.filter((task) => !["done", "cancelled", "trash"].includes(task.state)).length;
    const done = tasks.filter((task) => task.state === "done").length;
    const card = element("article", "project-card");
    card.style.setProperty("--project-color", project.color);
    card.append(
      element("h4", "", project.name),
      element("p", "", project.outcome || "Inget önskat resultat beskrivet ännu."),
    );
    const stats = element("div", "project-stats");
    stats.append(element("span", "", `${open} öppna`), element("span", "", `${done} klara`));
    card.append(stats);
    root.append(card);
  }
}

function renderChanges() {
  const root = $("#changes-content");
  root.replaceChildren();
  const layout = element("div", "change-layout");
  const listPanel = element("section", "change-panel");
  listPanel.append(
    element("h4", "", operations.length ? `${operations.length} lokala ändringar` : "Inga lokala ändringar"),
    element("p", "", operations.length
      ? "De syns bara på den här enheten och ingår ännu inte i påminnelserna."
      : "Den här enheten följer den publicerade mastern."),
  );
  if (operations.length) {
    const list = element("ul", "change-list");
    for (const operation of operations) {
      const item = element("li", "change-item");
      item.append(
        element("span", "change-type", OPERATION_LABELS[operation.type] || "Ändring"),
        element("div"),
      );
      item.lastElementChild.append(
        element("strong", "", operationTitle(operation)),
        element("small", "", formatDate(operation.createdAt, true)),
      );
      list.append(item);
    }
    listPanel.append(list);
  }

  const syncPanel = element("aside", "change-panel");
  syncPanel.append(
    element("h4", "", "Skicka till gAIa"),
    element("p", "", "Revideringskoden innehåller bara ändringsoperationer, inte hela taskmastern."),
  );
  const steps = element("ol", "sync-steps");
  for (const text of [
    "Exportera koden på den här enheten.",
    "Klistra in den i chatten med gAIa.",
    "gAIa granskar konflikter och uppdaterar mastern.",
    "Lås upp sidan igen när den nya revisionen är publicerad.",
  ]) steps.append(element("li", "", text));
  syncPanel.append(steps);
  const exportButton = button(
    operations.length ? "Exportera revideringskod" : "Inget att exportera",
    "button button-primary",
    { id: "export-revision-button" },
  );
  exportButton.disabled = operations.length === 0;
  syncPanel.append(exportButton);
  layout.append(listPanel, syncPanel);
  root.append(layout);
}

function populateProjectSelects() {
  const selects = [$("#task-project"), $("#project-filter")];
  for (const select of selects) {
    const selected = select.value;
    const firstLabel = select.id === "task-project" ? "Inget projekt" : "Alla projekt";
    select.replaceChildren(new Option(firstLabel, ""));
    for (const project of workingMaster.projects.filter((item) => !item.archived)) {
      select.append(new Option(project.name, project.id));
    }
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  }
}

function renderAll() {
  populateProjectSelects();
  const counts = taskCounts(workingMaster);
  dom.inboxCount.textContent = String(counts.inbox || 0);
  dom.changeCount.textContent = operations.length ? String(operations.length) : "";
  dom.revisionStatus.textContent = staleBase
    ? `Publicerad r${publishedMaster.masterRevision}, visar lokalt utkast från r${baseMaster.masterRevision}`
    : `Master r${publishedMaster.masterRevision}`;
  dom.localStatus.textContent = operations.length
    ? `${operations.length} lokala ändringar, ej i påminnelser`
    : "Inga lokala ändringar";
  dom.localStatus.classList.toggle("has-changes", operations.length > 0);
  dom.staleBanner.hidden = !staleBase;
  renderNow();
  renderToday();
  renderInbox();
  renderTasks();
  renderProjects();
  renderChanges();
}

function setView(view, focusMain = false) {
  if (!(view in VIEW_COPY)) return;
  currentView = view;
  const [kicker, title] = VIEW_COPY[view];
  dom.viewKicker.textContent = kicker;
  dom.viewTitle.textContent = title;
  $$("[data-view-panel]").forEach((panel) => panel.classList.toggle("is-visible", panel.dataset.viewPanel === view));
  $$("[data-view]").forEach((item) => item.classList.toggle("is-active", item.dataset.view === view));
  window.history.replaceState(null, "", `#${view}`);
  if (view === "tasks") renderTasks();
  if (focusMain) $("#main-content").focus();
}

function showSnackbar(message, allowUndo = false) {
  clearTimeout(snackbarTimer);
  dom.snackbarMessage.textContent = message;
  dom.snackbarAction.hidden = !allowUndo;
  dom.snackbar.hidden = false;
  snackbarTimer = setTimeout(() => {
    dom.snackbar.hidden = true;
  }, 6000);
}

function rememberForUndo() {
  undoHistory.push({ workingMaster: clone(workingMaster), operations: clone(operations) });
  undoHistory = undoHistory.slice(-10);
}

async function persistLocal() {
  if (!operations.length) {
    await clearEncryptedLocal(workingMaster.datasetId);
    return;
  }
  const record = {
    type: "gaia-task-local-record",
    datasetId: workingMaster.datasetId,
    baseMasterRevision: baseMaster.masterRevision,
    baseSnapshotHash: baseMaster.revisionHash,
    baseMasterSnapshot: baseMaster,
    operations,
    workingSnapshot: workingMaster,
    savedAt: new Date().toISOString(),
  };
  await saveEncryptedLocal(
    workingMaster.datasetId,
    await encryptLocalRecord(record, dataKey),
  );
}

async function afterMutation(message) {
  await persistLocal();
  renderAll();
  showSnackbar(message, true);
}

function endOfTodayIso() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function openTaskDialog(task = null, initialState = "inbox") {
  dialogOpener = document.activeElement;
  dom.taskForm.reset();
  $("#task-id").value = task?.id || "";
  $("#task-dialog-title").textContent = task ? "Redigera uppgift" : "Ny uppgift";
  $("#delete-task-button").hidden = !task;
  $("#task-title").value = task?.title || "";
  $("#task-next-action").value = task?.nextAction || "";
  $("#task-state").value = task?.state || initialState;
  $("#task-horizon").value = task?.horizon || "next";
  $("#task-project").value = task?.projectId || "";
  $("#task-priority").value = String(task?.priority ?? 1);
  $("#task-soft-target").value = task?.timing?.softTargetDate || "";
  $("#task-hard-deadline").value = toDatetimeLocal(task?.timing?.hardDeadlineAt);
  $("#task-estimate").value = task?.estimateMinutes ?? "";
  $("#task-energy").value = task?.energy || "medium";
  $("#task-attention").value = task?.attention?.mode || "auto";
  $("#task-pinned").checked = Boolean(task?.attention?.pinnedUntil && Date.parse(task.attention.pinnedUntil) >= Date.now());
  $("#task-review-at").value = toDatetimeLocal(task?.timing?.reviewAt);
  $("#task-waiting-for").value = task?.waiting?.for || "";
  $("#task-notes").value = task?.notes || "";
  dom.taskDialog.showModal();
  requestAnimationFrame(() => $("#task-title").focus());
}

async function saveTaskFromForm() {
  const id = $("#task-id").value;
  const before = id ? taskById(id) : null;
  const hardDeadline = $("#task-hard-deadline").value;
  const reviewAt = $("#task-review-at").value;
  const waitingFor = $("#task-waiting-for");
  if ($("#task-state").value === "waiting" && !waitingFor.value.trim()) {
    waitingFor.setCustomValidity("Beskriv vem eller vad uppgiften väntar på.");
    waitingFor.reportValidity();
    waitingFor.focus();
    return;
  }
  waitingFor.setCustomValidity("");
  const next = createTask({
    ...(before || {}),
    id: before?.id,
    entityVersion: before?.entityVersion,
    createdAt: before?.createdAt,
    completedAt: before?.completedAt,
    title: $("#task-title").value,
    nextAction: $("#task-next-action").value,
    state: $("#task-state").value,
    horizon: $("#task-horizon").value,
    projectId: $("#task-project").value || null,
    priority: Number($("#task-priority").value),
    estimateMinutes: $("#task-estimate").value === "" ? null : Number($("#task-estimate").value),
    energy: $("#task-energy").value,
    notes: $("#task-notes").value,
    timing: {
      ...(before?.timing || {}),
      softTargetDate: $("#task-soft-target").value || null,
      hardDeadlineAt: hardDeadline ? new Date(hardDeadline).toISOString() : null,
      reviewAt: reviewAt ? new Date(reviewAt).toISOString() : null,
      focusDate: $("#task-pinned").checked ? todayKey() : null,
    },
    attention: {
      ...(before?.attention || {}),
      mode: $("#task-attention").value,
      pinnedUntil: $("#task-pinned").checked ? endOfTodayIso() : null,
    },
    waiting: {
      ...(before?.waiting || {}),
      for: waitingFor.value,
    },
    origin: before?.origin || "web",
  });
  if (!next.title) return;
  rememberForUndo();
  const operation = await buildTaskOperation(before ? "task.update" : "task.create", before, next);
  workingMaster = replaceTask(workingMaster, next);
  operations.push(operation);
  dom.taskDialog.close();
  await afterMutation(before ? "Uppgiften ändrades lokalt." : "Uppgiften lades till lokalt.");
}

async function completeTask(id) {
  const before = taskById(id);
  if (!before || ["trash", "cancelled"].includes(before.state)) return;
  rememberForUndo();
  const next = createTask({
    ...before,
    id: before.id,
    entityVersion: before.entityVersion,
    createdAt: before.createdAt,
    state: before.state === "done" ? "ready" : "done",
    completedAt: before.state === "done" ? null : new Date().toISOString(),
  });
  const type = next.state === "done" ? "task.complete" : "task.update";
  operations.push(await buildTaskOperation(type, before, next));
  workingMaster = replaceTask(workingMaster, next);
  await afterMutation(next.state === "done" ? "Markerad som klar lokalt." : "Uppgiften återöppnades lokalt.");
}

async function deleteCurrentTask() {
  const before = taskById($("#task-id").value);
  if (!before) return;
  rememberForUndo();
  const next = createTask({
    ...before,
    id: before.id,
    entityVersion: before.entityVersion,
    createdAt: before.createdAt,
    state: "trash",
  });
  operations.push(await buildTaskOperation("task.delete", before, next));
  workingMaster = replaceTask(workingMaster, next);
  dom.taskDialog.close();
  await afterMutation("Uppgiften lades i papperskorgen lokalt.");
}

async function saveProjectFromForm() {
  const project = createProject({
    name: $("#project-name").value,
    outcome: $("#project-outcome").value,
    color: $("#project-color").value,
    order: workingMaster.projects.length,
  });
  if (!project.name) return;
  rememberForUndo();
  operations.push(await buildProjectOperation("project.create", null, project));
  workingMaster = clone(workingMaster);
  workingMaster.projects.push(project);
  dom.projectDialog.close();
  await afterMutation("Projektet skapades lokalt.");
}

async function undoLastMutation() {
  const previous = undoHistory.pop();
  if (!previous) return;
  workingMaster = previous.workingMaster;
  operations = previous.operations;
  await persistLocal();
  renderAll();
  dom.snackbar.hidden = true;
  dom.liveRegion.textContent = "Den senaste lokala ändringen ångrades.";
}

async function exportRevision() {
  if (!operations.length) return;
  const payload = await createRevisionPayload({
    baseMaster,
    workingMaster,
    operations,
    sourceDeviceId: deviceId,
    dataKey,
  });
  lastRevisionCode = await encodeRevision(payload);
  dom.revisionCode.value = lastRevisionCode;
  dom.revisionDialog.showModal();
}

async function copyRevision() {
  if (!lastRevisionCode) return;
  try {
    await navigator.clipboard.writeText(lastRevisionCode);
    showSnackbar("Revideringskoden kopierades.");
  } catch {
    dom.revisionCode.focus();
    dom.revisionCode.select();
    showSnackbar("Markera och kopiera koden manuellt.");
  }
}

function downloadRevision() {
  if (!lastRevisionCode) return;
  const link = document.createElement("a");
  const blob = new Blob([lastRevisionCode], { type: "text/plain;charset=utf-8" });
  link.href = URL.createObjectURL(blob);
  link.download = `gaia-revision-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const settings = loadUiSettings();
  saveUiSettings({ ...settings, theme });
}

function resetLockTimer() {
  if (!dataKey) return;
  lockDeadline = Date.now() + (workingMaster?.settings?.defaultAutoLockMinutes || 10) * 60_000;
}

function lockApp() {
  dataKey = null;
  baseMaster = null;
  workingMaster = null;
  publishedMaster = null;
  operations = [];
  undoHistory = [];
  lastRevisionCode = "";
  lockDeadline = 0;
  dom.password.value = "";
  dom.appShell.hidden = true;
  dom.lockScreen.hidden = false;
  dom.unlockError.textContent = "";
  dom.loadingStatus.textContent = "Krypterad master redo.";
  dom.password.focus();
}

async function loadLocalOverlay(master, unlockedDataKey) {
  const envelope = await loadEncryptedLocal(master.datasetId);
  if (!envelope) {
    return { base: master, working: master, operations: [], stale: false };
  }
  try {
    const record = await decryptLocalRecord(envelope, unlockedDataKey);
    const applied = new Set(master.appliedChangeIds || []);
    if (
      record.baseMasterRevision < master.masterRevision
      && record.operations.every((operation) => applied.has(operation.opId))
    ) {
      await clearEncryptedLocal(master.datasetId);
      return { base: master, working: master, operations: [], stale: false };
    }
    const errors = validateMaster(record.workingSnapshot);
    if (
      errors.length
      || record.datasetId !== master.datasetId
      || !record.baseMasterSnapshot
      || record.baseMasterSnapshot.masterRevision !== record.baseMasterRevision
    ) throw new Error("Ogiltig lokal overlay");
    return {
      base: record.baseMasterSnapshot,
      working: record.workingSnapshot,
      operations: record.operations,
      stale: record.baseMasterRevision !== master.masterRevision,
    };
  } catch {
    throw new Error("Lokala ändringar kunde inte läsas. Rensa inte webbplatsens data innan de har räddats.");
  }
}

async function unlock(password) {
  const unlocked = await decryptVault(vaultEnvelope, password);
  const overlay = await loadLocalOverlay(unlocked.master, unlocked.dataKey);
  publishedMaster = unlocked.master;
  baseMaster = overlay.base;
  workingMaster = overlay.working;
  operations = overlay.operations;
  staleBase = overlay.stale;
  dataKey = unlocked.dataKey;
  deviceId = getOrCreateDeviceId();
  currentView = location.hash.slice(1) in VIEW_COPY ? location.hash.slice(1) : "now";
  renderAll();
  setView(currentView);
  dom.lockScreen.hidden = true;
  dom.appShell.hidden = false;
  dom.password.value = "";
  resetLockTimer();
}

async function loadVault() {
  dom.loadingStatus.textContent = "Hämtar krypterad master...";
  const manifestResponse = await fetch("./data/manifest.json", { cache: "no-store" });
  if (!manifestResponse.ok) throw new Error("Kunde inte hämta vault-manifestet");
  const manifest = await manifestResponse.json();
  if (
    manifest?.type !== "gaia-task-public-manifest"
    || !/^\.\/tasks\.[a-f0-9]{24}\.vault\.json$/u.test(manifest.vaultFile)
  ) throw new Error("Vault-manifestet är ogiltigt");
  const vaultResponse = await fetch(`./data/${manifest.vaultFile.slice(2)}`, { cache: "no-store" });
  if (!vaultResponse.ok) throw new Error("Kunde inte hämta den krypterade mastern");
  if (!/^[a-f0-9]{64}$/u.test(manifest.vaultSha256)) throw new Error("Vault-hashen är ogiltig");
  const vaultText = await vaultResponse.text();
  if (await sha256Hex(vaultText) !== manifest.vaultSha256) {
    throw new Error("Den krypterade mastern klarade inte integritetskontrollen");
  }
  vaultEnvelope = safeJsonParse(vaultText);
  dom.loadingStatus.textContent = `Krypterad master r${vaultEnvelope.masterRevision} redo.`;
}

function updateNetworkStatus() {
  dom.networkStatus.textContent = navigator.onLine
    ? "Online"
    : dataKey
      ? "Offline, upplåst vy fungerar"
      : "Offline, ny upplåsning kräver nät";
}

function wireEvents() {
  document.addEventListener("click", async (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) setView(viewButton.dataset.view, true);
    const jumpButton = event.target.closest("[data-view-jump]");
    if (jumpButton) setView(jumpButton.dataset.viewJump, true);
    const addButton = event.target.closest("[data-add-state]");
    if (addButton) openTaskDialog(null, addButton.dataset.addState || "inbox");
    const editButton = event.target.closest("[data-edit-task]");
    if (editButton) openTaskDialog(taskById(editButton.dataset.editTask));
    const completeButton = event.target.closest("[data-complete-task]");
    if (completeButton) await completeTask(completeButton.dataset.completeTask);
    if (event.target.closest("[data-add-project]")) dom.projectDialog.showModal();
    if (event.target.closest("[data-clear-filters]")) {
      $("#task-search").value = "";
      $("#state-filter").value = "active";
      $("#project-filter").value = "";
      renderTasks();
    }
    if (event.target.closest("[data-close-dialog]")) event.target.closest("dialog")?.close();
    if (event.target.closest("#export-revision-button")) await exportRevision();
  });

  dom.unlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    dom.unlockError.textContent = "";
    dom.unlockButton.disabled = true;
    try {
      await unlock(dom.password.value);
    } catch (error) {
      dom.unlockError.textContent = error.message;
    } finally {
      dom.unlockButton.disabled = false;
    }
  });
  $("#toggle-password").addEventListener("click", () => {
    const visible = dom.password.type === "text";
    dom.password.type = visible ? "password" : "text";
    $("#toggle-password").textContent = visible ? "Visa" : "Dölj";
    $("#toggle-password").setAttribute("aria-pressed", String(!visible));
  });
  $("#add-button").addEventListener("click", () => openTaskDialog());
  $("#add-project-button").addEventListener("click", () => {
    dialogOpener = document.activeElement;
    dom.projectDialog.showModal();
  });
  $("#search-button").addEventListener("click", () => {
    setView("tasks", true);
    $("#task-search").focus();
  });
  $("#lock-button").addEventListener("click", lockApp);
  $("#theme-toggle").addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
  });
  dom.taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveTaskFromForm();
  });
  $("#delete-task-button").addEventListener("click", deleteCurrentTask);
  dom.projectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProjectFromForm();
    dom.projectForm.reset();
    $("#project-color").value = "#8b7cf6";
  });
  $("#task-search").addEventListener("input", renderTasks);
  $("#state-filter").addEventListener("change", renderTasks);
  $("#project-filter").addEventListener("change", renderTasks);
  $("#task-waiting-for").addEventListener("input", () => {
    $("#task-waiting-for").setCustomValidity("");
  });
  $("#task-state").addEventListener("change", () => {
    if ($("#task-state").value !== "waiting") $("#task-waiting-for").setCustomValidity("");
  });
  $("#copy-revision-button").addEventListener("click", copyRevision);
  $("#download-revision-button").addEventListener("click", downloadRevision);
  dom.snackbarAction.addEventListener("click", undoLastMutation);
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  window.addEventListener("hashchange", () => setView(location.hash.slice(1) || "now"));
  for (const name of ["pointerdown", "keydown"]) {
    document.addEventListener(name, resetLockTimer, { passive: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && dataKey) lockApp();
  });
  window.addEventListener("pagehide", () => {
    if (dataKey) lockApp();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && dataKey) lockApp();
  });
  window.addEventListener("focus", () => {
    if (dataKey && lockDeadline && Date.now() >= lockDeadline) lockApp();
  });
  for (const dialog of [dom.taskDialog, dom.projectDialog, dom.revisionDialog]) {
    dialog.addEventListener("close", () => {
      if (dialogOpener instanceof HTMLElement && document.contains(dialogOpener)) dialogOpener.focus();
      dialogOpener = null;
    });
  }
}

async function start() {
  const settings = loadUiSettings();
  applyTheme(settings.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  updateNetworkStatus();
  wireEvents();
  setInterval(() => {
    if (dataKey && lockDeadline && Date.now() >= lockDeadline) lockApp();
  }, 30_000);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  try {
    await loadVault();
  } catch (error) {
    dom.loadingStatus.textContent = error.message;
    dom.unlockButton.disabled = true;
  }
}

start();
