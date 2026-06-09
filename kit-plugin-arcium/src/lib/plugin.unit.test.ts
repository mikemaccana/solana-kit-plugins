// Offline tests: the factory shape and the pure serialization helpers.
// Run in CI without network access. (ArciumClient.create reads on-chain MXE
// state, so it is exercised by network/integration tests, not here.)
import { describe, test } from "node:test";
import assert from "node:assert";
import { arcium } from "./plugin.js";
import { serializeLE, deserializeLE, getRandomNonce } from "./serialization.js";

describe("arcium() plugin", () => {
  test("is a factory returning a client plugin function", () => {
    const plugin = arcium();
    assert.strictEqual(typeof plugin, "function");
  });
});

describe("arcium serialization helpers", () => {
  test("serializeLE / deserializeLE round-trip", () => {
    const value = 1_234_567_890_123n;
    const bytes = serializeLE(value, 16);
    assert.strictEqual(bytes.length, 16);
    assert.strictEqual(deserializeLE(bytes), value);
  });

  test("getRandomNonce returns 12 bytes", () => {
    const nonce = getRandomNonce();
    assert.strictEqual(nonce.length, 12);
  });
});
