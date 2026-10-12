import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
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

test("re-fetch appends a new frozen mark while preserving the earlier history", async () => {
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
    assert.equal(record.marks.length, 2);
    assert.equal(record.fixtures.length, 2);
    assert.deepEqual(record.marks.map((mark) => mark.frozen), [true, true]);
    assert.equal(record.fixtures[0].home, "BOS");
    assert.equal(record.fixtures[1].home, "PHI");
    assert.equal(record.marks[0].resolvedOutcome, "home");
    assert.equal(record.marks[1].resolvedOutcome, "PHI");
    assert.equal(record.marks.every((mark) => mark.challenge.signerInvocations === 0), true);
  } finally {
    await server.close();
  }
});

test("re-fetching the same condition deduplicates and preserves frozen history", async () => {
  const dir = mkdtempSync(join(tmpdir(), "slate-dedupe-"));
  const dbPath = join(dir, "slate.sqlite");
  const payload = mockResolvedGamma();
  const server = await startSlateServer({ dbPath, fetchImpl: async () => payload, host: "127.0.0.1", port: 0 });
  const base = `http://127.0.0.1:${server.port}`;
  try {
    await fetch(`${base}/refetch`, { method: "POST" });
    const record = await fetch(`${base}/record`).then((response) => response.json());
    assert.equal(record.marks.length, 1);
    assert.equal(record.fixtures.length, 1);
  } finally {
    await server.close();
  }
});

test("failed re-fetch keeps the board and history visible and reports the error", async () => {
  const dir = mkdtempSync(join(tmpdir(), "slate-refresh-failure-"));
  const dbPath = join(dir, "slate.sqlite");
  let fail = false;
  const server = await startSlateServer({
    dbPath,
    fetchImpl: async () => {
      if (fail) throw new Error("Gamma unavailable");
      return mockResolvedGamma();
    },
    host: "127.0.0.1",
    port: 0,
  });
  const base = `http://127.0.0.1:${server.port}`;
  try {
    fail = true;
    const response = await fetch(`${base}/refetch`, { method: "POST" });
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /Gamma unavailable/);
    const page = await fetch(`${base}/`).then((result) => result.text());
    assert.match(page, /BOS vs NYK/);
    assert.match(page, /Refresh failed: Gamma unavailable/);
    const record = await fetch(`${base}/record`).then((result) => result.json());
    assert.equal(record.marks.length, 1);
    assert.equal(record.refreshError.includes("Gamma unavailable"), true);
  } finally {
    await server.close();
  }
});

test("an initial read failure still starts with a visible error and empty board", async () => {
  const dir = mkdtempSync(join(tmpdir(), "slate-initial-failure-"));
  const server = await startSlateServer({ dbPath: join(dir, "slate.sqlite"), fetchImpl: async () => { throw new Error("offline"); }, host: "127.0.0.1", port: 0 });
  try {
    const page = await fetch(`http://127.0.0.1:${server.port}/`).then((response) => response.text());
    assert.match(page, /Refresh failed: offline/);
    assert.match(page, /No frozen mark/);
  } finally {
    await server.close();
  }
});

test("the page shows transport errors from the browser refresh request", async () => {
  const dir = mkdtempSync(join(tmpdir(), "slate-browser-failure-"));
  const server = await startSlateServer({ dbPath: join(dir, "slate.sqlite"), fetchImpl: async () => mockResolvedGamma(), host: "127.0.0.1", port: 0 });
  try {
    const page = await fetch(`http://127.0.0.1:${server.port}/`).then((response) => response.text());
    const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script);
    let clickHandler;
    const status = {};
    const elements = {
      refetch: { addEventListener: (_name, handler) => { clickHandler = handler; } },
      "refresh-status": status,
    };
    runInNewContext(script, {
      document: { getElementById: (id) => elements[id] },
      fetch: async () => { throw new Error("browser network offline"); },
      location: { reload() {} },
    });
    await clickHandler();
    assert.equal(status.className, "error");
    assert.equal(status.textContent, "browser network offline");
  } finally {
    await server.close();
  }
});

test("concurrent refetch requests share one Gamma read", async () => {
  const dir = mkdtempSync(join(tmpdir(), "slate-refresh-coalesce-"));
  const dbPath = join(dir, "slate.sqlite");
  let calls = 0;
  let notifySecondRead;
  const secondReadStarted = new Promise((resolve) => { notifySecondRead = resolve; });
  let finishSecondRead;
  const secondRead = new Promise((resolve) => { finishSecondRead = resolve; });
  const server = await startSlateServer({
    dbPath,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return mockResolvedGamma();
      notifySecondRead();
      return secondRead;
    },
    host: "127.0.0.1",
    port: 0,
  });
  const base = `http://127.0.0.1:${server.port}`;
  try {
    const first = fetch(`${base}/refetch`, { method: "POST" });
    const second = fetch(`${base}/refetch`, { method: "POST" });
    await secondReadStarted;
    assert.equal(calls, 2, "one startup read plus one shared refresh read");
    await new Promise((resolve) => setTimeout(resolve, 20));
    finishSecondRead(mockResolvedGamma());
    const responses = await Promise.all([first, second]);
    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    assert.equal(calls, 2);
  } finally {
    finishSecondRead(mockResolvedGamma());
    await server.close();
  }
});
