import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { freezeCopiedCondition, payloadFromGammaEvent, pullLiveResolved } from "../src/pull.js";
import { createSlate } from "../src/slate.js";
import { loadSlate, saveSlate } from "../src/store.js";

const lakers = {
  id: "10354",
  slug: "nba-play-in-lakers-vs-pelicans",
  startDate: "2024-04-15T18:16:23.982015Z",
  endDate: "2024-04-16T12:00:00Z",
  markets: [{
    sportsMarketType: "moneyline",
    umaResolutionStatus: "resolved",
    closed: true,
    conditionId: "0x141f2fb7dc316ca019d7ce9d0fe530a78e18b637ea84211d8f4cebe43742a7bb",
    outcomes: "[\"Lakers\", \"Pelicans\"]",
    outcomePrices: "[\"1\", \"0\"]",
    clobTokenIds: "[\"1120\", \"1768\"]",
  }],
};

test("a resolved Gamma event becomes one frozen slate payload", () => {
  const payload = payloadFromGammaEvent(lakers);
  assert.equal(payload.league, "NBA");
  assert.equal(payload.event.home, "Lakers");
  assert.equal(payload.event.away, "Pelicans");
  assert.equal(payload.event.gammaEventId ?? payload.event.id, "10354");
  assert.equal(payload.condition.resolved, true);
  assert.equal(payload.condition.resolvedOutcome, "Lakers");
  assert.equal(payload.condition.sportsMarketType, "moneyline");
  assert.equal(payload.condition.impliedPrice, 1);
  assert.equal(payload.condition.outcomeTokenId, "1120");
});

test("Gamma moneyline validation rejects incomplete or ambiguous resolved payloads", () => {
  const malformed = [
    { outcomes: '["Lakers"]' },
    { outcomes: '["Lakers", " "]' },
    { outcomes: '["Lakers", "Lakers"]' },
    { outcomePrices: '["1"]' },
    { outcomePrices: '["1", "NaN"]' },
    { outcomePrices: '["1", "0.5"]' },
    { outcomePrices: '["1", "1"]' },
    { outcomePrices: '["0", "0"]' },
    { clobTokenIds: '["1120"]' },
    { clobTokenIds: '["1120", " "]' },
    { clobTokenIds: '["1120", "1120"]' },
    { outcomes: '{"home":"Lakers"}' },
    { conditionId: " " },
  ];
  for (const change of malformed) {
    const event = structuredClone(lakers);
    Object.assign(event.markets[0], change);
    assert.throws(() => payloadFromGammaEvent(event), undefined, JSON.stringify(change));
  }
});

test("Gamma winner is tied to its outcome token and event identity must be present", () => {
  const event = structuredClone(lakers);
  event.markets[0].outcomes = '["Pelicans", "Lakers"]';
  event.markets[0].outcomePrices = '["0", "1"]';
  event.markets[0].clobTokenIds = '["1768", "1120"]';
  const payload = payloadFromGammaEvent(event);
  assert.equal(payload.condition.resolvedOutcome, "Lakers");
  assert.equal(payload.condition.outcomeTokenId, "1120");
  assert.throws(() => payloadFromGammaEvent({ ...event, id: "" }), /event id/);
});

test("pullLiveResolved reads the Gamma events URL", async () => {
  let seen = "";
  let options;
  let timeoutMs;
  const originalTimeout = AbortSignal.timeout;
  AbortSignal.timeout = (milliseconds) => {
    timeoutMs = milliseconds;
    return new AbortController().signal;
  };
  let payload;
  try {
    payload = await pullLiveResolved(async (url, fetchOptions) => {
      seen = url;
      options = fetchOptions;
      return new Response(JSON.stringify([lakers]), { headers: { "content-type": "application/json" } });
    });
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
  assert.match(seen, /^https:\/\/gamma-api\.polymarket\.com\/events\?/);
  assert.match(seen, /tag_slug=nba/);
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(timeoutMs, 10_000);
  assert.equal(payload.condition.conditionId, lakers.markets[0].conditionId);
});

test("pullLiveResolved rejects Gamma responses above its configured byte bound", async () => {
  await assert.rejects(() => pullLiveResolved(async () => ({
    ok: true,
    headers: { get: () => "1048577" },
    text: async () => "[]",
  })), /too large/);
  let cancelled = false;
  const oversizedChunk = new Uint8Array(1_048_577);
  await assert.rejects(() => pullLiveResolved(async () => ({
    ok: true,
    body: { getReader: () => ({ read: async () => ({ done: false, value: oversizedChunk }), cancel: async () => { cancelled = true; } }) },
  })), /too large/);
  assert.equal(cancelled, true);
});

test("pullLiveResolved rejects an unreadable JSON-only response instead of bypassing the size bound", async () => {
  await assert.rejects(() => pullLiveResolved(async () => ({
    ok: true,
    json: async () => [lakers],
  })), /body is not readable/);
});

test("a live Gamma moneyline freezes into sqlite", async () => {
  const payload = await pullLiveResolved();
  assert.equal(payload.condition.resolved, true);
  assert.match(payload.condition.conditionId, /^0x/);
  assert.equal(typeof payload.event.home, "string");
  assert.ok(payload.event.home.length > 0);

  const slate = createSlate();
  freezeCopiedCondition(slate, payload, {
    solanaPubkey: "So11111111111111111111111111111111111111112",
    citedOutcome: payload.event.home,
    citedAt: "2026-10-08T03:00:00Z",
    createdAt: "2026-10-08T03:00:01Z",
  });
  const dir = mkdtempSync(join(tmpdir(), "slate-live-"));
  const dbPath = join(dir, "slate.sqlite");
  saveSlate(dbPath, slate);
  const loaded = loadSlate(dbPath);
  assert.equal(loaded.fixtures[0].home, payload.event.home);
  assert.equal(loaded.fixtures[0].away, payload.event.away);
  assert.equal(loaded.marks.length, 1);
  assert.equal(loaded.marks[0].frozen, true);
  assert.equal(loaded.marks[0].resolvedOutcome, payload.condition.resolvedOutcome);
  assert.equal(loaded.marks[0].challenge.signerInvocations, 0);
});
