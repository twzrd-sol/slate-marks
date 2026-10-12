import test from "node:test";
import assert from "node:assert";
import {
  createHelixEngagementObservation,
  createEngagementMark,
  prepareRLANBatch,
  validateEngagementMarkConstraints,
  encodeEngagementMarkData,
  validateTwitchCredentials,
  createRLANBatchStatus,
} from "../src/rlan.js";

test("createHelixEngagementObservation: creates Helix observation", () => {
  const obs = createHelixEngagementObservation({
    streamer: "12345",
    signal: "viewers",
    count: 250,
    observedAt: "2026-10-12T00:00:00Z",
  });

  assert.strictEqual(obs.provider, "twitch-helix");
  assert.strictEqual(obs.signal, "viewers");
  assert.strictEqual(obs.count, 250);
  assert.strictEqual(obs.payoutInput, false);
  assert.strictEqual(obs.monetized, false);
});

test("createHelixEngagementObservation: rejects invalid signal", () => {
  assert.throws(
    () =>
      createHelixEngagementObservation({
        streamer: "12345",
        signal: "invalid_signal",
      }),
    { message: /signal must be/ }
  );
});

test("createHelixEngagementObservation: requires streamer", () => {
  assert.throws(() => createHelixEngagementObservation({ signal: "chat" }), {
    message: /streamer required/,
  });
});

test("createEngagementMark: creates mark from frozen mark + observations", () => {
  const frozenMark = {
    frozen: true,
    id: "mark_1",
    gameId: "game_123",
    resolvedOutcome: "home",
    citedAt: "2026-10-12T00:00:00Z",
  };

  const creator = "So11111111111111111111111111111111111111112";

  const observations = [
    createHelixEngagementObservation({
      streamer: "12345",
      signal: "viewers",
      count: 250,
    }),
    createHelixEngagementObservation({
      streamer: "12345",
      signal: "chat",
      count: 1,
    }),
  ];

  const mark = createEngagementMark(frozenMark, creator, observations);

  assert.strictEqual(mark.creator, creator);
  assert.strictEqual(mark.transferable, false);
  assert.strictEqual(mark.observationOnly, true);
  assert.strictEqual(mark.engagement.viewerPeakCount, 250);
  assert.strictEqual(mark.engagement.chatEventsCount, 1);
});

test("createEngagementMark: rejects unfrozen mark", () => {
  const unfrozenMark = { frozen: false };
  const creator = "So11111111111111111111111111111111111111112";
  const observations = [
    createHelixEngagementObservation({
      streamer: "12345",
      signal: "viewers",
    }),
  ];

  assert.throws(() => createEngagementMark(unfrozenMark, creator, observations), {
    message: /frozen/,
  });
});

test("createEngagementMark: rejects non-Helix observations", () => {
  const frozenMark = { frozen: true, id: "mark_1" };
  const creator = "So11111111111111111111111111111111111111112";
  const invalidObs = [
    {
      provider: "not-helix",
      signal: "viewers",
      payoutInput: false,
      monetized: false,
    },
  ];

  assert.throws(() => createEngagementMark(frozenMark, creator, invalidObs), {
    message: /twitch-helix/,
  });
});

test("createEngagementMark: rejects observation with payoutInput=true", () => {
  const frozenMark = { frozen: true, id: "mark_1" };
  const creator = "So11111111111111111111111111111111111111112";
  const invalidObs = [
    {
      provider: "twitch-helix",
      signal: "viewers",
      payoutInput: true, // VIOLATION
      monetized: false,
    },
  ];

  assert.throws(() => createEngagementMark(frozenMark, creator, invalidObs), {
    message: /payout input/,
  });
});

test("validateEngagementMarkConstraints: non-transferable is mandatory", () => {
  const invalid = {
    transferable: true, // VIOLATION
    observationOnly: true,
    creator: "So11111111111111111111111111111111111111112",
    observations: [
      { provider: "twitch-helix", payoutInput: false, monetized: false },
    ],
  };

  assert.throws(() => validateEngagementMarkConstraints(invalid), {
    message: /non-transferable/,
  });
});

test("validateEngagementMarkConstraints: observation-only is mandatory", () => {
  const invalid = {
    transferable: false,
    observationOnly: false, // VIOLATION
    creator: "So11111111111111111111111111111111111111112",
    observations: [
      { provider: "twitch-helix", payoutInput: false, monetized: false },
    ],
  };

  assert.throws(() => validateEngagementMarkConstraints(invalid), {
    message: /observation-only/,
  });
});

test("validateEngagementMarkConstraints: passes valid mark", () => {
  const valid = {
    transferable: false,
    observationOnly: true,
    creator: "So11111111111111111111111111111111111111112",
    observations: [
      { provider: "twitch-helix", payoutInput: false, monetized: false },
    ],
  };

  assert.doesNotThrow(() => validateEngagementMarkConstraints(valid));
});

test("encodeEngagementMarkData: produces JSON without raw user data", () => {
  const mark = {
    markId: "mark_1",
    creator: "So11111111111111111111111111111111111111112",
    sportsbook: {
      gameId: "game_123",
      resolvedOutcome: "home",
      citedAt: "2026-10-12T00:00:00Z",
    },
    observationSummary: {
      totalObservations: 2,
      signalCounts: { viewers: 1, chat: 1, cheer: 0, raid: 0 },
    },
    engagement: {
      viewerPeakCount: 250,
      chatEventsCount: 1,
      cheersCount: 0,
      raidsCount: 0,
    },
    createdAt: "2026-10-12T01:00:00Z",
  };

  const encoded = encodeEngagementMarkData(mark);
  const data = JSON.parse(encoded);

  assert.strictEqual(data.markId, "mark_1");
  assert.strictEqual(data.engagement.viewerPeakCount, 250);
  assert(!data.transferable, "no transferable flag in encoded data");
  assert(!data.observationOnly, "no observationOnly flag in encoded data");
});

test("prepareRLANBatch: creates marks from frozen marks + observations", () => {
  const slate = {
    marks: [
      {
        id: "mark_1",
        frozen: true,
        solanaPubkey: "So11111111111111111111111111111111111111112",
        gameId: "game_123",
        resolvedOutcome: "home",
      },
    ],
  };

  const observationsByMark = [
    {
      markId: "mark_1",
      observations: [
        createHelixEngagementObservation({
          streamer: "12345",
          signal: "viewers",
          count: 250,
        }),
      ],
    },
  ];

  const batch = prepareRLANBatch(slate, observationsByMark);

  assert.strictEqual(batch.length, 1);
  assert.strictEqual(batch[0].markId, "mark_1");
  assert.strictEqual(batch[0].engagement.viewerPeakCount, 250);
});

test("prepareRLANBatch: skips marks with no observations", () => {
  const slate = {
    marks: [
      {
        id: "mark_1",
        frozen: true,
        solanaPubkey: "So11111111111111111111111111111111111111112",
      },
    ],
  };

  const observationsByMark = [
    {
      markId: "mark_1",
      observations: [], // Empty
    },
  ];

  const batch = prepareRLANBatch(slate, observationsByMark);

  assert.strictEqual(batch.length, 0, "skips marks with no observations");
});

test("validateTwitchCredentials: validates token format", () => {
  assert.strictEqual(
    validateTwitchCredentials("valid_token_at_least_32_characters_long"),
    true
  );
  assert.strictEqual(validateTwitchCredentials("too_short"), false);
  assert.strictEqual(validateTwitchCredentials(null), false);
  assert.strictEqual(validateTwitchCredentials(""), false);
});

test("createRLANBatchStatus: tracks marks with pending status", () => {
  const marks = [
    { id: "rlan_engagement_mark_1", markId: "mark_1" },
    { id: "rlan_engagement_mark_2", markId: "mark_2" },
  ];

  const status = createRLANBatchStatus(marks);

  assert(status.batchId);
  assert.strictEqual(status.marks.length, 2);
  assert.strictEqual(status.marks[0].status, "pending");
  assert.strictEqual(status.marks[0].txSignature, null);
});

test("observation summary: calculates correct metrics", () => {
  const observations = [
    createHelixEngagementObservation({
      streamer: "12345",
      signal: "viewers",
      count: 250,
    }),
    createHelixEngagementObservation({
      streamer: "12345",
      signal: "viewers",
      count: 300,
    }),
    createHelixEngagementObservation({
      streamer: "12345",
      signal: "chat",
      count: 1,
    }),
    createHelixEngagementObservation({
      streamer: "12345",
      signal: "cheer",
      count: 50,
    }),
  ];

  const mark = createEngagementMark({ frozen: true, id: "m1" }, "So11111111111111111111111111111111111111112", observations);

  assert.strictEqual(mark.engagement.viewerPeakCount, 300);
  assert.strictEqual(mark.engagement.chatEventsCount, 1);
  assert.strictEqual(mark.engagement.cheersCount, 50);
  assert.strictEqual(mark.engagement.raidsCount, 0);
});
