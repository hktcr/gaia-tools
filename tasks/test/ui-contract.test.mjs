import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.mjs", import.meta.url), "utf8");

test("mobilnavigationen håller fem tydliga vägar", () => {
  const bottomNav = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/u)?.[0] || "";
  assert.equal((bottomNav.match(/<button\b/gu) || []).length, 5);
  assert.match(bottomNav, />Nu</u);
  assert.match(bottomNav, />Inkorg</u);
  assert.match(bottomNav, />Flöde</u);
  assert.match(bottomNav, />Mer</u);
});

test("gränssnittet visar uppmärksamhetskontraktets uttryckliga val", () => {
  for (const id of [
    "moment-minutes",
    "moment-energy",
    "moment-context",
    "friction-dialog",
    "task-commitment",
    "task-blocked-by",
    "task-minimum-step",
    "task-normal-step",
    "task-full-step",
    "strict-lock-toggle",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`, "u"));
  }
  assert.match(html, /Tystnad tolkas aldrig/u);
});

test("Mer förblir vald i mobilnavigationens underliggande vyer", () => {
  assert.match(app, /MOBILE_MORE_VIEWS = new Set\(\["today", "projects", "changes"\]\)/u);
  assert.match(app, /MOBILE_MORE_VIEWS\.has\(view\)/u);
  assert.match(app, /mobile-more-button[^\n]+aria-current/u);
});

test("det publika HTML-skalet innehåller varken inlinekod eller taskdata", () => {
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/u);
  assert.doesNotMatch(html, /GAIA_TASKS_MASTER/u);
  assert.doesNotMatch(html, /application\/json/u);
});
