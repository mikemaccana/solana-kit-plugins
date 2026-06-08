// Offline test: plugin construction. Runs in CI without network access.
// (Network/Jupiter API integration tests live in plugin.test.ts.)
import { describe, test } from "node:test";
import assert from "node:assert";
import { connect } from "solana-kite";
import { jupiterPricing } from "./plugin.js";

describe("jupiterPricing() plugin", () => {
  test("extends a Kite client with pricing methods (offline construction)", () => {
    const client = jupiterPricing()(connect("devnet"));

    assert.ok(client.jupiter, "exposes the jupiter client");
    assert.strictEqual(typeof client.getTokenPrice, "function");
    assert.strictEqual(typeof client.getPortfolioValue, "function");
    assert.strictEqual(typeof client.convertBetweenTokens, "function");
    assert.strictEqual(typeof client.formatUsdValue, "function");
    // transferTokens is enhanced but must remain callable.
    assert.strictEqual(typeof client.transferTokens, "function");
    // The underlying Kite connection is preserved.
    assert.strictEqual(typeof client.getLamportBalance, "function");
    assert.ok(client.rpc, "preserves the Kite rpc");
  });
});
