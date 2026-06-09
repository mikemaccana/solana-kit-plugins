// Offline test: plugin construction. Runs in CI without network access.
import { describe, test } from "node:test";
import assert from "node:assert";
import { connect } from "solana-kite";
import { squads } from "./plugin.js";

describe("squads() plugin", () => {
  test("extends a Kite client with squads methods (offline construction)", () => {
    const client = squads()(connect("devnet"));

    assert.ok(client.squads, "exposes the squads client");
    assert.strictEqual(typeof client.createMultisig, "function");
    assert.strictEqual(typeof client.createProposal, "function");
    assert.strictEqual(typeof client.approveProposal, "function");
    assert.strictEqual(typeof client.executeProposal, "function");
    assert.strictEqual(typeof client.getMultisigAddress, "function");
    // The underlying Kite connection is preserved.
    assert.strictEqual(typeof client.getLamportBalance, "function");
    assert.ok(client.rpc, "preserves the Kite rpc");
  });
});
