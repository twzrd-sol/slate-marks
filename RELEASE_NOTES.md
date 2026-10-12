# Slate-Marks v0.1.0 Release Notes

**Release Date:** 2026-10-12  
**Status:** Ready for devnet deployment  
**Security:** ✅ Clean (vulnerability review passed)

## Overview

Solana mainnet attestation adapters for slate-marks. Three non-transferable credential adapters + write server endpoints for preparing unsigned instructions.

## New Features

### Mainnet Attestation Adapter
- Binds Polymarket evidence to creator attestations
- Non-transferable records on Solana mainnet
- PDA seed uniqueness prevents duplicate marks
- 11 constraint tests, all passing

### RLAN Engagement Adapter
- Twitch Helix public metrics integration
- Observation-only (viewers, chat, cheers, raids counts)
- Live stream data fetch via OAuth bearer token
- Non-transferable engagement marks
- 16 constraint tests, all passing

### ICELAN Credential Adapter
- Reward credentials bound to RLAN engagement marks
- RLAN reference-only input (Twitch data never embedded)
- Non-transferable unpriced credentials
- 11 constraint tests, all passing

### Helix API Client
- OAuth-authenticated Twitch stream data fetch
- Public metrics aggregation (viewers, followers, chat settings)
- Graceful handling of offline streams and API errors
- 19 unit tests, all passing

### Write Server (Express)
- `POST /prepare/mainnet` — attestation instruction preparation
- `POST /prepare/rlan` — engagement instruction preparation (live Helix fetch)
- `POST /prepare/icelan` — credential instruction preparation
- `GET /health` — server readiness check
- Localhost binding (127.0.0.1) for security

## Test Coverage

- **46+ unit tests** across all adapters (all passing)
- **3 integration tests** (all passing)
- **6 devnet-ready tests** (ready to run with SOLANA_RPC_URL)
- **Security review:** Zero vulnerabilities identified
- **Leak scan:** Clean (no secrets, paths, or session URLs exposed)

## Documentation

- **API.md** — Complete endpoint specification with curl examples
- **DEVNET_TESTING.md** — Integration testing guide
- **TOKEN_2022_DESIGN.md** — NonTransferable mint configuration
- **ONCHAIN_DESIGN.md** — PDA layouts and Borsh encoding
- **OPERATOR_BRIEFING.md** — Architecture review and next steps

## Doctrine Enforced

✅ No token mints (program-owned PDAs)  
✅ No signer invocation (fail-closed)  
✅ No raw Twitch data on-chain (counts + hash only)  
✅ PDA uniqueness by seed construction  
✅ All secrets from Doppler env  

## Breaking Changes

None. This is v0.1.0 (initial release).

## Migration Guide

N/A (initial release).

## Known Limitations

1. **On-chain programs:** Program implementations (PDA account creation, instruction handlers) are ansem-radio responsibility
2. **Token-2022 mint:** NonTransferable mint creation and configuration pending
3. **Signer:** External co-signer or operator required for instruction signing
4. **Live Twitch:** RLAN endpoint requires Twitch OAuth credentials (TWITCH_CLIENT_ID, TWITCH_ACCESS_TOKEN)

## Rollback Procedure

If issues discovered during devnet testing:

1. Revert commits on origin/main (operator action)
2. Tag rollback commit as `v0.1.0-rollback`
3. No prod systems affected (code not yet deployed to mainnet)
4. Zero data migration risk (no on-chain changes yet)

## Next Steps

1. **Devnet deployment** — Create programs, mint tokens, test instruction flow
2. **Live testing** — Submit prepared instructions, verify PDAs
3. **Integration with /muse/mcp** — Wire claim handling
4. **Mainnet readiness** — Program audit, security review, go/no-go decision

## Commits

- ae67dcd — Attestation adapters + Helix client (1,201 LOC)
- 149395b — Integration tests (96 LOC)
- d498146 — Devnet integration framework (198 LOC)
- 97e440f — API, Token-2022, devnet docs (372 LOC)
- 5a6685e — Operator briefing

## Contributors

Claude Haiku 4.5 (implementation, testing, documentation)

## Questions?

See OPERATOR_BRIEFING.md for deployment decision framework.
