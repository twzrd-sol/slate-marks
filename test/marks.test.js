import test from "node:test";
import assert from "node:assert/strict";
import { createSlate, openMark, recordCite, recordFixture, recordLineup, recordSeason, resolveMark } from "../src/slate.js";
import { createReadAdapter } from "../src/polymarket.js";
const PUBKEY = "So11111111111111111111111111111111111111112";
function seed() {
  const slate = createSlate();
  const season = recordSeason(slate, { league: "NBA", label: "2026-27", startsAt: "2026-10-01", endsAt: "2027-06-01" });
  const fixture = recordFixture(slate, { seasonId: season.id, gammaEventId: "evt_1", gameId: "game_1", home: "BOS", away: "NYK", startsAt: "2026-10-22T23:00:00Z" });
  const cite = recordCite(slate, { fixtureId: fixture.id, conditionId: "0xcondition", sportsMarketType: "moneyline", outcomeTokenId: "token_yes", impliedPrice: 0.62, citedAt: "2026-10-06T22:00:00Z" });
  const lineup = recordLineup(slate, { seasonId: season.id, solanaPubkey: PUBKEY, slots: [{ fixtureId: fixture.id, side: "home" }] });
  return { slate, fixture, cite, lineup };
}
test("recording a lineup and a cite creates one open mark", () => {
  const { slate, fixture, cite, lineup } = seed();
  const mark = openMark(slate, { lineupId: lineup.id, fixtureId: fixture.id, outcomeCiteId: cite.id, solanaPubkey: PUBKEY, citedOutcome: "home", createdAt: "2026-10-06T22:01:00Z" });
  assert.equal(mark.mark, "open"); assert.equal(mark.resolvedOutcome, null); assert.equal(slate.marks.length, 1);
});
test("a second mark for the same lineup and fixture throws", () => {
  const { slate, fixture, cite, lineup } = seed();
  openMark(slate, { lineupId: lineup.id, fixtureId: fixture.id, outcomeCiteId: cite.id, solanaPubkey: PUBKEY, citedOutcome: "home", createdAt: "2026-10-06T22:01:00Z" });
  assert.throws(() => openMark(slate, { lineupId: lineup.id, fixtureId: fixture.id, outcomeCiteId: cite.id, solanaPubkey: PUBKEY, citedOutcome: "away", createdAt: "2026-10-06T22:02:00Z" }), /second mark/);
  assert.equal(slate.marks.length, 1);
});
test("resolve copies resolvedOutcome and does not create a second asset", () => {
  const { slate, fixture, cite, lineup } = seed();
  const mark = openMark(slate, { lineupId: lineup.id, fixtureId: fixture.id, outcomeCiteId: cite.id, solanaPubkey: PUBKEY, citedOutcome: "home", createdAt: "2026-10-06T22:01:00Z" });
  const resolved = resolveMark(slate, mark.id, { resolvedOutcome: "home" });
  assert.equal(resolved.resolvedOutcome, "home"); assert.equal(resolved.mark, "resolved"); assert.equal(slate.marks.length, 1); assert.equal(slate.fixtures.length, 1);
});
test("x402 challenge stays uninvoked with amount 0", () => {
  const { slate, fixture, cite, lineup } = seed();
  const mark = openMark(slate, { lineupId: lineup.id, fixtureId: fixture.id, outcomeCiteId: cite.id, solanaPubkey: PUBKEY, citedOutcome: "home", createdAt: "2026-10-06T22:01:00Z" });
  assert.equal(mark.challenge.amount, "0"); assert.equal(mark.challenge.payTo, null); assert.equal(mark.challenge.status, "uninvoked"); assert.equal(mark.challenge.failClosed, true); assert.equal(mark.challenge.network, "base"); assert.equal(mark.challenge.signerInvocations, 0);
});
test("polymarket adapter returns a fixture from an injected Gamma payload", () => {
  const adapter = createReadAdapter({ fetchImpl: async () => ({ sports: ["nba"] }) });
  const fixture = adapter.fixtureFromGamma({ event: { id: "evt_9", game_id: "g9", home: "BOS", away: "NYK", start_time: "2026-10-22T23:00:00Z" } });
  assert.equal(fixture.gammaEventId, "evt_9"); assert.equal(fixture.home, "BOS"); assert.equal(fixture.signer, null); assert.equal(fixture.source, "polymarket-gamma");
});
