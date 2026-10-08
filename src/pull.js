import { createReadAdapter } from "./polymarket.js";
import { freezeResolvedCondition, openMark, recordCite, recordFixture, recordLineup, recordSeason } from "./slate.js";

/** One already-resolved Gamma body. Tests and the local page use this instead of the network. */
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
