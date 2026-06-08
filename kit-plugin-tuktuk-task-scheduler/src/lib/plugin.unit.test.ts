// Offline test: plugin construction. Runs in CI without network access.
import { describe, test } from "node:test";
import assert from "node:assert";
import { connect } from "solana-kite";
import { tuktukTaskScheduler } from "./plugin.js";

describe("tuktukTaskScheduler() plugin", () => {
  test("extends a Kite client with tuktuk methods (offline construction)", () => {
    const client = tuktukTaskScheduler()(connect("devnet"));

    assert.ok(client.tuktuk, "exposes the tuktuk client");
    assert.strictEqual(typeof client.getOrCreateTaskQueue, "function");
    assert.strictEqual(typeof client.queueTask, "function");
    assert.strictEqual(typeof client.createCronJob, "function");
    assert.strictEqual(typeof client.compileTukTukTransaction, "function");
    // The underlying Kite connection is preserved.
    assert.strictEqual(typeof client.getLamportBalance, "function");
    assert.ok(client.rpc, "preserves the Kite rpc");
  });
});
