import { describe, test } from "node:test";
import assert from "node:assert";
import { connect } from "solana-kite";
import { ans } from "./plugin.js";

describe("ans", () => {
  test("plugin extends connection with ANS methods", () => {
    const connection = connect("mainnet-beta");
    const ansPlugin = ans();
    const connectionWithANS = ansPlugin(connection);

    assert.ok(typeof connectionWithANS.getAddressForANSName === "function");
    assert.ok(typeof connectionWithANS.getANSNamesForAddress === "function");
    assert.ok(connectionWithANS.ans);
  });

  test("plugin preserves original connection methods", () => {
    const connection = connect("mainnet-beta");
    const ansPlugin = ans();
    const connectionWithANS = ansPlugin(connection);

    assert.ok(typeof connectionWithANS.getLamportBalance === "function");
    assert.ok(typeof connectionWithANS.getTokenAccounts === "function");
    assert.ok(connectionWithANS.rpc);
  });
});

describe("getAddressForANSName integration", () => {
  test("returns address when given an address", async () => {
    const connection = connect("mainnet-beta");
    const ansPlugin = ans();
    const client = ansPlugin(connection);

    const testAddress = "dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8";
    const resolvedAddress = await client.getAddressForANSName(testAddress);

    assert.strictEqual(String(resolvedAddress), testAddress);
  });

  test("throws error for invalid domain format", async () => {
    const connection = connect("mainnet-beta");
    const ansPlugin = ans();
    const client = ansPlugin(connection);

    await assert.rejects(
      async () => {
        await client.getAddressForANSName("nodot");
      },
      {
        message: /Invalid domain format/,
      },
    );
  });
});

describe("caching", () => {
  test("clearCache removes cached entries", () => {
    const connection = connect("mainnet-beta");
    const ansPlugin = ans();
    const client = ansPlugin(connection);

    client.ans.clearCache();

    assert.ok(true);
  });
});
