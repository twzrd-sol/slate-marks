# Slate-Marks v0.1.0 Deployment Checklist

Use this checklist for devnet deployment and eventual mainnet release.

## Pre-Deployment (Operator)

- [ ] Operator reviews OPERATOR_BRIEFING.md
- [ ] Operator reviews RELEASE_NOTES.md
- [ ] Operator confirms approval for devnet phase
- [ ] Devnet RPC endpoint confirmed reachable
- [ ] Solana CLI installed and configured for devnet
- [ ] Devnet wallet funded with SOL

## Devnet Deployment Phase 1: Code Verification

- [ ] Clone repo: `git clone https://github.com/twzrd-sol/slate-marks.git`
- [ ] Check out tag: `git checkout v0.1.0`
- [ ] Install dependencies: `npm install`
- [ ] Run full test suite: `npm test` (all tests pass)
- [ ] Start server: `npm start` (listens on 127.0.0.1:4178)
- [ ] Health check: `curl http://127.0.0.1:4178/health` (returns `{"status":"ok"}`)

## Devnet Deployment Phase 2: Program Setup (ansem-radio scope)

- [ ] Deploy mainnet attestation program to devnet
- [ ] Deploy RLAN engagement program to devnet
- [ ] Deploy ICELAN credential program to devnet (5wAVbHfZ or custom)
- [ ] Verify program IDs match configuration
- [ ] Create Token-2022 NonTransferable mint (or verify exists)
- [ ] Verify mint authority and freeze authority

## Devnet Deployment Phase 3: Endpoint Testing

- [ ] Test `/prepare/mainnet` endpoint with sample frozen mark
  - Request: Valid frozenMark + fixture + cite
  - Expected: Unsigned instruction with PDA seed
  - Verify: Can derive PDA from seed
  
- [ ] Test `/prepare/rlan` endpoint with live Twitch data
  - Prerequisites: TWITCH_CLIENT_ID, TWITCH_ACCESS_TOKEN env vars
  - Request: frozenMark + valid streamer username + creator
  - Expected: Unsigned instruction + observation_timestamp
  - Verify: Can derive RLAN PDA from seed
  
- [ ] Test `/prepare/icelan` endpoint with RLAN reference
  - Request: rlanMark + creator
  - Expected: Unsigned instruction with credential PDA seed
  - Verify: PDA derivation matches RLAN mark ID

## Devnet Deployment Phase 4: Instruction Submission

- [ ] Retrieve latest blockhash from devnet
- [ ] Sign prepared mainnet attestation instruction
- [ ] Submit to devnet, verify transaction confirmation
- [ ] Check PDA account on devnet (should exist, contain attestation data)
- [ ] Sign prepared RLAN engagement instruction
- [ ] Submit to devnet, verify transaction confirmation
- [ ] Check RLAN PDA on devnet
- [ ] Sign prepared ICELAN credential instruction
- [ ] Submit to devnet, verify transaction confirmation
- [ ] Check ICELAN PDA on devnet

## Devnet Deployment Phase 5: Data Verification

- [ ] Mainnet attestation PDA:
  - [ ] Contains correct creator
  - [ ] Contains correct gameId
  - [ ] Contains correct resolved_outcome
  - [ ] Has correct discriminator
  
- [ ] RLAN engagement PDA:
  - [ ] Contains observation counts
  - [ ] References mainnet attestation PDA
  - [ ] Has correct discriminator
  
- [ ] ICELAN credential PDA:
  - [ ] Contains credential data
  - [ ] References RLAN engagement PDA
  - [ ] References mainnet attestation PDA
  - [ ] Has correct discriminator

## Devnet Deployment Phase 6: Integration Testing

- [ ] Enable devnet tests in test/devnet-integration.test.js (remove .skip)
- [ ] Run devnet integration suite: `npm test -- test/devnet-integration.test.js`
- [ ] All tests pass with live devnet RPC
- [ ] PDA derivation matches on-chain results

## Post-Deployment Verification

- [ ] All three adapters functioning correctly on devnet
- [ ] Instruction preparation is deterministic (same inputs = same instructions)
- [ ] PDA derivation is reproducible
- [ ] Error handling works (invalid inputs return 400)
- [ ] Server stability verified (no crashes under normal load)

## Sign-Off

- [ ] Operator confirms devnet testing successful
- [ ] Operator confirms ready for next phase
- [ ] No blockers identified
- [ ] All issues documented (if any)

## Mainnet Readiness (Future)

- [ ] Security audit of on-chain programs completed
- [ ] Mainnet program deployment plan drafted
- [ ] Mint configuration for mainnet verified
- [ ] Operator approval for mainnet phase

## Rollback Plan (if needed)

1. Stop server: `npm stop` or Ctrl+C
2. Revert commits: `git reset --hard <previous-commit>`
3. Delete transactions from devnet (no data persistence needed)
4. No production impact (code not live on mainnet)
5. No recovery procedures needed (devnet is ephemeral)

## Sign-Off

**Deployment verified by:** _______________  
**Date:** _______________  
**Notes:** _______________
