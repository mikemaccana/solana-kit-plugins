// LiteSVM integration test: encodes a Squads Multisig account with the Codama-generated encoder,
// injects it into an in-process LiteSVM, and reads it back through the squadsMultisig() plugin
// over a LiteSVM-backed Kite connection. Exercises the plugin's read + decode path, no network.
import { describe, test } from "node:test";
import assert from "node:assert";
import { generateKeyPairSigner, none } from "@solana/kit";
import { connectLiteSvm } from "kit-plugin-litesvm";
import { squadsMultisig } from "./plugin.js";
import { SQUADS_PROGRAM_ID } from "./constants.js";
import { getMultisigEncoder } from "../generated/squads_multisig_program-client/accounts/multisig.js";

describe("squadsMultisig() over LiteSVM", () => {
  test("reads a multisig account through the plugin", async () => {
    const { svm, connection } = connectLiteSvm();
    const [multisig, createKey, m1, m2, m3] = await Promise.all([
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
    ]);

    const data = getMultisigEncoder().encode({
      createKey: createKey.address,
      configAuthority: "11111111111111111111111111111111",
      threshold: 2,
      timeLock: 0,
      transactionIndex: 0n,
      staleTransactionIndex: 0n,
      rentCollector: none(),
      bump: 254,
      members: [
        { key: m1.address, permissions: { mask: 7 } },
        { key: m2.address, permissions: { mask: 7 } },
        { key: m3.address, permissions: { mask: 7 } },
      ],
    });

    svm.setAccount({
      address: multisig.address,
      data: new Uint8Array(data),
      executable: false,
      lamports: 5_000_000n,
      programAddress: SQUADS_PROGRAM_ID,
      space: BigInt(data.length),
    });

    const client = squadsMultisig()(connection);
    const account = await client.getMultisigAccount(multisig.address);

    assert.strictEqual(account.threshold, 2);
    assert.strictEqual(account.members.length, 3);
    assert.deepStrictEqual([...account.members].sort(), [m1.address, m2.address, m3.address].sort());
  });
});
