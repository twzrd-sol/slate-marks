# Goals (updated 2026-10-12)

Slate marks integrate Polymarket sportsbook attribution into three systems:
1. **Solana mainnet** — non-transferable attribution records linking sportsbook evidence to creators.
2. **Radio LAN** — engagement marks for Twitch streamer-culture channel (viewer counts, chat, cheers, raids only).
3. **ICELAN** — unpriced reward credential records bound to Radio LAN attestations.

## Constraints (all binding)

- **No signer invocation.** Marks remain uninvoked. `signerInvocations` stays 0; `failClosed` stays true.
- **No wagering language.** No price, odds, bet, stake, payout, yield, buy, sell, trade, pump, moon, airdrop, ticker, kalshi, or polymarket in any user-facing output.
- **Twitch data never in reward calculation.** Helix metrics (viewer counts, chat volume) are observation layer only. Payout inputs are creator attestations and our own observation layer, never Twitch data.
- **Non-transferable attribution record.** The token may be transferable; the mark recording who contributed what is not.
- **No key material in argv.** All credentials come from Doppler env or local Doppler calls. Secrets never appear in command invocations or logs.
- **Leak scan before public push.** All pushes to the public repo must pass a local leak scan first.

## Out of scope (unchanged)

- No CLOB order, no SecureClient, no private key, no redeem.
- No pack, no buyback, no physical shipment.
- No new token. (This repo integrates RLAN and ICELAN tokens; does not mint them.)
- No vault-titles issuance.
- No funded vault. No signature request.
- Polymarket CLOB collateral is pUSD. It is not this repo's USDC rail.
- A viewer claim is presence, not proof of watching.
- Fantasy slots are not a salary-cap engine.
- Resolution is copied from Polymarket. This repo does not adjudicate.
