// LiteSVM integration test: injects a Pyth price account into an in-process LiteSVM and reads it
// back through the pyth() plugin's on-chain reader, over a LiteSVM-backed Kite connection.
//
// This exercises the plugin's read + decode path against the LiteSVM RPC adapter without any
// network. (Pyth's legacy on-chain push-oracle accounts are no longer published on mainnet, so a
// synthetic-but-correctly-encoded account is used; the byte layout matches parsePythPriceAccountData.)
import { describe, test } from "node:test";
import assert from "node:assert";
import { generateKeyPairSigner } from "@solana/kit";
import { connectLiteSvm } from "kit-plugin-litesvm";
import { pyth } from "./plugin.js";
import { PYTH_PRICE_ACCOUNT_MAGIC, PYTH_ACCOUNT_TYPE_PRICE, PYTH_RECEIVER_PROGRAM_ID } from "./constants.js";

function buildPriceAccount(): Uint8Array {
  const buffer = new ArrayBuffer(132);
  const view = new DataView(buffer);
  view.setUint32(0, PYTH_PRICE_ACCOUNT_MAGIC, true);
  view.setUint32(8, PYTH_ACCOUNT_TYPE_PRICE, true);
  view.setInt32(20, -2, true); // exponent
  view.setBigInt64(64, 1_700_000_000n, true); // publish time
  view.setBigInt64(100, 15_000n, true); // price -> 150.00
  view.setBigUint64(108, 75n, true); // confidence
  view.setUint32(116, 1, true); // status = trading
  view.setBigUint64(124, 250_000_000n, true); // slot
  return new Uint8Array(buffer);
}

describe("pyth() over LiteSVM", () => {
  test("reads an on-chain price account through the plugin", async () => {
    const { svm, connection } = connectLiteSvm();
    const priceAccount = await generateKeyPairSigner();
    const data = buildPriceAccount();

    svm.setAccount({
      address: priceAccount.address,
      data,
      executable: false,
      lamports: 2_000_000n,
      programAddress: PYTH_RECEIVER_PROGRAM_ID,
      space: BigInt(data.length),
    });

    const client = pyth()(connection);
    const onchainPrice = await client.pyth.getPythOnchainPrice(priceAccount.address);

    assert.ok(onchainPrice, "should read the price account");
    assert.strictEqual(onchainPrice.price, 150.0);
    assert.strictEqual(onchainPrice.status, "trading");
    assert.strictEqual(onchainPrice.exponent, -2);
  });
});
