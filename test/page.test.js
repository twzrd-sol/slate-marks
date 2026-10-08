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
    assert.equal(record.marks[0].citedOutcome, "home");
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
