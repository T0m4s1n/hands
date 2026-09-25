import assert from "node:assert/strict";
import test from "node:test";
import {
  finishSettlement,
  requestSettlement,
  type SettlementFields,
} from "./settlement.ts";

test("a stage cannot begin settlement twice", () => {
  const state: SettlementFields = { lifecycle: "active", pendingMark: 0 };
  assert.equal(requestSettlement(state, 0.8), true);
  assert.equal(requestSettlement(state, 0.2), false);
  assert.equal(state.pendingMark, 0.8);
});

test("a pending mark can only be consumed once", () => {
  const state: SettlementFields = {
    lifecycle: "settling",
    pendingMark: 0.75,
  };
  assert.equal(finishSettlement(state), 0.75);
  assert.equal(finishSettlement(state), null);
});

test("settlement clamps invalid marks to the score range", () => {
  const high: SettlementFields = { lifecycle: "active", pendingMark: 0 };
  const low: SettlementFields = { lifecycle: "active", pendingMark: 0 };
  requestSettlement(high, 2);
  requestSettlement(low, -1);
  assert.equal(high.pendingMark, 1);
  assert.equal(low.pendingMark, 0);
});
