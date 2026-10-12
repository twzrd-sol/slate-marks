/**
 * ICELAN reward credential adapter for slate-marks.
 *
 * Creates non-transferable reward credential records bound to RLAN engagement marks.
 * Credentials are unpriced attestations — they are not bets, payouts, or transfers.
 *
 * CRITICAL CONSTRAINT:
 * ICELAN credentials input is an RLAN MARK REFERENCE (markId + rlanMarkId), not a full
 * RLAN engagement mark. This ensures the credential references the mark, not embedding
 * Twitch observations. Passing a full RLAN mark (with observations) throws.
 *
 * Chain: frozen mark → RLAN engagement mark → ICELAN credential
 *
 * Policy constraints (from docs/NON_GOALS.md):
 * - Input: reference to RLAN mark (never full object with observations)
 * - Non-transferable record (signer identity, never invoked)
 * - Never monetized (unpriced credential, credibility only)
 * - Creator attestation required
 * - All credentials from Doppler env
 */

/**
 * Create an ICELAN reward credential bound to an RLAN engagement mark.
 *
 * Input: reference to RLAN mark (markId + rlanMarkId), not the full mark object.
 * Output: non-transferable credential record keyed to the RLAN PDA.
 *
 * CRITICAL CONSTRAINT: input must be a reference. Passing a full RLAN mark
 * (with observations, engagement) still throws to prevent confusion.
 */
export function createRewardCredential(rlanReference, creator) {
  if (!rlanReference || typeof rlanReference !== "object") {
    throw new Error("credential requires RLAN mark reference object");
  }
  if (!rlanReference.markId || typeof rlanReference.markId !== "string") {
    throw new Error("credential reference requires markId");
  }
  if (!rlanReference.rlanMarkId || typeof rlanReference.rlanMarkId !== "string") {
    throw new Error("credential reference requires rlanMarkId");
  }
  if (!creator || typeof creator !== "string") {
    throw new Error("credential requires creator solanaPubkey");
  }

  // CRITICAL CONSTRAINT: reject if input carries full RLAN mark fields
  if (rlanReference.observations) {
    throw new Error("ICELAN input must not carry observations (pass reference only)");
  }
  if (rlanReference.observationSummary) {
    throw new Error("ICELAN input must not carry observationSummary (pass reference only)");
  }
  if (rlanReference.engagement) {
    throw new Error("ICELAN input must not carry engagement (pass reference only)");
  }

  // If gameId/resolvedOutcome are present, they're from the reference
  const credential = {
    id: `icelan_credential_${rlanReference.markId}`,
    markId: rlanReference.markId,
    rlanMarkId: rlanReference.rlanMarkId, // Reference to RLAN engagement PDA
    creator: creator, // Signer identity, never invoked

    // Sportsbook evidence (context only)
    gameId: rlanReference.gameId || null,
    resolvedOutcome: rlanReference.resolvedOutcome || null,
    citedAt: rlanReference.citedAt || null,

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
 * Prepare ICELAN batch from slate + RLAN engagement marks.
 *
 * Creates credentials for each RLAN engagement mark.
 * Requires engagement marks to have markId + rlanMarkId.
 * Skips marks with missing engagement data (logs warning).
 *
 * @param {Object} slate - The slate document
 * @param {Array} engagementMarksByMarkId - Array of {markId, rlanMarkId, gameId, resolvedOutcome, ...}
 * @returns {Array} Validated reward credentials
 */
export function prepareICELANBatch(slate, engagementMarksByMarkId = []) {
  if (!Array.isArray(engagementMarksByMarkId)) {
    throw new Error("engagementMarksByMarkId must be array");
  }

  const credentials = [];

  for (const engagementMark of engagementMarksByMarkId) {
    try {
      // Create RLAN reference from engagement mark
      const rlanReference = {
        markId: engagementMark.markId,
        rlanMarkId: engagementMark.rlanMarkId || engagementMark.id,
        gameId: engagementMark.gameId,
        resolvedOutcome: engagementMark.resolvedOutcome,
        citedAt: engagementMark.citedAt,
      };

      const credential = createRewardCredential(
        rlanReference,
        engagementMark.creator || (slate?.creator)
      );
      validateCredentialConstraints(credential);
      credentials.push(credential);
    } catch (err) {
      console.error(
        `Failed to prepare ICELAN credential for engagement ${engagementMark.rlanMarkId}: ${err.message}`
      );
      continue;
    }
  }

  return credentials;
}

/**
 * Encode credential for ICELAN chain storage.
 *
 * Strips internal flags (transferable, monetized).
 * Keeps: creator, markId, rlanMarkId, gameId, resolvedOutcome, timestamps.
 *
 * @param {Object} credential - Validated reward credential
 * @returns {string} JSON for on-chain storage
 */
export function encodeCredentialData(credential) {
  const data = {
    markId: credential.markId,
    rlanMarkId: credential.rlanMarkId,
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
