# slate-marks

Record a seasonal US team-sport lineup against a Polymarket outcome, and keep that record as one attribution mark.

The mark is credibility for sportsmanship. It is not a bet, not a pack, not a title to a physical card, and not a payout. This repository is not Radio LAN, not ansem-radio, not vault-titles, not battleship-kit, and not twzrd-trust.

## Enter the slate

A season names one league: NFL, NBA, MLB, or NHL. College is a later lane. A fixture is one game, copied from Gamma (`gammaEventId`, `gameId`, home, away, start). A lineup is slots on fixtures (`fixtureId` and `side`). It is not a salary cap, and it does not price players.

A viewership claim is optional presence. It is not proof that anyone watched.

## Cite, then mark

An outcome cite copies a Polymarket market: condition id, market type (`moneyline`, `spreads`, or `totals`), outcome token id, and an implied price from 0 to 1. The source string is `polymarket-gamma`. That price is a USDC notional quote. It is not a transfer. Polymarket CLOB collateral is pUSD. Do not treat pUSD as this repo's USDC rail, and do not submit the quote.

`openMark` stores one mark for a lineup and a fixture. A second mark for that same pair throws. `resolveMark` copies `resolvedOutcome` from a supplied Polymarket payload. It does not adjudicate the game and it does not create another asset.

`freezeResolvedCondition` accepts that copy only when the payload is already `resolved: true` and its `conditionId` matches the cite. It then freezes the mark. A second freeze throws. An unresolved condition, or a different condition id, is refused and the mark stays open.

## Rails

SOL is a pubkey stored on the lineup and the mark. There is no mint and no transfer.

USDC is the quoted notional on the cite. There is no transfer.

The x402 challenge is Base, asset USDC, `amount` `"0"`, `payTo` null, `status` `uninvoked`, `failClosed` true, `signerInvocations` 0. `considerSigner` keeps that challenge when the pre-spend check is missing, throws, or returns a block. This cut does not invoke a signer.

## Polymarket reads

New code imports `@polymarket/client` and calls `createPublicClient()`. The pinned version in this repo is `0.12.0`. Do not import `@polymarket/clob-client-v2`. Do not construct `SecureClient`. Do not POST an order. Do not redeem.

Catalogue host: `https://gamma-api.polymarket.com`

- `GET /sports`
- `GET /teams?league=` with `nfl`, `nba`, `mlb`, or `nhl`
- `GET /sports/market-types`
- `GET /events/keyset?game_id=`
- `GET /markets/keyset?sports_market_types=spreads`

Series slugs confirmed for this cut are `nfl`, `nba`, and `mlb`. An `nhl` series slug was not in that confirmed list. Use `GET /teams?league=nhl` for NHL clubs until that slug is verified.

Gamma is a public read. Restrictions on who may trade Polymarket do not turn this read into an order. The sports socket `wss://sports-api.polymarket.com/ws` is documented in `docs/POLYMARKET.md` and is not required for these tests.

## Run

```bash
npm install
npm test
```

Tests inject a Gamma payload. They do not need the network or a signer.

## Local board

`npm start` on an empty `data/slate.sqlite` pulls one already-resolved NBA moneyline from Gamma, freezes that mark, and stores it. It listens on `127.0.0.1:4178`. `HOST=100.111.36.55 npm start` binds that same port on the tailnet. The page shows the fixture, the cited outcome, and the frozen result. A second start reads the stored mark and does not pull again. Re-fetch replaces that mark with a new pull. Schema and routes: `docs/architecture.md`.

## Still later

A second freeze of the same mark still throws. Re-fetch replaces the stored slate instead of freezing the open mark twice. Still do not place a CLOB order, mint a token, or fund a vault.

Live Gamma response shapes for market types and `game_id` lookup are not frozen in this cut. Re-read them before depending on a field this fixture does not show.
