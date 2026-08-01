import test from "node:test";
import assert from "node:assert/strict";

import { isoToZonedDateTimeLocal, zonedDateTimeToIso } from "../lib/time.mjs";

test("lokal svensk tid konverteras med rätt sommar- och vinteroffset", () => {
  assert.equal(zonedDateTimeToIso("2026-08-01T10:00"), "2026-08-01T08:00:00.000Z");
  assert.equal(zonedDateTimeToIso("2026-01-15T10:00"), "2026-01-15T09:00:00.000Z");
  assert.equal(isoToZonedDateTimeLocal("2026-08-01T08:00:00.000Z"), "2026-08-01T10:00");
});

test("en lokal tid som inte finns vid DST-hoppet avvisas", () => {
  assert.equal(zonedDateTimeToIso("2026-03-29T02:30"), null);
});

test("en tvetydig hösttid får en stabil och reversibel tolkning", () => {
  const iso = zonedDateTimeToIso("2026-10-25T02:30");
  assert.equal(isoToZonedDateTimeLocal(iso), "2026-10-25T02:30");
});
