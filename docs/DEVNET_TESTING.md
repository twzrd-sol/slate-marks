# Devnet Integration Testing Guide

Instructions for testing slate-marks attestation adapters on Solana devnet.

## Prerequisites

1. **Solana CLI:** `solana --version`
2. **Node.js 20+:** `node --version`
3. **Devnet funded wallet:** `solana config get` → ensure `rpc_url` is devnet
4. **Twitch OAuth credentials** (optional, for RLAN live testing):
   - TWITCH_CLIENT_ID (from Twitch Developer Console)
   - TWITCH_ACCESS_TOKEN (from OAuth flow)

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
export SOLANA_RPC_URL=https://api.devnet.solana.com
export SOLANA_COMMITMENT=confirmed

# Optional: for RLAN live Twitch data
export TWITCH_CLIENT_ID=your_client_id
export TWITCH_ACCESS_TOKEN=your_access_token

# Server configuration
export HOST=127.0.0.1
export PORT=4178
```

### 3. Fund devnet wallet
```bash
solana airdrop 2 $(solana config get | grep Keypair | awk '{print $2}') --url devnet
```

## Running Tests

### Unit tests (local, no RPC needed)
```bash
npm test
```

### Devnet integration tests (skipped by default)
```bash
# Edit test/devnet-integration.test.js:
# - Remove `.skip` from test declarations
# - Run:
npm test -- test/devnet-integration.test.js
```

### Manual endpoint testing

**Start server:**
```bash
npm start
# Output: slate-marks http://127.0.0.1:4178
```

**Test mainnet attestation endpoint:**
```bash
curl -X POST http://127.0.0.1:4178/prepare/mainnet \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

**Test RLAN engagement endpoint:**
```bash
curl -X POST http://127.0.0.1:4178/prepare/rlan \
  -H "Content-Type: application/json" \
  -d '{
    "frozenMark": {
      "id": "mark_1",
      "frozen": true,
      "solanaPubkey": "So11111111111111111111111111111111111111112",
      "resolvedOutcome": "home"
    },
    "streamerUsername": "twitch_username",
    "creator": "So11111111111111111111111111111111111111112"
  }'
```

**Test ICELAN credential endpoint:**
```bash
curl -X POST http://127.0.0.1:4178/prepare/icelan \
  -H "Content-Type: application/json" \
  -d '{
    "rlanMark": {
      "id": "rlan_engagement_mark_1",
      "markId": "mark_1",
      "gameId": "game_123",
      "resolvedOutcome": "home",
      "citedAt": "2026-10-12T00:00:00Z"
    },
    "creator": "So11111111111111111111111111111111111111112"
  }'
```

**Health check:**
```bash
curl http://127.0.0.1:4178/health
```

## Submitting Instructions to Devnet

Once unsigned instructions are prepared, sign and submit:

```bash
# 1. Get blockhash
BLOCKHASH=$(solana blockhash --url devnet | awk '{print $1}')

# 2. Construct transaction from instruction
# (Use @solana/web3.js or solana-cli tools)

# 3. Sign with your keypair
solana transfer ... --fee-payer <your_key> --url devnet

# 4. Verify on-chain
solana account <pda_address> --url devnet
```

## Verification Checklist

- [ ] Unit tests pass: `npm test`
- [ ] Server starts without errors: `npm start`
- [ ] `/health` endpoint returns `status: ok`
- [ ] `/prepare/mainnet` returns valid instruction with PDA seed
- [ ] `/prepare/rlan` fetches live Twitch data (if credentials provided)
- [ ] `/prepare/icelan` validates RLAN reference and returns instruction
- [ ] Instructions can be signed and submitted (operator scope)
- [ ] PDAs derive correctly from seeds
- [ ] On-chain records are created with correct data

## Troubleshooting

**Helix API errors (404, 401):**
- Verify TWITCH_CLIENT_ID and TWITCH_ACCESS_TOKEN are valid
- Check streamer username exists
- Confirm token has Helix API scope

**RPC connection errors:**
- Verify SOLANA_RPC_URL points to devnet
- Check network connectivity: `curl https://api.devnet.solana.com/`

**Instruction preparation fails:**
- Check input JSON structure against API documentation
- Verify frozen mark has `frozen: true`
- Ensure creator is valid Solana pubkey format

## Next Steps

1. Submit prepared instructions to devnet (operator)
2. Verify on-chain record creation
3. Integrate with /muse/mcp for claim handling
4. Deploy to mainnet after testing

## References

- API specification: `docs/API.md`
- On-chain design: `docs/ONCHAIN_DESIGN.md`
- Token-2022 design: `docs/TOKEN_2022_DESIGN.md`
