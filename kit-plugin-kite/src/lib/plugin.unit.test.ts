// Offline test: kite() is a valid Kit ClientPlugin that adds the Kite
// Connection surface to a bare Kit client. Runs in CI without network access.
import { describe, test } from "node:test";
import assert from "node:assert";
import { createClient } from "@solana/kit";
import { kite } from "./plugin.js";

describe("kite() plugin", () => {
  test("extends a bare Kit client with the Kite connection surface", () => {
    const client = createClient().use(kite({ clusterNameOrURL: "devnet" }));

    assert.ok(client.rpc, "adds the rpc transport");
    assert.ok(client.rpcSubscriptions, "adds the rpc-subscriptions transport");
    assert.strictEqual(typeof client.getLamportBalance, "function");
    assert.strictEqual(typeof client.sendTransactionFromInstructions, "function");
    assert.strictEqual(typeof client.getExplorerLink, "function");
    // The Kit client `use` method is still available for chaining further plugins.
    assert.strictEqual(typeof client.use, "function");
  });

  test("defaults to localnet when no cluster is given", () => {
    const client = createClient().use(kite());
    assert.ok(client.rpc, "still wires up a connection");
  });
});
