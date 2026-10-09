import { createReadAdapter } from "./polymarket.js";
import { freezeResolvedCondition, openMark, recordCite, recordFixture, recordLineup, recordSeason } from "./slate.js";

const GAMMA_EVENTS = "https://gamma-api.polymarket.com/events?closed=true&limit=10&tag_slug=nba";

function listField(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || value.length === 0) throw new Error("gamma list is required");
  return JSON.parse(value);
}

/** Map one Gamma event into the payload freezeCopiedCondition already accepts. */
export function payloadFromGammaEvent(event) {
  const market = (event?.markets ?? []).find((row) => row.sportsMarketType === "moneyline" && row.umaResolutionStatus === "resolved" && row.closed === true);
  if (!market) throw new Error("resolved moneyline missing");
  const outcomes = listField(market.outcomes);
  const prices = listField(market.outcomePrices).map(Number);
  const tokens = listField(market.clobTokenIds);
  const winner = prices.findIndex((price) => price === 1);
  if (winner < 0 || !outcomes[0] || !outcomes[1] || !market.conditionId) throw new Error("condition is not already resolved");
  return {
    league: "NBA",
    label: event.slug ?? event.title ?? "nba",
    startsAt: event.startDate ?? null,
    endsAt: event.endDate ?? null,
    event: {
      id: String(event.id),
      game_id: event.gameId ?? null,
      home: outcomes[0],
      away: outcomes[1],
      start_time: event.startDate ?? null,
    },
    condition: {
      conditionId: market.conditionId,
      resolved: true,
      resolvedOutcome: outcomes[winner],
      sportsMarketType: "moneyline",
      outcomeTokenId: String(tokens[winner]),
      impliedPrice: prices[winner],
    },
  };
}

/** Read one already-resolved NBA moneyline from Gamma. */
export async function pullLiveResolved(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(GAMMA_EVENTS, { headers: { accept: "application/json" } });
  if (!response?.ok) throw new Error("gamma read failed");
  const events = await response.json();
  if (!Array.isArray(events)) throw new Error("gamma events missing");
  for (const event of events) {
    try {
      return payloadFromGammaEvent(event);
    } catch {
      continue;
    }
  }
  throw new Error("no resolved Gamma moneyline");
}

/** One already-resolved Gamma body. Tests inject this instead of the network. */
export function mockResolvedGamma() {
  return {
    league: "NBA",
    label: "2026-27",
    startsAt: "2026-10-01",
    endsAt: "2027-06-01",
    event: {
      id: "evt_live",
      game_id: "game_live",
      home: "BOS",
      away: "NYK",
      start_time: "2026-10-22T23:00:00Z",
    },
    condition: {
      conditionId: "0xresolved",
      resolved: true,
      resolvedOutcome: "home",
      sportsMarketType: "moneyline",
      outcomeTokenId: "token_yes",
      impliedPrice: 0.62,
    },
  };
}

/** Read one resolved payload. The default reader is the mock, not Gamma. */
export async function pullResolved(fetchImpl = async () => mockResolvedGamma()) {
  return fetchImpl();
}

/** Copy a resolved payload onto one lineup mark and freeze it. */
export function freezeCopiedCondition(slate, payload, input) {
  const fixtureFields = createReadAdapter().fixtureFromGamma(payload);
  const season = recordSeason(slate, {
    league: payload.league,
    label: payload.label,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
  });
  const fixture = recordFixture(slate, {
    seasonId: season.id,
    gammaEventId: fixtureFields.gammaEventId,
    gameId: fixtureFields.gameId,
    home: fixtureFields.home,
    away: fixtureFields.away,
    startsAt: fixtureFields.startsAt,
  });
  const condition = payload.condition;
  const cite = recordCite(slate, {
    fixtureId: fixture.id,
    conditionId: condition.conditionId,
    sportsMarketType: condition.sportsMarketType,
    outcomeTokenId: condition.outcomeTokenId,
    impliedPrice: condition.impliedPrice,
    citedAt: input.citedAt,
  });
  const lineup = recordLineup(slate, {
    seasonId: season.id,
    solanaPubkey: input.solanaPubkey,
    slots: [{ fixtureId: fixture.id, side: input.citedOutcome }],
  });
  const mark = openMark(slate, {
    lineupId: lineup.id,
    fixtureId: fixture.id,
    outcomeCiteId: cite.id,
    solanaPubkey: input.solanaPubkey,
    citedOutcome: input.citedOutcome,
    createdAt: input.createdAt,
  });
  return freezeResolvedCondition(slate, mark.id, {
    conditionId: condition.conditionId,
    resolved: condition.resolved,
    resolvedOutcome: condition.resolvedOutcome,
  });
}
