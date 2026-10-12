# On-Chain Design: Slate-Marks Attestation Records

Design specification for non-transferable attestation record PDAs on Solana mainnet and the RLAN/ICELAN ecosystems.

## Overview

Slate-marks records sportsbook evidence (Polymarket outcomes, creator attestations, engagement observations) as three types of non-transferable records on three Solana systems:

1. **Mainnet attestation records** — Frozen marks binding Polymarket evidence to creator identity
2. **RLAN engagement marks** — Frozen marks + Twitch observations bound to engagement metrics (non-transferable by program logic)
3. **ICELAN credentials** — RLAN marks + creator attestation bound to unpriced reward credentials

**No token is minted by slate-marks.** Records are PDA accounts owned by existing programs. The adapter produces **unsigned instructions** handed to an external signer (ansem-radio station co-signer or operator).

## Primitive: PDA Accounts, Not Tokens

Non-transferable records are accounts owned by a program, not tokens. They cannot be transferred because they are not transfer-able SPL assets — they are program state.

```
Mainnet Program
├── attestation PDA ["attestation", creator, condition_id]
│   └── witness: Polymarket condition/resolved outcome
├── attestation PDA ["attestation", creator, condition_id]
└── ...

RLAN Program (TBD: existing or new, ansem-radio scope)
├── engagement PDA ["engagement", creator, mainnet_attestation_pda]
│   └── witness: observation summary + hashes
├── engagement PDA ["engagement", creator, mainnet_attestation_pda]
└── ...

ICELAN Rewards Program (5wAVbHfZ, ansem-radio rewards/prd)
├── credential PDA ["credential", creator, engagement_pda]
│   └── witness: proof of mark + engagement
├── credential PDA ["credential", creator, engagement_pda]
└── ...
```

## Mainnet Attestation Record

**PDA seed:** `["attestation", creator:&[u8;32], condition_id:&[u8;32]]`

**Discriminator:** `"mainnet_attestation"` (8 bytes for IDL/dispatch)

**Borsh layout** (fixed-size):

```rust
pub struct MainnetAttestationRecord {
    pub discriminator: [u8; 8],              // "mainnet_attestation"
    pub version: u8,                          // 1
    pub creator: [u8; 32],                    // Signer identity (Pubkey)
    pub game_id: [u8; 64],                    // Fixture identifier (UTF-8, null-padded)
    pub condition_id: [u8; 32],               // Polymarket condition (hash)
    pub resolved_outcome: u8,                 // 0 = unresolved, 1 = home, 2 = away, 3 = draw
    pub cited_at: i64,                        // Unix timestamp (seconds)
    pub created_at: i64,                      // Unix timestamp (seconds)
    pub padding: [u8; 31],                    // Align to 256 bytes
}
// Total: 8 + 1 + 32 + 64 + 32 + 1 + 8 + 8 + 31 = 185 bytes (round to 192)
```

**Invariants:**
- `creator` is a valid Pubkey (never checked by this program; assertion at sign time)
- `condition_id` uniquely identifies the Polymarket outcome
- `resolved_outcome` is fixed at init; **second write to the same seed fails** (PDA guard by construction)
- `cited_at` is the Polymarket snapshot timestamp
- Signer never invoked: instruction is unsigned, co-signed by another key

## RLAN Engagement Mark

**Design decision: RLAN program location deferred.** Ansem-radio will define the engagement mark structure. Slate-marks prepares a reference and observation summary.

**PDA seed (sketch):** `["engagement", creator:&[u8;32], mainnet_attestation_pda:&[u8;32]]`

**From slate-marks perspective (prepare*, encode*):**

Input: frozen mark + RLAN mark ID (reference only)
Output: unsigned instruction for RLAN program with:
- Observation signal counts (viewers, chat, cheers, raids): aggregates only
- Hash of observation metadata (timestamps, streamer ID): verifiable but not readable
- Reference to the mainnet attestation PDA (chaining)
- Creator attestation

**Observation data never goes on-chain raw.** Helix metrics are off-chain; the PDA stores:
- Aggregate counts (u32 per signal type)
- Hash of the full observation bundle (`sha256({ creator, streamer, signals, time_range })`)
- Time range (`i64, i64`)

This is verifiable (observer hash-checks the input) and non-identifiable (no Twitch usernames or stream details).

## ICELAN Credential

**Program:** `radiolan-rewards` (5wAVbHfZ, ansem-radio/prd)

**PDA seed:** `["credential", creator:&[u8;32], engagement_pda:&[u8;32]]`

**Discriminator:** `"icelan_credential"` (8 bytes for IDL/dispatch)

**Borsh layout** (fixed-size):

```rust
pub struct IcelanCredential {
    pub discriminator: [u8; 8],               // "icelan_credential"
    pub version: u8,                          // 1
    pub creator: [u8; 32],                    // Attestation signer (Pubkey)
    pub mark_id: [u8; 64],                    // Slate fixture identifier (UTF-8, null-padded)
    pub game_id: [u8; 64],                    // League/fixture string (UTF-8, null-padded)
    pub resolved_outcome: u8,                 // 0 = unresolved, 1 = home, 2 = away, 3 = draw
    pub engagement_pda: [u8; 32],             // Reference to RLAN engagement mark
    pub mainnet_pda: [u8; 32],                // Reference to mainnet attestation (for audit)
    pub cited_at: i64,                        // Evidence timestamp (seconds)
    pub created_at: i64,                      // Credential creation timestamp (seconds)
    pub padding: [u8; 15],                    // Align to 256 bytes
}
// Total: 8 + 1 + 32 + 64 + 64 + 1 + 32 + 32 + 8 + 8 + 15 = 265 bytes (round to 256)
```

**Invariants:**
- `creator` is a valid Pubkey
- `resolved_outcome` matches the mainnet attestation's resolved_outcome
- `engagement_pda` must exist and must reference this `mainnet_pda`
- **Second init to the same seed fails** (guard by construction)
- Signer never invoked: instruction is unsigned, co-signed by the ICELAN co-signer

## Signer Handoff: Unsigned Instructions

Slate-marks adapters produce **unsigned instructions** (accounts + data). The calling service (e.g., `/muse/mcp`) invokes an external signer.

**Who signs:**
- **Mainnet:** TBD (operator decision; likely a Squads multisig or the operator's own key)
- **RLAN:** TBD (same as mainnet, or ansem-radio station)
- **ICELAN:** ansem-radio station co-signer (`Bm3PX7BF…MAp5` as of 2026-10-09)

Slate-marks endpoint signature: `POST /slate-marks/prepare/<type>` (not `POST /attest`)
- Input: frozen mark (+ RLAN mark ID for ICELAN)
- Output: `{ instruction: { keys, data }, blockhash_required: true }`
- Caller: sign + submit or hand to a co-signer

## Data Encoding: Adapters to On-Chain

### `encodeAttestationData` (Mainnet)

Converts mainnet adapter's validated credential to Borsh:
```javascript
// Input (from src/mainnet.js):
{
  creator: "So11111...",
  gameId: "game_123",
  resolvedOutcome: "home",
  conditionId: "0x456def...",
  citedAt: "2026-10-12T00:00:00Z",
  createdAt: "2026-10-12T01:00:00Z"
}

// Output: Borsh-encoded MainnetAttestationRecord
// PDA seed: ["attestation", creator, condition_id]
```

### `encodeEngagementMarkData` (RLAN)

Converts RLAN adapter's engagement mark to observation summary + hash:
```javascript
// Input (from src/rlan.js):
{
  creator: "So11111...",
  markId: "mark_1",
  engagement: {
    viewerPeakCount: 250,
    chatEventsCount: 1,
    cheersCount: 0,
    raidsCount: 0
  },
  observationSummary: { ... }
}

// Output: Observation counts + hash (for RLAN program)
// Hash: sha256({ creator, streamer, signals, time_range })
// PDA seed: ["engagement", creator, mainnet_attestation_pda]
```

### `encodeCredentialData` (ICELAN)

Converts ICELAN adapter's credential to Borsh:
```javascript
// Input (from src/icelan.js):
// Fixed: must include engagement_pda (reference)
// Old: frozen mark only (WRONG)
// New: { markId, gameId, resolvedOutcome, creator, engagementPdaId, mainnetPdaId, ... }

{
  creator: "So11111...",
  markId: "mark_1",
  gameId: "game_123",
  resolvedOutcome: "home",
  citedAt: "2026-10-12T00:00:00Z",
  createdAt: "2026-10-12T01:00:00Z",
  rlanMarkId: "rlan_engagement_mark_1"  // Reference to RLAN PDA
}

// Output: Borsh-encoded IcelanCredential
// PDA seed: ["credential", creator, engagement_pda]
```

## Chain of Custody: Seed Uniqueness

**Mainnet:** Two attestation records for the same `(creator, condition_id)` pair fail init:
```
PDA seed: ["attestation", creator, condition_id] → unique per creator per condition
Second call with same seed → CPI to same PDA → PDA already exists → init fails ✓
```

**RLAN:** Two engagement marks for the same `(creator, mainnet_attestation_pda)` pair fail init:
```
PDA seed: ["engagement", creator, mainnet_attestation_pda] → unique per creator per mainnet record
Second call → CPI to same PDA → already exists → fails ✓
```

**ICELAN:** Two credentials for the same `(creator, engagement_pda)` pair fail init:
```
PDA seed: ["credential", creator, engagement_pda] → unique per creator per engagement
Second call → CPI to same PDA → already exists → fails ✓
```

This enforces the policy: *"A second mark for that same pair throws."*

## Twitch Data On-Chain: Constraints

**RLAN engagement marks store:**
- Observation signal counts (aggregate only): viewers, chat, cheers, raids
- Timestamp range: earliest and latest observed_at
- Hash of the full observation bundle (off-chain-verifiable)
- NO raw user data: no chat text, no viewer logins, no stream metadata

**ICELAN credentials can never read Twitch data:**
- ICELAN credential references an RLAN engagement PDA
- ICELAN program can CPI the RLAN program to fetch the engagement record
- The engagement record contains counts and a hash, never raw Twitch data
- If a future ICELAN instruction tries to use viewer counts in a calculation, the PDA layout prevents it (the field is a hash, not a count)

**Verifiability without exposure:**
- Observer (e.g., /muse/mcp) hashes the full observation bundle
- Compares to `observation_hash` on the RLAN PDA
- If match: observations are authentic
- ICELAN program never reads raw observations; it sees only the hash ✓

## Out of Scope (Doctrine Confirmed)

- **No new token:** all three systems integrate existing RLAN (Token-2022) and ICELAN (classic SPL) from ansem-radio
- **No program code:** slate-marks produces instruction data; programs are ansem-radio's responsibility
- **No chain code:** instruction prep, signing, and submission are external to slate-marks
- **No signer invocation:** all instructions are unsigned; the caller co-signs or hands to an external signer

## References

- `docs/NON_GOALS.md` — Policy constraints
- `docs/MAINNET_ADAPTER.md` — Mainnet adapter (src/mainnet.js)
- `docs/RLAN_ADAPTER.md` — RLAN adapter (src/rlan.js)
- `docs/ICELAN_ADAPTER.md` — ICELAN adapter (src/icelan.js)
- `~/ansem-radio/` (private) — Solana programs, token mints, vault PDAs
- `memory/two-token-model-20261005.md` (ansem-radio) — Token model and program architecture
- `memory/icelan-claims-live-20261009.md` (ansem-radio) — ICELAN vault and rewards program state
