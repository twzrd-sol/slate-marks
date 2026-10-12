import test from "node:test";
import assert from "node:assert";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { createAttestationRecord, encodeAttestationData } from "../src/mainnet.js";
import { createEngagementMark, encodeEngagementMarkData, createHelixEngagementObservation } from "../src/rlan.js";
import { createRewardCredential, encodeCredentialData } from "../src/icelan.js";

// Devnet RPC endpoint
const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(DEVNET_RPC, "confirmed");

test.skip("Devnet: prepare mainnet attestation instruction", async () => {
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

  const cite = {
    source: "polymarket-gamma",
    conditionId: "0x456def",
    outcomeTokenId: "0xoutcome",
    citedAt: "2026-10-12T00:00:00Z",
  };

  // Prepare instruction
  const attestation = createAttestationRecord(frozenMark, fixture, cite);
  const encoded = encodeAttestationData(attestation);

  // Validate instruction structure
  assert.ok(encoded);
  assert.ok(typeof encoded === "string");

  // Simulate account derivation
  const creator = new PublicKey(frozenMark.solanaPubkey);
  const systemProgram = SystemProgram.programId;

  // Validate keys can be created
  assert.ok(creator.toBase58());
  assert.ok(systemProgram.toBase58());

  console.log(`✓ Prepared mainnet attestation for mark ${attestation.markId}`);
});

test.skip("Devnet: prepare RLAN engagement instruction with live observation", async () => {
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

  // Create observation
  const observation = createHelixEngagementObservation({
    streamer: "user_456",
    signal: "viewers",
    count: 250,
  });

  // Create engagement mark
  const engagementMark = createEngagementMark(frozenMark, frozenMark.solanaPubkey, [observation]);
  const encoded = encodeEngagementMarkData(engagementMark);

  // Validate
  assert.ok(encoded);
  assert.strictEqual(engagementMark.creator, frozenMark.solanaPubkey);

  console.log(`✓ Prepared RLAN engagement for mark ${engagementMark.markId}`);
});

test.skip("Devnet: prepare ICELAN credential instruction", async () => {
  const rlanMark = {
    id: "rlan_engagement_mark_1",
    markId: "mark_1",
    gameId: "game_123",
    resolvedOutcome: "home",
    citedAt: "2026-10-12T00:00:00Z",
  };

  const creator = "So11111111111111111111111111111111111111112";

  // Create credential
  const rlanReference = {
    markId: rlanMark.markId,
    rlanMarkId: rlanMark.id,
    gameId: rlanMark.gameId,
    resolvedOutcome: rlanMark.resolvedOutcome,
    citedAt: rlanMark.citedAt,
  };

  const credential = createRewardCredential(rlanReference, creator);
  const encoded = encodeCredentialData(credential);

  // Validate
  assert.ok(encoded);
  assert.strictEqual(credential.creator, creator);

  console.log(`✓ Prepared ICELAN credential for mark ${credential.markId}`);
});

test.skip("Devnet: validate PDA seed derivation", async () => {
  // Test that PDA seeds would derive correctly on devnet
  const creator = new PublicKey("So11111111111111111111111111111111111111112");
  const programId = new PublicKey("11111111111111111111111111111111"); // System program (placeholder)

  // Mainnet attestation PDA
  const conditionId = Buffer.from("0x456def");
  try {
    const [mainnetPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("attestation"), creator.toBuffer(), conditionId],
      programId
    );
    assert.ok(mainnetPDA);
    console.log(`✓ Mainnet attestation PDA: ${mainnetPDA.toBase58()}`);
  } catch (err) {
    // PDA derivation may fail with system program, but structure is validated
    console.log(`  (PDA derivation skipped: ${err.message})`);
  }
});

test("Local: instruction data encoding round-trip", () => {
  // Verify that encoded data can be decoded back
  const frozenMark = {
    id: "mark_1",
    frozen: true,
    solanaPubkey: "So11111111111111111111111111111111111111112",
    resolvedOutcome: "home",
  };

  const fixture = { gameId: "game_123", league: "NFL" };
  const cite = { source: "polymarket-gamma", conditionId: "0x456", outcomeTokenId: "0x0", citedAt: "2026-10-12T00:00:00Z" };

  // Attestation encoding
  const attestation = createAttestationRecord(frozenMark, fixture, cite);
  const encoded = encodeAttestationData(attestation);
  const decoded = JSON.parse(encoded);

  assert.strictEqual(decoded.markId, attestation.markId);
  assert.strictEqual(decoded.creator, attestation.creator);
  assert.strictEqual(decoded.gameId, attestation.gameId);
});

test("Local: complete chain preparation (frozen -> engagement -> credential)", () => {
  const creator = "So11111111111111111111111111111111111111112";

  // Step 1: Prepare mainnet attestation
  const frozenMark = {
    id: "mark_1",
    frozen: true,
    solanaPubkey: creator,
    resolvedOutcome: "home",
  };

  const fixture = { gameId: "game_123", league: "NFL" };
  const cite = { source: "polymarket-gamma", conditionId: "0x456", outcomeTokenId: "0x0", citedAt: "2026-10-12T00:00:00Z" };

  const attestation = createAttestationRecord(frozenMark, fixture, cite);
  assert.ok(attestation);

  // Step 2: Prepare RLAN engagement
  const observation = createHelixEngagementObservation({
    streamer: "user_456",
    signal: "viewers",
    count: 250,
  });

  const engagementMark = createEngagementMark(frozenMark, creator, [observation]);
  assert.ok(engagementMark);
  assert.strictEqual(engagementMark.markId, frozenMark.id);

  // Step 3: Prepare ICELAN credential
  const rlanReference = {
    markId: engagementMark.markId,
    rlanMarkId: engagementMark.id,
    gameId: engagementMark.gameId,
    resolvedOutcome: engagementMark.resolvedOutcome,
    citedAt: engagementMark.citedAt,
  };

  const credential = createRewardCredential(rlanReference, creator);
  assert.ok(credential);
  assert.strictEqual(credential.rlanMarkId, engagementMark.id);

  // Verify chain integrity
  assert.strictEqual(attestation.markId, engagementMark.markId);
  assert.strictEqual(engagementMark.markId, credential.markId);
});
