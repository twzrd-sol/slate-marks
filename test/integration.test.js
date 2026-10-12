import test from "node:test";
import assert from "node:assert";
import { createAttestationRecord, encodeAttestationData } from "../src/mainnet.js";
import { createEngagementMark, encodeEngagementMarkData, createHelixEngagementObservation } from "../src/rlan.js";
import { createRewardCredential, encodeCredentialData } from "../src/icelan.js";

test("Integration: mainnet attestation endpoint flow", () => {
  const frozenMark = {
    id: "mark_1",
    frozen: true,
    solanaPubkey: "So11111111111111111111111111111111111111112",
    resolvedOutcome: "home",
  };

  const fixture = {
    id: "fixture_1",
    gameId: "game_123",
    league: "NFL",
  };

  const cite = {
    id: "cite_1",
    source: "polymarket-gamma",
    conditionId: "0x456def",
    outcomeTokenId: "0xoutcome",
    citedAt: "2026-10-12T00:00:00Z",
  };

  const attestation = createAttestationRecord(frozenMark, fixture, cite);
  assert.ok(attestation);
  assert.strictEqual(attestation.creator, frozenMark.solanaPubkey);

  const encoded = encodeAttestationData(attestation);
  assert.ok(encoded);
  assert.ok(typeof encoded === "string");
});

test("Integration: ICELAN credential endpoint flow", () => {
  const rlanMark = {
    id: "rlan_engagement_mark_1",
    markId: "mark_1",
    gameId: "game_123",
    resolvedOutcome: "home",
    citedAt: "2026-10-12T00:00:00Z",
  };

  const creator = "So11111111111111111111111111111111111111112";

  const rlanReference = {
    markId: rlanMark.markId,
    rlanMarkId: rlanMark.id,
    gameId: rlanMark.gameId,
    resolvedOutcome: rlanMark.resolvedOutcome,
    citedAt: rlanMark.citedAt,
  };

  const credential = createRewardCredential(rlanReference, creator);
  assert.ok(credential);
  assert.strictEqual(credential.creator, creator);
  assert.strictEqual(credential.rlanMarkId, rlanMark.id);

  const encoded = encodeCredentialData(credential);
  assert.ok(encoded);
  assert.ok(typeof encoded === "string");
});

test("Integration: RLAN engagement with engagement mark", () => {
  const frozenMark = {
    id: "mark_1",
    frozen: true,
    solanaPubkey: "So11111111111111111111111111111111111111112",
    resolvedOutcome: "home",
  };

  const fixture = {
    gameId: "game_123",
    league: "NFL",
  };

  const engagementObs = createHelixEngagementObservation({
    streamer: "user_456",
    signal: "viewers",
    count: 250,
    observedAt: "2026-10-12T10:15:00Z",
  });
  assert.ok(engagementObs);

  const engagementMark = createEngagementMark(frozenMark, frozenMark.solanaPubkey, [engagementObs]);
  assert.ok(engagementMark);
  assert.strictEqual(engagementMark.creator, frozenMark.solanaPubkey);
  assert.strictEqual(engagementMark.markId, frozenMark.id);

  const encoded = encodeEngagementMarkData(engagementMark);
  assert.ok(encoded);
  assert.ok(typeof encoded === "string");
});
