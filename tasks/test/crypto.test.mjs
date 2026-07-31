import test from "node:test";
import assert from "node:assert/strict";

import {
  createVault,
  decryptLocalRecord,
  decryptVault,
  encryptLocalRecord,
} from "../lib/crypto.mjs";
import { createEmptyMaster, finalizeMaster } from "../lib/model.mjs";

test("vault kan öppnas med rätt lösenfras men inte med fel", async () => {
  const master = await finalizeMaster(createEmptyMaster({
    datasetId: "crypto-dataset-0001",
    now: new Date("2026-07-31T08:00:00Z"),
  }), { now: new Date("2026-07-31T08:00:00Z") });
  const { vault, dataKey } = await createVault(master, "en stark testfras");
  const unlocked = await decryptVault(vault, "en stark testfras");
  assert.equal(unlocked.master.revisionHash, master.revisionHash);
  assert.deepEqual(unlocked.dataKey, dataKey);
  await assert.rejects(decryptVault(vault, "fel testfras"), /Fel lösenfras eller skadad data/u);
});

test("lokal overlay krypteras med separat ändamålsnyckel", async () => {
  const master = await finalizeMaster(createEmptyMaster({
    datasetId: "crypto-dataset-0002",
    now: new Date("2026-07-31T08:00:00Z"),
  }), { now: new Date("2026-07-31T08:00:00Z") });
  const { dataKey } = await createVault(master, "en annan stark testfras");
  const record = {
    type: "gaia-task-local-record",
    datasetId: master.datasetId,
    baseMasterRevision: 1,
    operations: [],
    workingSnapshot: master,
  };
  const envelope = await encryptLocalRecord(record, dataKey);
  assert.equal((await decryptLocalRecord(envelope, dataKey)).datasetId, master.datasetId);
});
