/**
 * ICELAN reward credential adapter for slate-marks.
 *
 * Creates non-transferable reward credential records bound to frozen marks.
 * Credentials are unpriced attestations — they are not bets, payouts, or transfers.
 *
 * CRITICAL CONSTRAINT:
 * ICELAN credentials input is FROZEN MARKS ONLY. Never accept RLAN engagement marks
 * (which carry observations, observationSummary, engagement). This ensures Twitch data
 * never inputs to credential calculations.
 *
 * Policy constraints (from docs/NON_GOALS.md):
 * - Input: frozen marks only (never RLAN engagement marks with observations)
 * - Non-transferable record (signer identity, never invoked)
 * - Never monetized (unpriced credential, credibility only)
 * - Creator attestation required
 * - All credentials from Doppler env
 */

/**
 * Create an ICELAN reward credential from a frozen mark.
 *
 * Input MUST be a frozen mark (no observations, engagement, or RLAN fields).
 * Output is a non-transferable credential record.
 */
export function createRewardCredential(frozenMark, creator) {
  if (!frozenMark || frozenMark.frozen !== true) {
    throw new Error("credential requires frozen sportsbook mark");
  }
  if (!creator || typeof creator !== "string") {
    throw new Error("credential requires creator solanaPubkey");
  }

  // CRITICAL CONSTRAINT: reject if input carries RLAN fields
  if (frozenMark.observations) {
    throw new Error("ICELAN input must not carry observations (RLAN field)");
  }
  if (frozenMark.observationSummary) {
    throw new Error("ICELAN input must not carry observationSummary (RLAN field)");
  }
  if (frozenMark.engagement) {
    throw new Error("ICELAN input must not carry engagement (RLAN field)");
  }

  const credential = {
    id: `icelan_credential_${frozenMark.id}`,
    markId: frozenMark.id,
    creator: creator, // Signer identity, never invoked

    // Sportsbook evidence (context only)
    gameId: frozenMark.gameId || null,
    resolvedOutcome: frozenMark.resolvedOutcome || null,
    citedAt: frozenMark.citedAt || null,

    // Non-transferable, unpriced credential
    transferable: false,
    monetized: false,

    createdAt: new Date().toISOString(),
  };

  return credential;
}

/**
 * Validate ICELAN credential constraints.
 *
 * @throws {Error} if constraint violated
 */
export function validateCredentialConstraints(credential) {
  // Non-transferable
  if (credential.transferable !== false) {
    throw new Error("ICELAN credential must be non-transferable");
  }

  // Never monetized
  if (credential.monetized !== false) {
    throw new Error("ICELAN credential must never be monetized");
  }

  // Creator attestation required
  if (!credential.creator || typeof credential.creator !== "string") {
    throw new Error("ICELAN credential requires creator attestation");
  }

  // GameId is contextual
  if (!credential.gameId) {
    throw new Error("ICELAN credential requires gameId");
  }
}

/**
 * Prepare ICELAN batch from slate.
 *
 * Creates credentials for all frozen marks in the slate.
 * Skips unfrozen marks (logs warning).
 */
export function prepareICELANBatch(slate) {
  if (!slate || !Array.isArray(slate.marks)) {
    throw new Error("slate must have marks array");
  }

  const frozenMarks = slate.marks.filter((m) => m.frozen === true);
  const credentials = [];

  for (const mark of frozenMarks) {
    try {
      const credential = createRewardCredential(mark, mark.solanaPubkey);
      validateCredentialConstraints(credential);
      credentials.push(credential);
    } catch (err) {
      console.error(`Failed to prepare ICELAN credential for mark ${mark.id}: ${err.message}`);
      continue;
    }
  }

  return credentials;
}

/**
 * Encode credential for ICELAN chain storage.
 *
 * Strips internal flags (transferable, monetized).
 * Keeps: creator, gameId, resolvedOutcome.
 *
 * @param {Object} credential - Validated reward credential
 * @returns {string} JSON for on-chain storage
 */
export function encodeCredentialData(credential) {
  const data = {
    markId: credential.markId,
    creator: credential.creator,
    gameId: credential.gameId,
    resolvedOutcome: credential.resolvedOutcome,
    citedAt: credential.citedAt,
    createdAt: credential.createdAt,
  };

  return JSON.stringify(data);
}

/**
 * Create ICELAN batch status tracker.
 *
 * Tracks credentials through ICELAN chain write lifecycle.
 */
export function createCredentialBatchStatus(credentials) {
  return {
    batchId: `icelan_batch_${Date.now()}`,
    credentials: credentials.map((c) => ({
      id: c.id,
      markId: c.markId,
      status: "pending",
      txSignature: null,
      onChainAddress: null,
      error: null,
    })),
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}
