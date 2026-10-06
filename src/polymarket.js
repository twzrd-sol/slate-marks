const GAMMA = "https://gamma-api.polymarket.com";
export function createReadAdapter({ fetchImpl, client } = {}) {
  return {
    async listSports() {
      if (fetchImpl) return fetchImpl(`${GAMMA}/sports`);
      const publicClient = client ?? (await loadPublicClient());
      if (typeof publicClient.listSports === "function") return publicClient.listSports();
      throw new Error("inject fetchImpl or a public client with listSports");
    },
    fixtureFromGamma(payload) {
      const event = payload.event ?? payload;
      return { gammaEventId: String(event.id), gameId: event.gameId ?? event.game_id ?? null, home: event.home ?? event.teams?.[0] ?? null, away: event.away ?? event.teams?.[1] ?? null, startsAt: event.startTime ?? event.start_time ?? null, source: "polymarket-gamma", signer: null };
    },
  };
}
async function loadPublicClient() {
  const mod = await import("@polymarket/client");
  if (typeof mod.createPublicClient !== "function") throw new Error("@polymarket/client createPublicClient missing");
  return mod.createPublicClient();
}
