# Radio LAN Engagement Adapter

Radio LAN (RLAN) integration for slate-marks. Creates non-transferable engagement marks linking Twitch Helix observations to sportsbook evidence, with strict observation-only constraint on Twitch data.

## Design

### Helix Engagement Observation

Public Twitch metrics captured via Helix API. Never includes: chat text, user logins, private data.

```javascript
{
  id: "helix_...",
  provider: "twitch-helix",
  streamer: "12345", // Twitch user_id (public)

  // Observation signal (aggregate counts only)
  signal: "viewers" | "chat" | "cheer" | "raid",
  count: 250,
  observedAt: "2026-10-12T00:00:00Z",

  // Pseudonymous
  participantId: null, // Opaque hash, never user login

  // Evidence metadata
  evidence: {
    source: "twitch-helix",
    endpoint: "/users/{id}",
    cached: false
  },

  // CRITICAL: observation only
  payoutInput: false, // Never used in payout
  monetized: false
}
```

### RLAN Engagement Mark

Non-transferable record linking frozen mark to Twitch observations.

```javascript
{
  id: "rlan_engagement_mark_1",
  markId: "mark_1",
  creator: "So11111...", // Signer identity (never invoked)

  // Sportsbook context
  sportsbook: {
    gameId: "game_123",
    resolvedOutcome: "home",
    citedAt: "2026-10-12T00:00:00Z"
  },

  // Twitch observations (never payout input)
  observations: [{...}],
  observationSummary: {
    totalObservations: 2,
    signalCounts: { viewers: 1, chat: 1, cheer: 0, raid: 0 }
  },

  // Derived engagement metrics
  engagement: {
    viewerPeakCount: 250,
    chatEventsCount: 1,
    cheersCount: 0,
    raidsCount: 0
  },

  // Non-transferable + observation-only
  transferable: false,
  observationOnly: true,

  createdAt: "2026-10-12T01:00:00Z"
}
```

## Policy Constraints (Binding)

All enforced in code:

1. **Twitch data observation-only**
   - `payoutInput: false` enforced on every observation
   - `observationOnly: true` enforced on every mark
   - Never used in reward calculation

2. **Non-transferable attribution record**
   - `transferable: false` enforced on every mark
   - Cannot move or reassign engagement records

3. **Creator attestation required**
   - `creator` is signer identity (pubkey reference)
   - Signer never invoked (`failClosed: true`)
   - Mark owner attesting to the engagement

4. **No user-identifiable data**
   - Streamer: public Twitch user_id only
   - Participants: pseudonymous (opaque hash, never login)
   - Chat text: never stored
   - No PII

5. **All credentials from Doppler env**
   - Twitch token from Doppler
   - RPC URL from Doppler
   - No secrets in argv

## Data Flow

```
Frozen Mark (sportsbook evidence)
    ↓
Helix Observations (public metrics)
    ↓
createHelixEngagementObservation()  ← Non-user-data only
    ↓
createEngagementMark()
    ↓
validateEngagementMarkConstraints()  ← Enforces all 5 constraints
    ↓
Validated RLAN Engagement Mark
    ↓
encodeEngagementMarkData()  ← Strips internal flags, keeps summary + metrics
    ↓
JSON ready for RLAN chain storage
```

## API

### `createHelixEngagementObservation(input)`

Creates a Helix observation from public metrics.

**Input:**
- `streamer`: Twitch user_id (required)
- `signal`: "viewers" | "chat" | "cheer" | "raid" (required)
- `count`: Aggregate count (optional, default 1)
- `observedAt`: ISO timestamp (optional, current time)
- `participantId`: Opaque hash (optional, null)
- `endpoint`: Helix endpoint called (optional)
- `cached`: Was this from cache? (optional)

**Returns:** Observation with `payoutInput: false`, `monetized: false`

**Throws:** If streamer missing or signal invalid

### `createEngagementMark(frozenMark, creator, observations)`

Creates an engagement mark from a frozen mark and observations.

**Requires:**
- `frozenMark.frozen === true`
- `creator`: Signer pubkey (string)
- `observations`: Array of Helix observations (non-empty)

**Validates:**
- All observations from `twitch-helix` provider
- All observations have `payoutInput: false`
- All observations have `monetized: false`

**Returns:** Mark with `transferable: false`, `observationOnly: true`

**Throws:** On invalid input or constraint violation

### `validateEngagementMarkConstraints(mark)`

Validates a mark against all 5 policy constraints.

**Throws:** Immediately on any violation

### `encodeEngagementMarkData(mark)`

Encodes mark for on-chain storage.

**Excludes:**
- `transferable` (enforced by SPL)
- `observationOnly` (enforced by contract)

**Includes:**
- `creator`, `gameId`, `resolvedOutcome`
- `observationSummary` (counts, time range)
- `engagement` (peak viewers, chat count, etc.)

### `prepareRLANBatch(slate, observationsByMark)`

Prepares RLAN batch from slate + observations.

**Input:**
- `slate`: Document with frozen marks
- `observationsByMark`: Array of `{markId, observations: []}`

**Returns:** Array of validated engagement marks

**Skips:** Marks with no observations (logs warning)

### `validateTwitchCredentials(token)`

Read-only token validation. No logging.

**Returns:** `true` if valid format (string, ≥32 chars)

### `createRLANBatchStatus(marks)`

Tracks engagement marks through chain write lifecycle.

## Testing

16 tests cover:
- Helix observation creation
- Invalid signal rejection
- Mark creation from observations
- Non-transferable constraint (enforced)
- Observation-only constraint (enforced)
- No-raw-user-data constraint
- Batch filtering
- Credential validation
- Engagement metric calculation

All tests pass. Run: `npm test -- test/rlan.test.js`

## Integration Checklist

- [ ] Helix API client (get live viewer count, chat activity, cheers, raids)
- [ ] Twitch OIDC for participant pseudonymization
- [ ] RLAN engagement mark PDAs (on-chain layout)
- [ ] Add engagement endpoint (`POST /rlan/engage`)
- [ ] Link to frozen mark + creator attestation flow
- [ ] Integrate with /muse/mcp for engagement claims
- [ ] Add integration tests with live Helix API (sandbox first)
- [ ] Ensure "(AI agent)" disclosure in chat messages
- [ ] Security review: credential handling, no PII storage
- [ ] Leak scan before public push

## Critical Constraints Reminder

**TWITCH DATA OBSERVATION-ONLY:**
- Never used in payout calculations
- Never input to reward logic
- Never stored as attestation input
- Only for UI/engagement context

**NON-TRANSFERABLE:**
- Record cannot move between accounts
- Cannot be sold or traded
- Cannot be reassigned to another creator
- Binds to original mark owner only

**NO SIGNER INVOCATION:**
- Creator field is identity reference only
- No signing operations
- Fail-closed by default

## References

- `docs/NON_GOALS.md` — Policy constraints (binding)
- `docs/architecture.md` — Slate mark structure
- `src/slate.js` — Mark data model
- `docs/MAINNET_ADAPTER.md` — Mainnet adapter (parallel integration)
- `test/rlan.test.js` — Full constraint validation tests
