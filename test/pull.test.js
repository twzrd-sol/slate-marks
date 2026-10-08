import assert from "node:assert/strict";
import test from "node:test";
import { createSlate } from "../src/slate.js";
import { freezeCopiedCondition, mockResolvedGamma, pullResolved } from "../src/pull.js";

const PUBKEY = "So11111111111111111111111111111111111111112";

test("a mock resolved Gamma payload freezes one lineup mark", async () => {
  let calls = 0;
  const payload = await pullResolved(async () => {
    calls += 1;
    return mockResolvedGamma();
  });
  const slate = createSlate();
  const mark = freezeCopiedCondition(slate, payload, {
    solanaPubkey: PUBKEY,
    citedOutcome: "home",
    citedAt: "2026-10-07T02:00:00Z",
    createdAt: "2026-10-07T02:01:00Z",
  });

  assert.equal(calls, 1);
  assert.equal(slate.fixtures[0].home, "BOS");
  assert.equal(slate.fixtures[0].away, "NYK");
  assert.equal(slate.cites[0].source, "polymarket-gamma");
  assert.equal(mark.citedOutcome, "home");
  assert.equal(mark.resolvedOutcome, "home");
  assert.equal(mark.frozen, true);
  assert.equal(mark.frozenConditionId, "0xresolved");
  assert.equal(mark.challenge.signerInvocations, 0);
  assert.equal(mark.challenge.amount, "0");
  assert.equal(slate.marks.length, 1);
});
