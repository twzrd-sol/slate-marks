import test from "node:test";
import assert from "node:assert";
import {
  createRewardCredential,
  prepareICELANBatch,
  validateCredentialConstraints,
  encodeCredentialData,
  createCredentialBatchStatus,
} from "../src/icelan.js";

test("createRewardCredential: rejects input with observations field", () => {
  const invalidReference = {
    markId: "mark_1",
    rlanMarkId: "rlan_engagement_mark_1",
    gameId: "game_123",
    resolvedOutcome: "home",
    citedAt: "2026-10-12T00:00:00Z",
    observations: [], // VIOLATION: must not carry RLAN observations
  };
  const creator = "So11111111111111111111111111111111111111112";

  assert.throws(() => createRewardCredential(invalidReference, creator), {
    message: /observations/i,
  });
});

test("createRewardCredential: rejects input with observationSummary field", () => {
  const invalidReference = {
    markId: "mark_1",
    rlanMarkId: "rlan_engagement_mark_1",
    gameId: "game_123",
    resolvedOutcome: "home",
    citedAt: "2026-10-12T00:00:00Z",
    observationSummary: { totalObservations: 2 }, // VIOLATION
  };
  const creator = "So11111111111111111111111111111111111111112";

  assert.throws(() => createRewardCredential(invalidReference, creator), {
    message: /observationSummary/i,
  });
});

test("createRewardCredential: rejects input with engagement field", () => {
  const invalidReference = {
    markId: "mark_1",
    rlanMarkId: "rlan_engagement_mark_1",
    gameId: "game_123",
    resolvedOutcome: "home",
    citedAt: "2026-10-12T00:00:00Z",
    engagement: { viewerPeakCount: 250 }, // VIOLATION
  };
  const creator = "So11111111111111111111111111111111111111112";

  assert.throws(() => createRewardCredential(invalidReference, creator), {
    message: /engagement/i,
  });
});

test("createRewardCredential: creates credential from RLAN mark reference + creator", () => {
  const rlanReference = {
    markId: "mark_1",
    rlanMarkId: "rlan_engagement_mark_1",
    gameId: "game_123",
    resolvedOutcome: "home",
    citedAt: "2026-10-12T00:00:00Z",
  };
  const creator = "So11111111111111111111111111111111111111112";

  const credential = createRewardCredential(rlanReference, creator);

  assert.strictEqual(credential.creator, creator);
  assert.strictEqual(credential.markId, "mark_1");
  assert.strictEqual(credential.rlanMarkId, "rlan_engagement_mark_1");
  assert.strictEqual(credential.transferable, false);
  assert.strictEqual(credential.monetized, false);
  assert.strictEqual(credential.gameId, "game_123");
  assert.strictEqual(credential.resolvedOutcome, "home");
});

test("createRewardCredential: requires markId in reference", () => {
  const invalidReference = {
    rlanMarkId: "rlan_engagement_mark_1",
    creator: "So11111111111111111111111111111111111111112",
  };
  const creator = "So11111111111111111111111111111111111111112";

  assert.throws(() => createRewardCredential(invalidReference, creator), {
    message: /markId/,
  });
});

test("createRewardCredential: requires rlanMarkId in reference", () => {
  const invalidReference = {
    markId: "mark_1",
    creator: "So11111111111111111111111111111111111111112",
  };
  const creator = "So11111111111111111111111111111111111111112";

  assert.throws(() => createRewardCredential(invalidReference, creator), {
    message: /rlanMarkId/,
  });
});

test("validateCredentialConstraints: non-transferable is mandatory", () => {
  const invalid = {
    transferable: true, // VIOLATION
    monetized: false,
    creator: "So11111111111111111111111111111111111111112",
    gameId: "game_123",
  };

  assert.throws(() => validateCredentialConstraints(invalid), {
    message: /non-transferable/,
  });
});

test("validateCredentialConstraints: monetized must be false", () => {
  const invalid = {
    transferable: false,
    monetized: true, // VIOLATION
    creator: "So11111111111111111111111111111111111111112",
    gameId: "game_123",
  };

  assert.throws(() => validateCredentialConstraints(invalid), {
    message: /monetized/,
  });
});

test("validateCredentialConstraints: passes valid credential", () => {
  const valid = {
    transferable: false,
    monetized: false,
    creator: "So11111111111111111111111111111111111111112",
    gameId: "game_123",
    resolvedOutcome: "home",
  };

  assert.doesNotThrow(() => validateCredentialConstraints(valid));
});

test("encodeCredentialData: produces JSON without internal flags", () => {
  const credential = {
    markId: "mark_1",
    rlanMarkId: "rlan_engagement_mark_1",
    creator: "So11111111111111111111111111111111111111112",
    gameId: "game_123",
    resolvedOutcome: "home",
    citedAt: "2026-10-12T00:00:00Z",
    createdAt: "2026-10-12T01:00:00Z",
  };

  const encoded = encodeCredentialData(credential);
  const data = JSON.parse(encoded);

  assert.strictEqual(data.markId, "mark_1");
  assert.strictEqual(data.rlanMarkId, "rlan_engagement_mark_1");
  assert.strictEqual(data.gameId, "game_123");
  assert(!data.transferable, "no transferable flag in encoded data");
  assert(!data.monetized, "no monetized flag in encoded data");
});

test("createCredentialBatchStatus: tracks credentials with pending status", () => {
  const credentials = [
    { id: "icelan_credential_1", markId: "mark_1" },
    { id: "icelan_credential_2", markId: "mark_2" },
  ];

  const status = createCredentialBatchStatus(credentials);

  assert(status.batchId);
  assert.strictEqual(status.credentials.length, 2);
  assert.strictEqual(status.credentials[0].status, "pending");
  assert.strictEqual(status.credentials[0].txSignature, null);
});
