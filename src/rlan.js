/**
 * Radio LAN engagement adapter for slate-marks.
 *
 * Creates non-transferable engagement marks linking Twitch Helix observations
 * to sportsbook evidence. Twitch data is observation layer only; never input
 * to payout calculations.
 *
 * Policy constraints (from docs/NON_GOALS.md):
 * - Twitch data observation-only; never in reward calculation
 * - Non-transferable attribution record
 * - Creator attestation required (signer identity, never invoked)
 * - All credentials from Doppler env (Twitch token, RPC)
 * - Agents must have "(AI agent)" disclosure in chat
 */

/**
 * Twitch Helix observation event.
 *
 * Captures public metrics: viewer count, chat activity, cheers, raids.
 * Never stores: login names, chat text, private user data.
 * Always pseudonymous: participant_id is opaque, not mapped to user.
 */
export function createHelixEngagementObservation(input) {
  if (!input.streamer || typeof input.streamer !== "string") {
    throw new Error("streamer required (Twitch user_id)");
  }
  if (!input.signal || !["viewers", "chat", "cheer", "raid"].includes(input.signal)) {
    throw new Error(`signal must be one of: viewers, chat, cheer, raid`);
  }

  const observation = {
    id: `helix_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    provider: "twitch-helix",
    streamer: input.streamer, // Twitch user_id (public, non-identifying)

    // Observation signal (never includes raw data)
    signal: input.signal, // viewers | chat | cheer | raid
    count: input.count || 1, // Aggregate count only
    observedAt: input.observedAt || new Date().toISOString(),

    // Pseudonymous participant (never stored raw)
    participantId: input.participantId || null, // Opaque hash, not user login

    // Evidence metadata (for audit trail)
    evidence: {
      source: "twitch-helix",
      endpoint: input.endpoint || null, // /users/{id}, /moderation/banned, etc.
      cached: input.cached || false,
      cacheAgeSeconds: input.cacheAgeSeconds || 0,
    },

    // CRITICAL: observation only
    payoutInput: false, // Never used for payout calculation
    monetized: false, // Never monetized
  };

  return observation;
}

/**
 * RLAN engagement mark: non-transferable record linking observation to evidence.
 *
 * Binds:
 * - Frozen mark (sportsbook evidence: Polymarket resolution)
 * - Creator attestation (signer identity, never invoked)
 * - Twitch observations (viewer counts, chat, etc. - observation only)
 *
 * Constraints:
 * - Non-transferable: cannot move or reassign
 * - Observation-only: Twitch data never inputs to payouts
 * - Creator attestation: who claimed the engagement
 * - Fail-closed: no signer invocation
 */
export function createEngagementMark(frozenMark, creator, observations) {
  if (!frozenMark || frozenMark.frozen !== true) {
    throw new Error("engagement mark requires frozen sportsbook mark");
  }
  if (!creator || typeof creator !== "string") {
    throw new Error("engagement mark requires creator solanaPubkey");
  }
  if (!Array.isArray(observations) || observations.length === 0) {
    throw new Error("engagement mark requires at least one observation");
  }

  // Validate all observations are Helix and observation-only
  for (const obs of observations) {
    if (obs.provider !== "twitch-helix") {
      throw new Error(`all observations must be from twitch-helix, got ${obs.provider}`);
    }
    if (obs.payoutInput !== false) {
      throw new Error("Twitch observation must never be payout input");
    }
    if (obs.monetized !== false) {
      throw new Error("Twitch observation must never be monetized");
    }
  }

  const mark = {
    id: `rlan_engagement_${frozenMark.id}`,
    markId: frozenMark.id,
    creator: creator, // Signer identity, never invoked

    // Sportsbook evidence (context only)
    sportsbook: {
      gameId: frozenMark.gameId || null,
      resolvedOutcome: frozenMark.resolvedOutcome || null,
      citedAt: frozenMark.citedAt || null,
    },

    // Twitch observations (never payout input)
    observations: observations,
    observationSummary: summarizeObservations(observations),

    // Engagement metrics (derived from observations)
    engagement: {
      viewerPeakCount: Math.max(...observations.filter((o) => o.signal === "viewers").map((o) => o.count || 0)),
      chatEventsCount: observations.filter((o) => o.signal === "chat").length,
      cheersCount: observations.filter((o) => o.signal === "cheer").reduce((sum, o) => sum + (o.count || 0), 0),
      raidsCount: observations.filter((o) => o.signal === "raid").length,
    },

    // Non-transferable record
    transferable: false,
    observationOnly: true, // Twitch data never in payout

    createdAt: new Date().toISOString(),
  };

  return mark;
}

/**
 * Summarize observations without exposing user data.
 * Used for audit trail; never in payout calculations.
 */
function summarizeObservations(observations) {
  const summary = {
    totalObservations: observations.length,
    signalCounts: {
      viewers: 0,
      chat: 0,
      cheer: 0,
      raid: 0,
    },
    timeRange: {
      earliest: null,
      latest: null,
    },
  };

  for (const obs of observations) {
    summary.signalCounts[obs.signal]++;

    if (!summary.timeRange.earliest || obs.observedAt < summary.timeRange.earliest) {
      summary.timeRange.earliest = obs.observedAt;
    }
    if (!summary.timeRange.latest || obs.observedAt > summary.timeRange.latest) {
      summary.timeRange.latest = obs.observedAt;
    }
  }

  return summary;
}

/**
 * Validate RLAN engagement mark constraints.
 *
 * @throws {Error} if constraint violated
 */
export function validateEngagementMarkConstraints(mark) {
  // Non-transferable
  if (mark.transferable !== false) {
    throw new Error("RLAN mark must be non-transferable");
  }

  // Observation-only (never payout input)
  if (mark.observationOnly !== true) {
    throw new Error("RLAN mark must be observation-only (never payout input)");
  }

  // Creator attestation required
  if (!mark.creator || typeof mark.creator !== "string") {
    throw new Error("RLAN mark requires creator attestation");
  }

  // All observations must be Helix
  if (!Array.isArray(mark.observations)) {
    throw new Error("RLAN mark must have observations array");
  }

  for (const obs of mark.observations) {
    if (obs.provider !== "twitch-helix") {
      throw new Error(`RLAN observations must be from twitch-helix, got ${obs.provider}`);
    }
    if (obs.payoutInput !== false) {
      throw new Error("RLAN observation must never be payout input");
    }
    if (obs.monetized !== false) {
      throw new Error("RLAN observation must never be monetized");
    }
  }
}

/**
 * Prepare RLAN batch from slate with Helix observations.
 *
 * Links frozen marks to creator attestations and Twitch observations.
 * Creates engagement marks while enforcing observation-only constraint.
 *
 * @param {Object} slate - The slate document
 * @param {Array} observationsByMark - {markId, observations: []}
 * @returns {Array} Validated engagement marks
 */
export function prepareRLANBatch(slate, observationsByMark) {
  if (!slate || !Array.isArray(slate.marks)) {
    throw new Error("slate must have marks array");
  }
  if (!Array.isArray(observationsByMark)) {
    throw new Error("observationsByMark must be array");
  }

  const frozenMarks = slate.marks.filter((m) => m.frozen === true);
  const markMap = new Map(frozenMarks.map((m) => [m.id, m]));
  const observationMap = new Map(observationsByMark.map((o) => [o.markId, o.observations]));

  const engagementMarks = [];

  for (const markId of observationMap.keys()) {
    try {
      const frozenMark = markMap.get(markId);
      if (!frozenMark) {
        console.warn(`Skipping observations for unknown mark ${markId}`);
        continue;
      }

      const observations = observationMap.get(markId) || [];
      if (observations.length === 0) {
        console.warn(`Skipping mark ${markId}: no observations`);
        continue;
      }

      // Creator is the mark's signer (their solanaPubkey)
      const mark = createEngagementMark(frozenMark, frozenMark.solanaPubkey, observations);
      validateEngagementMarkConstraints(mark);
      engagementMarks.push(mark);
    } catch (err) {
      console.error(`Failed to prepare RLAN mark ${markId}: ${err.message}`);
      continue;
    }
  }

  return engagementMarks;
}

/**
 * Encode engagement mark for RLAN chain storage.
 *
 * Strips internal flags (transferable, observationOnly).
 * Keeps: creator, observations summary, engagement metrics.
 * Never includes: raw Twitch user data.
 *
 * @param {Object} mark - Validated engagement mark
 * @returns {string} JSON for on-chain storage
 */
export function encodeEngagementMarkData(mark) {
  const data = {
    markId: mark.markId,
    creator: mark.creator,
    gameId: mark.sportsbook.gameId,
    resolvedOutcome: mark.sportsbook.resolvedOutcome,

    // Observations summary (no raw user data)
    observationSummary: mark.observationSummary,
    engagement: mark.engagement,

    createdAt: mark.createdAt,
  };

  return JSON.stringify(data);
}

/**
 * Validate Twitch token availability (read-only check).
 *
 * Does NOT store or log the token. Only checks availability.
 * Fail-closed: returns false if token unavailable.
 *
 * @param {string} token - Twitch API token (from Doppler env)
 * @returns {boolean} true if token is valid string
 */
export function validateTwitchCredentials(token) {
  if (!token || typeof token !== "string" || token.length < 32) {
    return false;
  }
  return true;
}

/**
 * Create RLAN batch status tracker.
 *
 * Tracks engagement marks through RLAN chain write lifecycle.
 */
export function createRLANBatchStatus(engagementMarks) {
  return {
    batchId: `rlan_batch_${Date.now()}`,
    marks: engagementMarks.map((m) => ({
      id: m.id,
      markId: m.markId,
      status: "pending",
      txSignature: null,
      onChainAddress: null,
      error: null,
    })),
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}
