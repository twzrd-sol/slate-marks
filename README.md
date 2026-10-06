# slate-marks

A seasonal US team-sports slate that records a fantasy lineup and a viewership claim against a Polymarket outcome, and keeps that as an attribution mark.

The mark is credibility for sportsmanship. It is not a bet, not a pack, not a title to a physical card, and not a payout.

This repository is not Radio LAN, not ansem-radio, not vault-titles, not battleship-kit, and not twzrd-trust.

## What v0 is

A local append-only record: season, fixture, fantasy lineup (slots, not a salary cap), outcome cite copied from Polymarket, one attribution mark per lineup and fixture, a Solana pubkey, a USDC notional quote, and an x402 challenge on Base with amount `0`, `payTo` null, status `uninvoked`, `failClosed` true.

Public Polymarket reads go through `@polymarket/client` `createPublicClient()`. Tests inject a Gamma payload and do not need the network or a signer.

## What v0 is not

No CLOB order. No SecureClient. No private key. No redeem. No pack. No new token. No funded vault. No signature request. See `docs/NON_GOALS.md`.

## Run

```bash
npm install
npm test
```

## Resume after launch

1. Freeze one already-resolved Polymarket condition onto an attribution mark. Copy the resolution. Do not adjudicate it.
2. Keep the x402 challenge uninvoked until a pre-spend check can fail closed (same rule as twzrd-trust #131).
3. Still do not place a CLOB order, mint a token, or fund a vault.
