import express from "express";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { freezeCopiedCondition, pullLiveResolved, pullResolved } from "./pull.js";
import { loadSlate, saveSlate } from "./store.js";
import { createAttestationRecord, encodeAttestationData } from "./mainnet.js";
import {
  createHelixEngagementObservation,
  createEngagementMark,
  encodeEngagementMarkData,
} from "./rlan.js";
import { createRewardCredential, encodeCredentialData } from "./icelan.js";
import { createHelixClient, observeStreamEngagement, observationToEngagementMetrics } from "./helix-client.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LINEUP = "So11111111111111111111111111111111111111112";

function send(res, status, body, type) {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderPage(slate, refreshError = "") {
  const cards = slate.marks.map((mark) => {
    const fixture = slate.fixtures.find((row) => row.id === mark.fixtureId);
    const cite = slate.cites.find((row) => row.id === mark.outcomeCiteId);
    return `<article class="mark">
      <p class="meta">${escapeHtml(fixture?.home ?? "")} vs ${escapeHtml(fixture?.away ?? "")}</p>
      <h2>${escapeHtml(fixture?.startsAt ?? "")}</h2>
      <p>Cited outcome <strong>${escapeHtml(mark.citedOutcome)}</strong></p>
      <p>Frozen result <strong>${escapeHtml(mark.resolvedOutcome ?? "")}</strong></p>
      <p class="meta">${mark.frozen ? "frozen" : "open"} · ${escapeHtml(cite?.source ?? "")} · ${escapeHtml(cite?.conditionId ?? "")}</p>
    </article>`;
  }).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Slate marks</title>
  <style>
    body { margin: 0; background: #10141a; color: #10141a; font-family: "Iowan Old Style", Palatino, serif; }
    main { max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; }
    h1, .lede { color: #e7eef6; font-weight: 500; }
    h1 { letter-spacing: 0.08em; text-transform: uppercase; font-size: 1.1rem; }
    .mark { background: #f4f7fb; padding: 24px; margin-top: 16px; }
    .meta { font-family: ui-monospace, monospace; font-size: 0.8rem; }
    button { font: inherit; padding: 8px 14px; cursor: pointer; background: #10141a; color: #e7eef6; border: 0; }
    .error { color: #ffb4ab; }
  </style>
</head>
<body>
  <main>
    <h1>Slate marks</h1>
    <p class="lede">Frozen lineup marks copied from already-resolved games. No order. No payout.</p>
    <p><button id="refetch" type="button">Re-fetch</button></p>
    <p id="refresh-status" class="${refreshError ? "error" : "lede"}" role="status">${escapeHtml(refreshError)}</p>
    ${cards || "<p class=\"lede\">No frozen mark.</p>"}
  </main>
  <script>
    document.getElementById("refetch").addEventListener("click", async () => {
      try {
        const response = await fetch("/refetch", { method: "POST" });
        if (response.ok) {
          location.reload();
          return;
        }
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Refresh failed; saved history is unchanged.");
      } catch (error) {
        const status = document.getElementById("refresh-status");
        status.className = "error";
        status.textContent = error.message || "Refresh failed; saved history is unchanged.";
      }
    });
  </script>
</body>
</html>`;
}

function stamp() {
  return new Date().toISOString();
}

function freezePayload(dbPath, payload) {
  const slate = loadSlate(dbPath);
  if (slate.cites.some((cite) => cite.conditionId === payload.condition.conditionId)) return slate;
  const updated = structuredClone(slate);
  freezeCopiedCondition(updated, payload, {
    solanaPubkey: LINEUP,
    citedOutcome: payload.event.home,
    citedAt: stamp(),
    createdAt: stamp(),
  });
  saveSlate(dbPath, updated);
  return updated;
}

export function startSlateServer({ dbPath, fetchImpl, host = "127.0.0.1", port = 0, helixClientId = "", helixAccessToken = "" }) {
  const read = fetchImpl ? () => pullResolved(fetchImpl) : () => pullLiveResolved();
  let refreshError = "";
  let refreshInFlight = null;
  const refresh = () => {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = Promise.resolve().then(read).then((payload) => {
      const slate = freezePayload(dbPath, payload);
      refreshError = "";
      return slate;
    }).catch((error) => {
      refreshError = `Refresh failed: ${error?.message || "unknown error"}. Saved history is unchanged.`;
      throw error;
    }).finally(() => { refreshInFlight = null; });
    return refreshInFlight;
  };
  const existing = loadSlate(dbPath);
  const ready = existing.marks.length > 0 ? Promise.resolve(existing) : refresh().catch(() => loadSlate(dbPath));

  // Create Express app for API endpoints
  const app = express();
  app.use(express.json());

  // Initialize Helix client if credentials provided
  const helixClient = helixClientId && helixAccessToken
    ? createHelixClient(helixClientId, helixAccessToken)
    : null;

  // POST /prepare/mainnet
  app.post("/prepare/mainnet", async (req, res) => {
    try {
      const { frozenMark, creator } = req.body;
      if (!frozenMark || !creator) {
        return res.status(400).json({ error: "frozenMark and creator required" });
      }
      const attestation = createAttestationRecord(frozenMark, null, frozenMark.citedAt);
      const encoded = encodeAttestationData(attestation);
      const instruction = {
        program: "mainnet-attestation",
        keys: [
          { pubkey: creator, isSigner: false, isWritable: true },
          { pubkey: "11111111111111111111111111111111", isSigner: false, isWritable: false },
        ],
        data: encoded,
      };
      res.json({
        instruction,
        blockhash_required: true,
        pda_seed: ["attestation", creator, frozenMark.conditionId],
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /prepare/rlan
  app.post("/prepare/rlan", async (req, res) => {
    try {
      const { frozenMark, streamerUsername, creator } = req.body;
      if (!frozenMark || !streamerUsername || !creator) {
        return res.status(400).json({ error: "frozenMark, streamerUsername, and creator required" });
      }
      if (!helixClient) {
        return res.status(503).json({ error: "Helix client not configured" });
      }
      const observation = await observeStreamEngagement(helixClient, streamerUsername);
      if (!observation) {
        return res.status(404).json({ error: "Stream offline or not found" });
      }
      const engagementObs = createHelixEngagementObservation({ signal: "viewers", data: observation });
      const engagementMark = createEngagementMark(frozenMark, engagementObs, creator);
      const metrics = observationToEngagementMetrics(observation);
      engagementMark.engagement = metrics;
      const encoded = encodeEngagementMarkData(engagementMark);
      const instruction = {
        program: "rlan-engagement",
        keys: [
          { pubkey: creator, isSigner: false, isWritable: true },
          { pubkey: frozenMark.id, isSigner: false, isWritable: false },
          { pubkey: "11111111111111111111111111111111", isSigner: false, isWritable: false },
        ],
        data: encoded,
      };
      res.json({
        instruction,
        blockhash_required: true,
        pda_seed: ["engagement", creator, frozenMark.id],
        observation_timestamp: observation.observed_at,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /prepare/icelan
  app.post("/prepare/icelan", async (req, res) => {
    try {
      const { rlanMark, creator } = req.body;
      if (!rlanMark || !creator) {
        return res.status(400).json({ error: "rlanMark and creator required" });
      }
      const rlanReference = {
        markId: rlanMark.markId,
        rlanMarkId: rlanMark.id,
        gameId: rlanMark.gameId,
        resolvedOutcome: rlanMark.resolvedOutcome,
        citedAt: rlanMark.citedAt,
      };
      const credential = createRewardCredential(rlanReference, creator);
      const encoded = encodeCredentialData(credential);
      const instruction = {
        program: "icelan-rewards",
        keys: [
          { pubkey: creator, isSigner: false, isWritable: true },
          { pubkey: rlanMark.id, isSigner: false, isWritable: false },
          { pubkey: "11111111111111111111111111111111", isSigner: false, isWritable: false },
        ],
        data: encoded,
      };
      res.json({
        instruction,
        blockhash_required: true,
        pda_seed: ["credential", creator, rlanMark.id],
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /health
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      helix_configured: !!helixClient,
    });
  });

  // Fallback for legacy HTTP endpoints - create wrapper
  app.use((req, res, next) => {
    // Convert Express req/res to HTTP server compatible format
    const urlPath = new URL(req.url, "http://127.0.0.1").pathname;
    ready.then(async () => {
      if (req.method === "POST" && urlPath === "/refetch") {
        try {
          const updated = await refresh();
          res.status(200).json(updated);
        } catch {
          res.status(502).json({ error: refreshError });
        }
        return;
      }
      const shown = loadSlate(dbPath);
      if (req.method === "GET" && urlPath === "/") {
        res.type("text/html; charset=utf-8").send(renderPage(shown, refreshError));
        return;
      }
      if (req.method === "GET" && urlPath === "/record") {
        res.json({ ...shown, refreshError });
        return;
      }
      res.status(404).send("not found");
    }).catch((error) => {
      if (!res.headersSent) res.status(500).send(error.message);
    });
  });

  return ready.then(() => new Promise((resolveReady) => {
    const server = app.listen(port, host, () => {
      const addr = server.address();
      resolveReady({
        port: addr.port,
        close() {
          return new Promise((done) => {
            server.close(done);
          });
        },
      });
    });
  }));
}

const launchedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (launchedDirectly) {
  startSlateServer({
    dbPath: join(root, "data", "slate.sqlite"),
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 4178),
    helixClientId: process.env.TWITCH_CLIENT_ID || "",
    helixAccessToken: process.env.TWITCH_ACCESS_TOKEN || "",
  }).then(({ port, close }) => {
    console.log(`slate-marks http://${process.env.HOST ?? "127.0.0.1"}:${port}`);
  }).catch(err => {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  });
}
