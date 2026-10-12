# Slate-Marks API

Write endpoints for preparing unsigned Solana instructions for attestation adapters.

## Overview

All endpoints return unsigned instructions ready for external signing. Input is JSON-encoded, output is a prepared instruction structure with PDA seed information.

## Endpoints

### POST /prepare/mainnet

Prepare a mainnet attestation record instruction.

**Input:**
```json
{
  "frozenMark": {
    "id": "mark_1",
    "frozen": true,
    "solanaPubkey": "So11111111111111111111111111111111111111112",
    "resolvedOutcome": "home"
  },
  "fixture": {
    "gameId": "game_123",
    "league": "NFL"
  },
  "cite": {
    "source": "polymarket-gamma",
    "conditionId": "0x456def",
    "outcomeTokenId": "0xoutcome",
    "citedAt": "2026-10-12T00:00:00Z"
  },
  "creator": "So11111111111111111111111111111111111111112"
}
```

**Output:**
```json
{
  "instruction": {
    "program": "mainnet-attestation",
    "keys": [
      { "pubkey": "...", "isSigner": false, "isWritable": true },
      { "pubkey": "11111111111111111111111111111111", "isSigner": false, "isWritable": false }
    ],
    "data": "..."
  },
  "blockhash_required": true,
  "pda_seed": ["attestation", "creator_pubkey", "condition_id"]
}
```

### POST /prepare/rlan

Prepare an RLAN engagement mark instruction.

**Input:**
```json
{
  "frozenMark": { ... },
  "streamerUsername": "twitch_username",
  "creator": "So11111111111111111111111111111111111111112"
}
```

**Note:** Requires Helix credentials (TWITCH_CLIENT_ID, TWITCH_ACCESS_TOKEN env vars). Fetches live stream data.

**Output:**
```json
{
  "instruction": { ... },
  "blockhash_required": true,
  "pda_seed": ["engagement", "creator_pubkey", "mainnet_pda"],
  "observation_timestamp": "2026-10-12T10:15:00Z"
}
```

### POST /prepare/icelan

Prepare an ICELAN reward credential instruction.

**Input:**
```json
{
  "rlanMark": {
    "id": "rlan_engagement_mark_1",
    "markId": "mark_1",
    "gameId": "game_123",
    "resolvedOutcome": "home"
  },
  "creator": "So11111111111111111111111111111111111111112"
}
```

**Output:**
```json
{
  "instruction": { ... },
  "blockhash_required": true,
  "pda_seed": ["credential", "creator_pubkey", "engagement_pda"]
}
```

### GET /health

Server readiness check.

**Output:**
```json
{
  "status": "ok",
  "helix_configured": true
}
```

## Error Responses

All endpoints return `400` for missing or invalid input:
```json
{
  "error": "descriptive error message"
}
```

Returns `503` if required external service is unavailable:
```json
{
  "error": "Helix client not configured (missing helixClientId/helixAccessToken)"
}
```

## Security Notes

- All endpoints are unsigned instruction preparation only
- No signer invocation (fail-closed by design)
- Helix client requires OAuth credentials from Doppler env
- Server binds to `127.0.0.1` by default (localhost only)
