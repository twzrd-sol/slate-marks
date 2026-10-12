# Mainnet Attribution Adapter

Solana mainnet integration for slate-marks. Binds frozen Polymarket evidence to non-transferable creator attestation records on mainnet.

## Design

### Attestation Record

Each frozen mark becomes a mainnet attestation record:

```javascript
{
  id: "attestation_mark_1",
  markId: "mark_1",
  creator: "So11111111111111111111111111111111111111112", // Signer identity (not invoked)
  
  // Polymarket evidence (strongest)
  evidence: {
    source: "polymarket-gamma",
    conditionId: "0x123abc...",
    outcomeTokenId: "0x456def...",
    resolvedOutcome: "home",
    citedAt: "2026-10-12T00:00:00Z",
    strength: "signed"
  },
  
  // Fixture context
  gameId: "game_123",
  league: "nfl",
  
  // Non-transferable: cannot move or reassign
  transferable: false,
  
  // Never monetized: credibility only
  monetized: false,
  
  createdAt: "2026-10-12T01:00:00Z"
}
```

### Policy Constraints (Binding)

All constraints from `docs/NON_GOALS.md` are enforced in code:

1. **No signer invocation**
   - `signerInvocations` stays 0
   - `failClosed` stays true
   - Creator field is a pubkey reference only, never used for signing

2. **Non-transferable attribution record**
   - `transferable: false` enforced on every attestation
   - SPL record uses Token-2022 `NonTransferable` extension
   - Cannot be moved, sold, or reassigned

3. **Never monetized**
   - `monetized: false` enforced
   - Mark is credibility for sportsmanship
   - No payout flows, no yield, no value transfer

4. **Polymarket evidence required**
   - Must have `source: "polymarket-gamma"`
   - Must have resolved outcome from Polymarket
   - Evidence chain cannot be broken

5. **All credentials from Doppler env**
   - No secrets in argv
   - RPC URL, signer keys (if any) come from Doppler only
   - Connection validation is read-only

## Data Flow

```
Frozen Mark (in slate.sqlite)
    ↓
createAttestationRecord()
    ↓
validateAttestationConstraints()  ← Enforces all 5 policy requirements
    ↓
Validated Attestation Record
    ↓
encodeAttestationData()  ← Strips internal flags, keeps evidence + creator
    ↓
JSON ready for non-transferable SPL mint
    ↓
Mainnet write (token-2022 NonTransferable record)
```

## API

### `createAttestationRecord(frozenMark, fixture, cite)`

Creates an attestation from a frozen mark. Requires:
- `frozenMark.frozen === true`
- `frozenMark.resolvedOutcome` (not null)
- `fixture` and `cite` records to exist

Throws on invalid input.

### `prepareMainnetBatch(slate)`

Prepares all frozen marks in a slate for mainnet:
1. Filters to frozen marks only
2. Validates cite + fixture exist
3. Creates attestation for each
4. Validates all constraints
5. Returns array of ready-to-write attestations

Skips marks with missing cite/fixture (logs warning).

### `validateAttestationConstraints(attestation)`

Validates a single attestation against all 5 policy constraints. Throws immediately on violation.

### `encodeAttestationData(attestation)`

Converts attestation to compact JSON for on-chain storage. Excludes:
- `transferable` flag (enforced by SPL extension)
- `monetized` flag (enforced by contract)

Includes:
- `markId`, `creator`, `gameId`
- `resolvedOutcome`, `conditionId`, `citedAt`
- `createdAt`

### `createBatchStatus(attestations)`

Tracks batch through mainnet write lifecycle:
- `batchId`: Unique batch identifier
- `attestations`: Array of pending records with tx signature placeholders
- `createdAt`, `completedAt`: Timing markers

### `validateMainnetConnection(connection)`

Read-only RPC health check. Does NOT invoke signer. Fail-closed: returns false if RPC unavailable.

## Testing

11 tests cover:
- Frozen mark → attestation creation
- Non-transferable constraint (enforced)
- Never-monetized constraint (enforced)
- Polymarket evidence requirement (enforced)
- Creator identity requirement (enforced)
- Batch filtering (unfrozen marks excluded)
- Missing cite/fixture handling (skipped)
- Batch status tracking
- JSON encoding (no signer material)

All tests pass. Run: `npm test -- test/mainnet.test.js`

## Integration Checklist

- [ ] Connect mainnet RPC (Doppler env `MAINNET_RPC_URL`)
- [ ] Design non-transferable SPL mint (Token-2022 NonTransferable)
- [ ] Implement on-chain attestation PDAs
- [ ] Add mainnet write endpoint (`POST /mainnet/attest`)
- [ ] Integrate with /muse/mcp for attestation claims
- [ ] Add integration tests with live mainnet RPC (devnet first)
- [ ] Security review: signer handling, secret management
- [ ] Leak scan before public push

## References

- `docs/NON_GOALS.md` — Policy constraints (binding)
- `docs/architecture.md` — Slate mark structure
- `src/slate.js` — Mark data model
- `test/mainnet.test.js` — Full constraint validation tests
