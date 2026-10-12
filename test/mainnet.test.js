import test from "node:test";
import assert from "node:assert";
import {
  createAttestationRecord,
  prepareMainnetBatch,
  validateAttestationConstraints,
  encodeAttestationData,
  createBatchStatus,
} from "../src/mainnet.js";

test("createAttestationRecord: creates record from frozen mark", () => {
  const frozenMark = {
    id: "mark_1",
    frozen: true,
    solanaPubkey: "So11111111111111111111111111111111111111112",
    resolvedOutcome: "home",
    fixtureId: "fixture_1",
    outcomeCiteId: "cite_1",
  };

  const fixture = {
    id: "fixture_1",
    gameId: "game_123",
    league: "nfl",
  };

  const cite = {
    id: "cite_1",
    source: "polymarket-gamma",
    conditionId: "0x123abc",
    outcomeTokenId: "0x456def",
    citedAt: "2026-10-12T00:00:00Z",
  };

  const record = createAttestationRecord(frozenMark, fixture, cite);

  assert.strictEqual(record.markId, "mark_1");
  assert.strictEqual(record.creator, "So11111111111111111111111111111111111111112");
  assert.strictEqual(record.evidence.resolvedOutcome, "home");
  assert.strictEqual(record.transferable, false);
  assert.strictEqual(record.monetized, false);
});

test("createAttestationRecord: rejects unfrozen mark", () => {
  const unfrozenMark = { frozen: false, resolvedOutcome: "home" };
  const fixture = { id: "f1", gameId: "g1" };
  const cite = { source: "polymarket-gamma" };

  assert.throws(() => createAttestationRecord(unfrozenMark, fixture, cite), {
    message: /frozen/,
  });
});

test("createAttestationRecord: rejects missing resolved outcome", () => {
  const mark = { frozen: true, resolvedOutcome: null };
  const fixture = { id: "f1", gameId: "g1" };
  const cite = { source: "polymarket-gamma" };

  assert.throws(() => createAttestationRecord(mark, fixture, cite), {
    message: /resolved outcome/,
  });
});

test("validateAttestationConstraints: non-transferable is mandatory", () => {
  const invalid = {
    creator: "So11111111111111111111111111111111111111112",
    transferable: true, // VIOLATION
    monetized: false,
    evidence: {
      source: "polymarket-gamma",
      resolvedOutcome: "home",
    },
  };

  assert.throws(() => validateAttestationConstraints(invalid), {
    message: /non-transferable/,
  });
});

test("validateAttestationConstraints: never monetized is mandatory", () => {
  const invalid = {
    creator: "So11111111111111111111111111111111111111112",
    transferable: false,
    monetized: true, // VIOLATION
    evidence: {
      source: "polymarket-gamma",
      resolvedOutcome: "home",
    },
  };

  assert.throws(() => validateAttestationConstraints(invalid), {
    message: /never be monetized/,
  });
});

test("validateAttestationConstraints: requires polymarket-gamma evidence", () => {
  const invalid = {
    creator: "So11111111111111111111111111111111111111112",
    transferable: false,
    monetized: false,
    evidence: {
      source: "not-polymarket", // VIOLATION
      resolvedOutcome: "home",
    },
  };

  assert.throws(() => validateAttestationConstraints(invalid), {
    message: /polymarket-gamma/,
  });
});

test("validateAttestationConstraints: passes valid attestation", () => {
  const valid = {
    creator: "So11111111111111111111111111111111111111112",
    transferable: false,
    monetized: false,
    evidence: {
      source: "polymarket-gamma",
      resolvedOutcome: "home",
    },
  };

  assert.doesNotThrow(() => validateAttestationConstraints(valid));
});

test("encodeAttestationData: produces JSON without signer material", () => {
  const attestation = {
    markId: "mark_1",
    creator: "So11111111111111111111111111111111111111112",
    gameId: "game_123",
    evidence: {
      resolvedOutcome: "home",
      conditionId: "0x123abc",
      citedAt: "2026-10-12T00:00:00Z",
    },
    createdAt: "2026-10-12T01:00:00Z",
  };

  const encoded = encodeAttestationData(attestation);
  const data = JSON.parse(encoded);

  assert.strictEqual(data.markId, "mark_1");
  assert.strictEqual(data.creator, "So11111111111111111111111111111111111111112");
  assert.strictEqual(data.resolvedOutcome, "home");
  assert(!data.transferable, "no transferable flag in encoded data");
  assert(!data.monetized, "no monetized flag in encoded data");
});

test("prepareMainnetBatch: filters unfrozen marks", () => {
  const slate = {
    marks: [
      {
        id: "mark_1",
        frozen: true,
        solanaPubkey: "So11111111111111111111111111111111111111112",
        resolvedOutcome: "home",
        fixtureId: "fixture_1",
        outcomeCiteId: "cite_1",
      },
      {
        id: "mark_2",
        frozen: false, // Should be skipped
        solanaPubkey: "So11111111111111111111111111111111111111113",
        resolvedOutcome: "away",
        fixtureId: "fixture_2",
        outcomeCiteId: "cite_2",
      },
    ],
    cites: [
      {
        id: "cite_1",
        source: "polymarket-gamma",
        conditionId: "0x123abc",
        outcomeTokenId: "0x456def",
        citedAt: "2026-10-12T00:00:00Z",
      },
      {
        id: "cite_2",
        source: "polymarket-gamma",
        conditionId: "0x789ghi",
        outcomeTokenId: "0xabc123",
        citedAt: "2026-10-12T00:00:00Z",
      },
    ],
    fixtures: [
      { id: "fixture_1", gameId: "game_123", league: "nfl" },
      { id: "fixture_2", gameId: "game_456", league: "nba" },
    ],
  };

  const batch = prepareMainnetBatch(slate);

  assert.strictEqual(batch.length, 1, "only frozen mark included");
  assert.strictEqual(batch[0].markId, "mark_1");
});

test("prepareMainnetBatch: skips marks with missing cite", () => {
  const slate = {
    marks: [
      {
        id: "mark_1",
        frozen: true,
        solanaPubkey: "So11111111111111111111111111111111111111112",
        resolvedOutcome: "home",
        fixtureId: "fixture_1",
        outcomeCiteId: "cite_missing", // Does not exist
      },
    ],
    cites: [],
    fixtures: [{ id: "fixture_1", gameId: "game_123" }],
  };

  const batch = prepareMainnetBatch(slate);

  assert.strictEqual(batch.length, 0, "skips marks with missing cite");
});

test("createBatchStatus: tracks attestations with pending status", () => {
  const attestations = [
    { id: "att_1", markId: "mark_1" },
    { id: "att_2", markId: "mark_2" },
  ];

  const status = createBatchStatus(attestations);

  assert(status.batchId);
  assert.strictEqual(status.attestations.length, 2);
  assert.strictEqual(status.attestations[0].status, "pending");
  assert.strictEqual(status.attestations[0].txSignature, null);
});
