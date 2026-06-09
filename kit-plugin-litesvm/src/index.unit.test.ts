// Offline test: a LiteSVM-backed connection serves reads from the in-process SVM.
import { describe, test } from "node:test";
import assert from "node:assert";
import { generateKeyPairSigner, lamports } from "@solana/kit";
import { connectLiteSvm } from "./index.js";

describe("connectLiteSvm()", () => {
  test("serves reads from the in-process LiteSVM", async () => {
    const { svm, connection } = connectLiteSvm();
    const signer = await generateKeyPairSigner();

    svm.airdrop(signer.address, lamports(1_500_000_000n));

    const balance = await connection.getLamportBalance(signer.address);
    assert.strictEqual(balance, 1_500_000_000n);
  });

  test("reads account data injected via setAccount", async () => {
    const { svm, connection } = connectLiteSvm();
    const signer = await generateKeyPairSigner();
    const data = new Uint8Array([1, 2, 3, 4]);

    svm.setAccount({
      address: signer.address,
      data,
      executable: false,
      lamports: 1_000_000n,
      programAddress: "11111111111111111111111111111111",
      space: BigInt(data.length),
    });

    const account = await connection.rpc.getAccountInfo(signer.address, { encoding: "base64" }).send();
    assert.ok(account.value, "account should exist");
    assert.strictEqual(account.value.lamports, 1_000_000n);
  });
});
