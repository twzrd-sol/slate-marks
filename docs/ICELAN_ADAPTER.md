# ICELAN Reward Credential Adapter

ICELAN integration for slate-marks. Creates non-transferable unpriced reward credential records bound to frozen marks.

Credentials are attestations of contribution — not bets, not prices, not transfers. The signer stays uninvoked.

## Design

### Reward Credential

Non-transferable record created from a frozen mark:

```javascript
{
  id: "icelan_credential_mark_1",
  markId: "mark_1",
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

### Critical Constraint: No RLAN Observations

ICELAN input is **frozen marks only**. Input must never carry:
- `observations` (RLAN engagement data)
- `observationSummary` (RLAN aggregates)
- `engagement` (RLAN derived metrics)

This enforces the policy: "Twitch data never in reward calculation." ICELAN credentials bind to mark evidence, not to streamer metrics.

**Test:** `createRewardCredential` throws if input contains any of these fields.

## Policy Constraints (Binding)

All constraints from `docs/NON_GOALS.md` are enforced:

1. **No RLAN observations in input**
   - Input must be frozen marks only
   - Rejects if observations/observationSummary/engagement present
   - Ensures Twitch data stays observation-only

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
Frozen Mark (sportsbook evidence)
    ↓
createRewardCredential()  ← Rejects if observations present
    ↓
validateCredentialConstraints()  ← Enforces all 4 constraints
    ↓
Validated Reward Credential
    ↓
encodeCredentialData()  ← Strips internal flags, keeps evidence
    ↓
JSON ready for ICELAN chain storage
```

## API

### `createRewardCredential(frozenMark, creator)`

Creates a credential from a frozen mark.

**Requires:**
- `frozenMark.frozen === true`
- `creator`: Signer pubkey (string)
- `frozenMark` must NOT have `observations`, `observationSummary`, or `engagement`

**Returns:** Credential with `transferable: false`, `monetized: false`

**Throws:** If any RLAN fields present or input invalid

### `validateCredentialConstraints(credential)`

Validates against all 4 constraints.

**Throws:** Immediately on any violation

### `encodeCredentialData(credential)`

Encodes for on-chain storage.

**Excludes:**
- `transferable` (enforced by SPL)
- `monetized` (enforced by contract)

**Includes:**
- `creator`, `gameId`, `resolvedOutcome`
- `citedAt`, `createdAt`

### `prepareICELANBatch(slate)`

Prepares batch from slate.

**Input:** Slate with frozen marks

**Returns:** Array of validated credentials

**Skips:** Unfrozen marks (logs warning)

### `createCredentialBatchStatus(credentials)`

Tracks credentials through chain write lifecycle.

## Testing

12 tests cover:
- Observation rejection (3 tests: observations, observationSummary, engagement)
- Credential creation from frozen marks
- Constraint validation (non-transferable, monetized)
- Batch filtering (unfrozen marks skipped)
- JSON encoding
- Batch status tracking

All tests pass. Run: `npm test -- test/icelan.test.js`

## Integration Checklist

- [ ] Token-2022 NonTransferable mint design (shared with RLAN)
- [ ] On-chain credential PDAs (ICELAN layout)
- [ ] Write endpoint (`POST /icelan/attest`)
- [ ] Link credential creation to frozen mark flow
- [ ] Integrate with /muse/mcp for credential claims
- [ ] Add integration tests with live devnet RPC
- [ ] Security review: credential handling, no payout confusion
- [ ] Leak scan before public push

## Critical Constraints Reminder

**NO RLAN OBSERVATIONS IN ICELAN INPUT:**
- Input is frozen marks only
- Never accept observations/observationSummary/engagement
- Ensures Twitch data is observation layer only
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

- `docs/NON_GOALS.md` — Policy constraints (binding)
- `docs/architecture.md` — Slate mark structure
- `docs/MAINNET_ADAPTER.md` — Mainnet adapter (parallel integration)
- `docs/RLAN_ADAPTER.md` — RLAN adapter (observations only)
- `test/icelan.test.js` — Full constraint validation tests
