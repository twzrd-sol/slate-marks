# ICELAN Reward Credential Adapter

ICELAN integration for slate-marks. Creates non-transferable unpriced reward credential records bound to RLAN engagement marks.

Credentials are attestations of contribution — not bets, not prices, not transfers. The signer stays uninvoked.

## Design

### Reward Credential

Non-transferable record created from an RLAN engagement mark reference:

```javascript
{
  id: "icelan_credential_mark_1",
  markId: "mark_1",
  rlanMarkId: "rlan_engagement_mark_1",  // Reference to RLAN PDA
  creator: "So11111111111111111111111111111111111111112", // Signer identity (never invoked)

  // Sportsbook evidence (context only)
  gameId: "game_123",
  resolvedOutcome: "home",
  citedAt: "2026-10-12T00:00:00Z",

  // Non-transferable, unpriced
  transferable: false,
  monetized: false,

  createdAt: "2026-10-12T01:00:00Z"
}
```

### Chain of Records

ICELAN credentials complete the chain:

```
Frozen Mark (Polymarket evidence)
    ↓
RLAN Engagement Mark (Twitch observations)
    ↓
ICELAN Credential (Unpriced credential, references RLAN)
```

### Critical Constraint: Reference, Not Full Object

ICELAN input is **an RLAN mark reference**, not a full RLAN mark object. Input must never carry:
- `observations` (RLAN engagement data)
- `observationSummary` (RLAN aggregates)
- `engagement` (RLAN derived metrics)

This enforces the policy: "Twitch data never in reward calculation." Credentials reference the RLAN mark (which holds observations), never embed them.

**Test:** `createRewardCredential` throws if input is a full RLAN object (with observations).

## Policy Constraints (Binding)

All constraints from `docs/NON_GOALS.md` are enforced:

1. **No RLAN observations in input**
   - Input must be a reference object only (markId + rlanMarkId)
   - Rejects if observations/observationSummary/engagement present
   - Ensures credentials reference observations, never embed them
   - Twitch data stays observation-only

2. **Non-transferable record**
   - `transferable: false` enforced on every credential
   - Cannot move between accounts
   - Cannot be reassigned

3. **Never monetized**
   - `monetized: false` enforced
   - Credential is credibility, not value transfer
   - No payout flows, no yield

4. **Creator attestation required**
   - `creator` is signer identity reference (never invoked)
   - Fail-closed by default

5. **All credentials from Doppler env**
   - No secrets in argv
   - RPC calls use env credentials only

## Data Flow

```
RLAN Engagement Mark (with observations)
    ↓
Reference Extraction { markId, rlanMarkId }
    ↓
createRewardCredential()  ← Rejects if observations present
    ↓
validateCredentialConstraints()  ← Enforces all 4 constraints
    ↓
Validated Reward Credential
    ↓
encodeCredentialData()  ← Strips internal flags, includes rlanMarkId
    ↓
JSON ready for ICELAN chain storage
```

## API

### `createRewardCredential(rlanReference, creator)`

Creates a credential from an RLAN engagement mark reference.

**Requires:**
- `rlanReference.markId`: Slate fixture identifier (string)
- `rlanReference.rlanMarkId`: RLAN engagement PDA identifier (string)
- `rlanReference.gameId`: League/fixture string (optional)
- `rlanReference.resolvedOutcome`: Outcome from frozen mark (optional)
- `creator`: Signer pubkey (string)
- `rlanReference` must NOT have `observations`, `observationSummary`, or `engagement`

**Returns:** Credential with `transferable: false`, `monetized: false`, `rlanMarkId` included

**Throws:** If reference is a full RLAN object or input invalid

### `validateCredentialConstraints(credential)`

Validates against all 4 constraints.

**Throws:** Immediately on any violation

### `encodeCredentialData(credential)`

Encodes for on-chain storage.

**Excludes:**
- `transferable` (enforced by SPL)
- `monetized` (enforced by contract)

**Includes:**
- `creator`, `markId`, `rlanMarkId`
- `gameId`, `resolvedOutcome`
- `citedAt`, `createdAt`

### `prepareICELANBatch(slate, engagementMarksByMarkId)`

Prepares batch from RLAN engagement marks.

**Input:** Array of engagement marks (with markId + rlanMarkId)

**Returns:** Array of validated credentials

**Skips:** Marks with missing engagement data (logs warning)

### `createCredentialBatchStatus(credentials)`

Tracks credentials through chain write lifecycle.

## Testing

11 tests cover:
- RLAN reference rejection (3 tests: observations, observationSummary, engagement)
- Reference field validation (2 tests: markId, rlanMarkId required)
- Constraint validation (3 tests: non-transferable, monetized, valid)
- JSON encoding (1 test: includes rlanMarkId, strips flags)
- Batch status tracking (1 test)

All tests pass. Run: `npm test -- test/icelan.test.js`

## Integration Checklist

- [ ] RLAN engagement mark data source (how marks are provided to ICELAN)
- [ ] Token-2022 NonTransferable layout (shared with RLAN)
- [ ] On-chain credential PDAs (ICELAN layout)
- [ ] Write endpoint (`POST /prepare/icelan`)
- [ ] Link credential creation to frozen mark + engagement flow
- [ ] Integrate with /muse/mcp for credential claims
- [ ] Add integration tests with live devnet RPC
- [ ] Security review: credential handling, no payout confusion
- [ ] Leak scan before public push

## Critical Constraints Reminder

**REFERENCE ONLY, NOT FULL OBJECT:**
- Input is RLAN mark reference (markId + rlanMarkId)
- Never accept observations/observationSummary/engagement
- Ensures Twitch data is not embedded in credential
- Enforces policy: "Twitch data never in reward calculation"

**NON-TRANSFERABLE:**
- Record cannot move between accounts
- Cannot be sold or traded
- Binds to original mark owner only

**UNPRICED:**
- Credential is attestation, not value
- No payout flows
- No monetization

**NO SIGNER INVOCATION:**
- Creator field is identity reference only
- No signing operations
- Fail-closed by default

## References

- `docs/ICELAN_ADAPTER.md` — This design specification
- `docs/NON_GOALS.md` — Policy constraints (binding)
- `docs/ONCHAIN_DESIGN.md` — PDA layouts and Borsh encoding
- `docs/MAINNET_ADAPTER.md` — Mainnet adapter (parallel integration)
- `docs/RLAN_ADAPTER.md` — RLAN adapter (observations only)
- `test/icelan.test.js` — Full constraint validation tests
