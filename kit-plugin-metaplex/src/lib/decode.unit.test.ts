// Offline tests: decode real Metaplex Token Metadata accounts captured from
// mainnet (see src/lib/__fixtures__). These run in CI without network access.
import { describe, test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { connect } from "solana-kite";
import { address } from "@solana/kit";
import { deserializeMetaplexMetadata } from "./metadata-deserializer.js";
import { metaplex } from "./plugin.js";

type MetadataFixture = {
  mint: string;
  metadataAccount: string;
  owner: string;
  base64: string;
};

function loadFixture(name: string): MetadataFixture {
  const url = new URL(`./__fixtures__/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf-8")) as MetadataFixture;
}

describe("deserializeMetaplexMetadata (mainnet fixtures)", () => {
  test("decodes the USDC metadata account", () => {
    const fixture = loadFixture("usdc-metadata-account");
    const data = new Uint8Array(Buffer.from(fixture.base64, "base64"));

    const metadata = deserializeMetaplexMetadata(data, address(fixture.mint));

    assert.strictEqual(metadata.name.replace(/\0+$/, "").trim(), "USD Coin");
    assert.strictEqual(metadata.symbol.replace(/\0+$/, "").trim(), "USDC");
    assert.strictEqual(typeof metadata.uri, "string");
    // updateAuthority is decoded from raw bytes via readPublicKey; assert it is a
    // valid base58 address (regression test for the previous base64 decode bug).
    assert.ok(
      typeof metadata.updateAuthority === "string" &&
        /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(metadata.updateAuthority),
      "updateAuthority should decode to a valid base58 address",
    );
  });

  test("decodes the BONK metadata account", () => {
    const fixture = loadFixture("bonk-metadata-account");
    const data = new Uint8Array(Buffer.from(fixture.base64, "base64"));

    const metadata = deserializeMetaplexMetadata(data, address(fixture.mint));

    assert.strictEqual(metadata.symbol.replace(/\0+$/, "").trim(), "Bonk");
    assert.ok(metadata.name.length > 0, "BONK metadata should have a name");
  });
});

describe("metaplex() plugin", () => {
  test("extends a client with metaplex methods (offline construction)", () => {
    const client = metaplex()(connect("devnet"));

    assert.ok(client.metaplex, "exposes the metaplex client");
    assert.strictEqual(typeof client.getTokenMetadata, "function");
    assert.strictEqual(typeof client.getMetaplexMetadata, "function");
    assert.strictEqual(typeof client.getTokenExtensionsMetadata, "function");
    assert.strictEqual(typeof client.getCompleteMetadata, "function");
    assert.strictEqual(typeof client.updateTokenMetadata, "function");
    // The underlying connection is preserved.
    assert.strictEqual(typeof client.getLamportBalance, "function");
    assert.ok(client.rpc, "preserves the rpc");
  });
});
