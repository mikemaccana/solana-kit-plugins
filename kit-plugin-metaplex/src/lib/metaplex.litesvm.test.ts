// LiteSVM integration test: loads the real Metaplex Token Metadata program (fetched from
// mainnet, see scripts/fetch-program.mjs) into an in-process LiteSVM, injects a real metadata
// account, and reads it back through the metaplex() plugin over a LiteSVM-backed Kite connection.
//
// Not part of test:ci (no network), but runs offline once tests/fixtures/mpl_token_metadata.so
// exists. The CI job fetches that .so first.
import { describe, test, before } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { address, getBase64Encoder, type Address } from "@solana/kit";
import { connectLiteSvm } from "kit-plugin-litesvm";
import { metaplex } from "./plugin.js";
import { METADATA_PROGRAM_ID } from "./constants.js";

const PROGRAM_SO = fileURLToPath(new URL("../../tests/fixtures/mpl_token_metadata.so", import.meta.url));
const USDC_FIXTURE = fileURLToPath(new URL("./__fixtures__/usdc-metadata-account.json", import.meta.url));

describe("metaplex() over LiteSVM (real mainnet program)", () => {
  let hasProgram = false;
  before(() => {
    hasProgram = existsSync(PROGRAM_SO);
    if (!hasProgram) {
      console.warn(
        `skipping: ${PROGRAM_SO} not found. Run:\n` +
          `  node scripts/fetch-program.mjs ${METADATA_PROGRAM_ID} tests/fixtures/mpl_token_metadata.so mainnet`,
      );
    }
  });

  test("loads the program and reads an injected metadata account via the plugin", async (t) => {
    if (!hasProgram) return t.skip("Token Metadata .so fixture not present");

    const fixture = JSON.parse(readFileSync(USDC_FIXTURE, "utf-8")) as {
      mint: string;
      metadataAccount: string;
      base64: string;
    };
    const data = new Uint8Array(getBase64Encoder().encode(fixture.base64));

    const { svm, connection } = connectLiteSvm();

    // Load the real mainnet Token Metadata program into the in-process validator.
    svm.addProgramFromFile(METADATA_PROGRAM_ID, PROGRAM_SO);
    const programAccount = svm.getAccount(METADATA_PROGRAM_ID);
    assert.ok(programAccount && programAccount.executable, "metadata program should be loaded and executable");

    // Inject the real USDC metadata account (owned by the metadata program) at its PDA.
    svm.setAccount({
      address: address(fixture.metadataAccount),
      data,
      executable: false,
      lamports: 5_616_720n,
      programAddress: METADATA_PROGRAM_ID,
      space: BigInt(data.length),
    });

    // Read it back through the plugin, over the LiteSVM-backed Kite connection.
    const client = metaplex()(connection);
    const tokenMetadata = await client.getMetaplexMetadata(fixture.mint as Address);

    assert.ok(tokenMetadata, "should read metadata");
    assert.strictEqual(tokenMetadata.name.replace(/\0+$/, "").trim(), "USD Coin");
    assert.strictEqual(tokenMetadata.symbol.replace(/\0+$/, "").trim(), "USDC");
  });
});
