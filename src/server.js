import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { freezeCopiedCondition, pullLiveResolved, pullResolved } from "./pull.js";
import { loadSlate, saveSlate } from "./store.js";

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

export function startSlateServer({ dbPath, fetchImpl, host = "127.0.0.1", port = 0 }) {
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
  const server = createServer((req, res) => {
    ready.then(async () => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method === "POST" && url.pathname === "/refetch") {
        try {
          const updated = await refresh();
          send(res, 200, JSON.stringify(updated), "application/json");
        } catch {
          send(res, 502, JSON.stringify({ error: refreshError }), "application/json");
        }
        return;
      }
      const shown = loadSlate(dbPath);
      if (req.method === "GET" && url.pathname === "/") {
        send(res, 200, renderPage(shown, refreshError), "text/html; charset=utf-8");
        return;
      }
      if (req.method === "GET" && url.pathname === "/record") {
        send(res, 200, JSON.stringify({ ...shown, refreshError }), "application/json");
        return;
      }
      send(res, 404, "not found", "text/plain; charset=utf-8");
    }).catch((error) => {
      if (!res.headersSent) send(res, 500, error.message, "text/plain; charset=utf-8");
    });
  });
  return ready.then(() => new Promise((resolveReady) => {
    server.listen(port, host, () => {
      resolveReady({
        port: server.address().port,
        close() {
          return new Promise((done) => server.close(done));
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
  }).then(({ port }) => {
    console.log(`slate-marks http://${process.env.HOST ?? "127.0.0.1"}:${port}`);
  });
}
