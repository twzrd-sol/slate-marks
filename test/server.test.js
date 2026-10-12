import test from "node:test";
import assert from "node:assert";
import { startSlateServer } from "../src/server.js";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Create a temp database for testing
const tempDir = tmpdir();
const dbPath = join(tempDir, `test-slate-${Date.now()}.sqlite`);

// Initialize empty slate database
writeFileSync(dbPath.replace(".sqlite", ".json"), JSON.stringify({
  marks: [],
  fixtures: [],
  cites: [],
}));

test("POST /prepare/mainnet returns unsigned instruction", async () => {
  const server = await startSlateServer({
    dbPath,
    host: "127.0.0.1",
    port: 0,
  });

  const response = await fetch(`http://127.0.0.1:${server.port}/prepare/mainnet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      frozenMark: {
        id: "mark_1",
        gameId: "game_123",
        conditionId: "0x456def",
        resolvedOutcome: "home",
        citedAt: "2026-10-12T00:00:00Z",
      },
      creator: "So11111111111111111111111111111111111111112",
    }),
  });

  assert.strictEqual(response.status, 200);
  const body = await response.json();
  assert.ok(body.instruction);
  assert.ok(body.instruction.keys);
  
  await server.close();
});

test("POST /prepare/icelan returns unsigned instruction", async () => {
  const server = await startSlateServer({
    dbPath,
    host: "127.0.0.1",
    port: 0,
  });

  const response = await fetch(`http://127.0.0.1:${server.port}/prepare/icelan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rlanMark: {
        id: "rlan_1",
        markId: "mark_1",
        gameId: "game_123",
        resolvedOutcome: "home",
      },
      creator: "So11111111111111111111111111111111111111112",
    }),
  });

  assert.strictEqual(response.status, 200);
  const body = await response.json();
  assert.ok(body.instruction);
  
  await server.close();
});

test("GET /health returns status", async () => {
  const server = await startSlateServer({
    dbPath,
    host: "127.0.0.1",
    port: 0,
  });

  const response = await fetch(`http://127.0.0.1:${server.port}/health`);
  
  assert.strictEqual(response.status, 200);
  const body = await response.json();
  assert.strictEqual(body.status, "ok");
  
  await server.close();
});
