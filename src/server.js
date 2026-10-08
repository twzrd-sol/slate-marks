import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { freezeCopiedCondition, pullResolved } from "./pull.js";
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

function renderPage(slate) {
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
  </style>
</head>
<body>
  <main>
    <h1>Slate marks</h1>
    <p class="lede">One lineup mark copied from an already-resolved game. No order. No payout.</p>
    ${cards || "<p class=\"lede\">No frozen mark.</p>"}
  </main>
</body>
</html>`;
}

async function ensureMark(dbPath, fetchImpl) {
  const slate = loadSlate(dbPath);
  if (slate.marks.length > 0) return slate;
  const payload = await pullResolved(fetchImpl);
  freezeCopiedCondition(slate, payload, {
    solanaPubkey: LINEUP,
    citedOutcome: "home",
    citedAt: "2026-10-07T02:00:00Z",
    createdAt: "2026-10-07T02:01:00Z",
  });
  saveSlate(dbPath, slate);
  return slate;
}

export function startSlateServer({ dbPath, fetchImpl, host = "127.0.0.1", port = 0 }) {
  const ready = ensureMark(dbPath, fetchImpl);
  const server = createServer((req, res) => {
    ready.then((slate) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/") {
        send(res, 200, renderPage(slate), "text/html; charset=utf-8");
        return;
      }
      if (req.method === "GET" && url.pathname === "/record") {
        send(res, 200, JSON.stringify(slate), "application/json");
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
