/**
 * Solana mainnet attribution adapter for slate-marks.
 *
 * Creates non-transferable attribution records binding sportsbook evidence
 * (Polymarket marks) to creator contributions on Solana mainnet.
 *
 * Policy constraints (from docs/NON_GOALS.md):
 * - No signer invocation; signerInvocations stays 0, failClosed true
 * - Non-transferable attribution record (token may be transferable)
 * - All credentials from Doppler env; no secrets in argv
 * - Never monetizes the mark
 */

import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Attestation record: non-transferable evidence binding.
 *
 * Links a frozen mark to:
 * - Polymarket evidence: resolvedOutcome, conditionId
 * - Creator attestation: solanaPubkey (signer's identity, not invoked)
 * - Observation timestamp: when frozen
 */
export function createAttestationRecord(frozenMark, fixture, cite) {
  if (!frozenMark || frozenMark.frozen !== true) {
    throw new Error("attestation requires a frozen mark");
  }
  if (!frozenMark.resolvedOutcome) {
    throw new Error("attestation requires resolved outcome");
  }

  const record = {
    id: `attestation_${frozenMark.id}`,
    markId: frozenMark.id,
    creator: frozenMark.solanaPubkey,

    // Evidence: Polymarket resolution (strongest)
    evidence: {
      source: cite.source, // "polymarket-gamma"
      conditionId: cite.conditionId,
      outcomeTokenId: cite.outcomeTokenId,
      resolvedOutcome: frozenMark.resolvedOutcome,
      citedAt: cite.citedAt,
      strength: "signed", // Polymarket attestation
    },

    // Fixture context
    gameId: fixture.gameId,
    league: fixture.league || null,

    // Non-transferable: cannot be moved or reassigned
    transferable: false,
    createdAt: new Date().toISOString(),

    // Never monetized: mark is credibility only
    monetized: false,
  };

  return record;
}

/**
 * Prepare attestation batch for mainnet write.
 *
 * Reads frozen marks from slate, creates attestation records,
 * validates all constraints, and returns ready-to-write batch.
 *
 * @param {Object} slate - The slate document from SQLite
 * @returns {Array} Array of valid attestation records
 */
export function prepareMainnetBatch(slate) {
  if (!slate || !Array.isArray(slate.marks)) {
    throw new Error("slate must have marks array");
  }

  const frozenMarks = slate.marks.filter((m) => m.frozen === true);
  const attestations = [];

  for (const mark of frozenMarks) {
    try {
      const cite = slate.cites.find((c) => c.id === mark.outcomeCiteId);
      const fixture = slate.fixtures.find((f) => f.id === mark.fixtureId);

      if (!cite || !fixture) {
        console.warn(`Skipping mark ${mark.id}: missing cite or fixture`);
        continue;
      }

      const attestation = createAttestationRecord(mark, fixture, cite);
      validateAttestationConstraints(attestation);
      attestations.push(attestation);
    } catch (err) {
      console.error(`Failed to prepare mark ${mark.id}: ${err.message}`);
      continue;
    }
  }

  return attestations;
}

/**
 * Validate attestation meets all policy constraints.
 *
 * @throws {Error} if constraint violated
 */
export function validateAttestationConstraints(attestation) {
  // Non-transferable: cannot be moved
  if (attestation.transferable !== false) {
    throw new Error("attestation must be non-transferable");
  }

  // Never monetized: credibility only
  if (attestation.monetized !== false) {
    throw new Error("attestation must never be monetized");
  }

  // Must have creator identity (signer, but not invoked)
  if (!attestation.creator || typeof attestation.creator !== "string") {
    throw new Error("attestation requires creator solanaPubkey");
  }

  // Must have Polymarket evidence
  if (!attestation.evidence || attestation.evidence.source !== "polymarket-gamma") {
    throw new Error("attestation must have polymarket-gamma evidence");
  }

  // Evidence must be resolved
  if (!attestation.evidence.resolvedOutcome) {
    throw new Error("attestation evidence must have resolved outcome");
  }
}

/**
 * Format attestation for on-chain storage.
 *
 * Creates a compact JSON representation ready for non-transferable SPL record.
 * Never includes signer key material; creator field is a pubkey reference only.
 *
 * @param {Object} attestation - Validated attestation record
 * @returns {string} JSON string for on-chain storage
 */
export function encodeAttestationData(attestation) {
  const data = {
    markId: attestation.markId,
    creator: attestation.creator,
    gameId: attestation.gameId,
    resolvedOutcome: attestation.evidence.resolvedOutcome,
    conditionId: attestation.evidence.conditionId,
    citedAt: attestation.evidence.citedAt,
    createdAt: attestation.createdAt,
  };

  return JSON.stringify(data);
}

/**
 * Mainnet batch status: ready, pending, or error.
 *
 * Tracks attestation records through mainnet write lifecycle.
 */
export function createBatchStatus(attestations) {
  return {
    batchId: `batch_${Date.now()}`,
    attestations: attestations.map((a) => ({
      id: a.id,
      status: "pending",
      txSignature: null,
      onChainAddress: null,
      error: null,
    })),
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

/**
 * Validate mainnet connection (read-only check).
 *
 * Does NOT invoke signer. Only verifies RPC availability.
 * Fail-closed: if RPC unavailable, mark as "cannot attest" and continue.
 *
 * @param {Connection} connection - Solana RPC connection
 * @returns {Promise<boolean>} true if RPC responds
 */
export async function validateMainnetConnection(connection) {
  try {
    const slot = await connection.getSlot();
    return slot > 0;
  } catch (err) {
    console.warn(`Mainnet RPC unavailable: ${err.message}`);
    return false;
  }
}
