# Polymarket surface

Official client for new work: `@polymarket/client`.

```js
import { createPublicClient } from "@polymarket/client";
const client = createPublicClient();
```

Do not import `@polymarket/clob-client-v2` for new code. Do not construct SecureClient. Do not POST an order. Do not redeem.

Catalogue host: `https://gamma-api.polymarket.com`

- GET /sports
- GET /teams?league=nba (also nfl, mlb, nhl)
- GET /sports/market-types → moneyline, spreads, totals
- GET /events/keyset?game_id=
- GET /markets/keyset?sports_market_types=spreads

Realtime, documented only, not required for v0 tests:

- client.subscribe([{ topic: "sports" }])
- scores socket wss://sports-api.polymarket.com/ws (no auth)

Docs:

- https://docs.polymarket.com/getting-started/typescript
- https://docs.polymarket.com/market-data/discover-markets
- https://www.npmjs.com/package/@polymarket/client

Public reads need no key. v0 tests inject a Gamma payload and do not require a signer.
