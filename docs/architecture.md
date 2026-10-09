# Slate marks architecture

A mark is a copied Polymarket outcome on a lineup. It is not a bet, an order, or a payout. The signer stays uninvoked.

## Store

`data/slate.sqlite` holds one row. `src/store.js` saves the slate document as JSON in `slate.body`. The document has seasons, fixtures, cites, lineups, claims, and marks.

## Gamma

`npm start` with an empty database calls Gamma:

`GET https://gamma-api.polymarket.com/events?closed=true&limit=10&tag_slug=nba`

`payloadFromGammaEvent` keeps the first closed moneyline whose `umaResolutionStatus` is `resolved` and whose outcome price is `1`. Home and away are the two outcome names. The winning name is `resolvedOutcome`. That payload is frozen onto one mark and written to SQLite. A later start reads the row and does not call Gamma again.

`POST /refetch` pulls again, replaces the stored slate with one new frozen mark, and saves it. It does not append a second mark, and it does not submit an order.

## HTTP

The process listens on `HOST` or `127.0.0.1`, port `PORT` or `4178`.

| Method | Path | Effect |
|---|---|---|
| GET | `/` | Fixture, cited outcome, and frozen result |
| GET | `/record` | The stored slate |
| POST | `/refetch` | Fresh Gamma pull, then one replacement freeze |

The page button `Re-fetch` posts to `/refetch` and reloads.
