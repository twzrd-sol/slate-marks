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

test("pullLiveResolved reads the Gamma events URL", async () => {
  let seen = "";
  const payload = await pullLiveResolved(async (url) => {
    seen = url;
    return { ok: true, json: async () => [lakers] };
  });
  assert.match(seen, /^https:\/\/gamma-api\.polymarket\.com\/events\?/);
  assert.match(seen, /tag_slug=nba/);
  assert.equal(payload.condition.conditionId, lakers.markets[0].conditionId);
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
