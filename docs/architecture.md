# Slate marks architecture

A mark is a copied Polymarket outcome on a lineup. It is not a bet, an order, or a payout. The signer stays uninvoked.

## Store

`data/slate.sqlite` holds one row. `src/store.js` saves the slate document as JSON in `slate.body`. The document has seasons, fixtures, cites, lineups, claims, and marks.

## Gamma

`npm start` with an empty database calls Gamma:

`GET https://gamma-api.polymarket.com/events?closed=true&limit=10&tag_slug=nba`

`payloadFromGammaEvent` keeps the first closed moneyline whose `umaResolutionStatus` is `resolved` and whose outcome price is `1`. Home and away are the two outcome names. The winning name is `resolvedOutcome`. That payload is frozen onto one mark and written to SQLite. A later start reads the row and does not call Gamma again.

`POST /refetch` pulls again and appends one frozen mark while retaining prior history. A `conditionId` already present in the stored cites is skipped, so refetching the same condition does not duplicate a mark. The slate is saved only after the new mark has been constructed successfully. A failed read or freeze returns an error and leaves the saved board unchanged; the page displays the error and keeps the existing history visible. Gamma reads use a 10-second timeout and a 1 MiB response limit. Refresh requests arriving together share one read.

## HTTP

The process listens on `HOST` or `127.0.0.1`, port `PORT` or `4178`.

| Method | Path | Effect |
|---|---|---|
| GET | `/` | Fixture, cited outcome, and frozen result |
| GET | `/record` | The stored slate and current `refreshError` (empty after a successful refresh) |
| POST | `/refetch` | Fresh Gamma pull, then append or deduplicate; a failed pull returns HTTP 502 with an `error` field |

The page button `Re-fetch` posts to `/refetch`, reloads after success, and displays the returned error in place when the request fails.
