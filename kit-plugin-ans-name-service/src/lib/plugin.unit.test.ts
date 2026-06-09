// Offline test: plugin construction. Runs in CI without network access.
import { describe, test } from "node:test";
import assert from "node:assert";
import { connect } from "solana-kite";
import { ans } from "./plugin.js";

describe("ans() plugin", () => {
  test("extends a Kite client with ANS methods (offline construction)", () => {
    const client = ans()(connect("devnet"));

    assert.ok(client.ans, "exposes the ans client");
    assert.strictEqual(typeof client.getAddressForANSName, "function");
    assert.strictEqual(typeof client.getANSNamesForAddress, "function");
    // The plugin wraps these Kite methods with name-resolution.
    assert.strictEqual(typeof client.getLamportBalance, "function");
    assert.strictEqual(typeof client.getTokenAccounts, "function");
    assert.ok(client.rpc, "preserves the Kite rpc");
  });
});
