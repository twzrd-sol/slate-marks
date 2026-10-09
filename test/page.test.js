import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { mockResolvedGamma } from "../src/pull.js";
import { startSlateServer } from "../src/server.js";

test("the page shows one frozen mock game and does not pull it twice", async () => {
  const dir = mkdtempSync(join(tmpdir(), "slate-page-"));
  const dbPath = join(dir, "slate.sqlite");
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return mockResolvedGamma();
  };
  const first = await startSlateServer({ dbPath, fetchImpl, host: "127.0.0.1", port: 0 });
  try {
    const html = await fetch(`http://127.0.0.1:${first.port}/`).then((response) => response.text());
    assert.match(html, /BOS/);
    assert.match(html, /NYK/);
    assert.match(html, /Cited outcome/);
    assert.match(html, /home/);
    assert.match(html, /Frozen result/);
    const record = await fetch(`http://127.0.0.1:${first.port}/record`).then((response) => response.json());
    assert.equal(record.marks.length, 1);
    assert.equal(record.marks[0].frozen, true);
    assert.equal(record.marks[0].resolvedOutcome, "home");
    assert.equal(record.marks[0].citedOutcome, "BOS");
    assert.equal(record.marks[0].challenge.signerInvocations, 0);
    assert.equal(record.fixtures[0].home, "BOS");
  } finally {
    await first.close();
  }

  const second = await startSlateServer({ dbPath, fetchImpl, host: "127.0.0.1", port: 0 });
  try {
    const record = await fetch(`http://127.0.0.1:${second.port}/record`).then((response) => response.json());
    assert.equal(record.marks.length, 1);
    assert.equal(calls, 1);
  } finally {
    await second.close();
  }
});

test("re-fetch replaces the frozen mark with the next resolved game", async () => {
  const dir = mkdtempSync(join(tmpdir(), "slate-refetch-"));
  const dbPath = join(dir, "slate.sqlite");
  const next = mockResolvedGamma();
  next.event = { ...next.event, id: "evt_2", home: "PHI", away: "BOS" };
  next.condition = { ...next.condition, conditionId: "0xnext", resolvedOutcome: "PHI" };
  const payloads = [mockResolvedGamma(), next];
  let index = 0;
  const fetchImpl = async () => payloads[Math.min(index++, payloads.length - 1)];
  const server = await startSlateServer({ dbPath, fetchImpl, host: "127.0.0.1", port: 0 });
  const base = `http://127.0.0.1:${server.port}`;
  try {
    const html = await fetch(`${base}/`).then((response) => response.text());
    assert.match(html, /Re-fetch/);
    const again = await fetch(`${base}/refetch`, { method: "POST" });
    assert.equal(again.status, 200);
    const record = await fetch(`${base}/record`).then((response) => response.json());
    assert.equal(record.marks.length, 1);
    assert.equal(record.fixtures.length, 1);
    assert.equal(record.fixtures[0].home, "PHI");
    assert.equal(record.marks[0].frozen, true);
    assert.equal(record.marks[0].resolvedOutcome, "PHI");
    assert.equal(record.marks[0].challenge.signerInvocations, 0);
  } finally {
    await server.close();
  }
});
