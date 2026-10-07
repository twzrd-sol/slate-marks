import { considerSigner, slatePassChallenge, solanaPubkeyField, usdcNotional } from "./rails.js";
export function createSlate() { return { seasons: [], fixtures: [], cites: [], lineups: [], claims: [], marks: [] }; }
function nextId(prefix, rows) { return `${prefix}_${rows.length + 1}`; }
export function recordSeason(slate, input) {
  const season = { id: nextId("season", slate.seasons), league: input.league, label: input.label, startsAt: input.startsAt, endsAt: input.endsAt, status: "open" };
  slate.seasons.push(season); return season;
}
export function recordFixture(slate, input) {
  const fixture = { id: nextId("fixture", slate.fixtures), seasonId: input.seasonId, gammaEventId: input.gammaEventId, gameId: input.gameId, home: input.home, away: input.away, startsAt: input.startsAt };
  slate.fixtures.push(fixture); return fixture;
}
export function recordCite(slate, input) {
  const notional = usdcNotional(input.impliedPrice);
  const cite = { id: nextId("cite", slate.cites), fixtureId: input.fixtureId, conditionId: input.conditionId, sportsMarketType: input.sportsMarketType, outcomeTokenId: input.outcomeTokenId, impliedPrice: notional.notional, citedAt: input.citedAt, source: "polymarket-gamma", transfer: null };
  slate.cites.push(cite); return cite;
}
export function recordLineup(slate, input) {
  const identity = solanaPubkeyField(input.solanaPubkey);
  const lineup = { id: nextId("lineup", slate.lineups), seasonId: input.seasonId, solanaPubkey: identity.solanaPubkey, slots: input.slots };
  slate.lineups.push(lineup); return lineup;
}
export function openMark(slate, input) {
  if (slate.marks.find((mark) => mark.lineupId === input.lineupId && mark.fixtureId === input.fixtureId)) throw new Error("second mark for the same lineup and fixture");
  const identity = solanaPubkeyField(input.solanaPubkey);
  const mark = { id: nextId("mark", slate.marks), lineupId: input.lineupId, fixtureId: input.fixtureId, outcomeCiteId: input.outcomeCiteId, solanaPubkey: identity.solanaPubkey, citedOutcome: input.citedOutcome, resolvedOutcome: null, mark: "open", createdAt: input.createdAt, challenge: slatePassChallenge(), frozen: false };
  slate.marks.push(mark); return mark;
}
export function resolveMark(slate, markId, polymarketResolution) {
  const mark = slate.marks.find((row) => row.id === markId);
  if (!mark) throw new Error("mark not found");
  if (mark.frozen) throw new Error("mark is already frozen");
  if (!polymarketResolution || polymarketResolution.resolvedOutcome == null) throw new Error("resolution must be copied from Polymarket");
  mark.resolvedOutcome = polymarketResolution.resolvedOutcome;
  mark.mark = "resolved";
  return mark;
}

/** Copy one already-resolved Polymarket condition onto the mark and freeze it. Does not adjudicate and does not sign. */
export function freezeResolvedCondition(slate, markId, condition, check) {
  const mark = slate.marks.find((row) => row.id === markId);
  if (!mark) throw new Error("mark not found");
  if (mark.frozen) throw new Error("mark is already frozen");
  const cite = slate.cites.find((row) => row.id === mark.outcomeCiteId);
  if (!cite) throw new Error("cite not found");
  if (!condition || condition.conditionId !== cite.conditionId) throw new Error("condition must match the cite");
  if (condition.resolved !== true || condition.resolvedOutcome == null || condition.resolvedOutcome === "") throw new Error("condition is not already resolved");
  const before = slate.marks.length;
  mark.resolvedOutcome = condition.resolvedOutcome;
  mark.mark = "resolved";
  mark.frozen = true;
  mark.frozenConditionId = condition.conditionId;
  mark.challenge = considerSigner(check);
  if (slate.marks.length !== before) throw new Error("freeze must not create a mark");
  return mark;
}
