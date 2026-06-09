// LiteSVM invoke test: actually executes the loaded Metaplex Token Metadata program. Creates a
// mint (SPL Token is bundled in LiteSVM) and a metadata account by sending a transaction into the
// in-process validator, then reads the metadata back through the metaplex() plugin.
//
// Requires tests/fixtures/mpl_token_metadata.so (see scripts/fetch-program.mjs). Network-free
// once the .so is present; the CI job fetches it first.
import { describe, test, before } from "node:test";
import assert from "node:assert";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  generateKeyPairSigner,
  lamports,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getProgramDerivedAddress,
  getAddressEncoder,
  getUtf8Encoder,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import { getInitializeMint2Instruction, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { connectLiteSvm, FailedTransactionMetadata } from "kit-plugin-litesvm";
import { getCreateMetadataAccountV3Instruction } from "../generated/mpl_token_metadata-client/instructions/createMetadataAccountV3.js";
import { metaplex } from "./plugin.js";
import { METADATA_PROGRAM_ID } from "./constants.js";

const PROGRAM_SO = fileURLToPath(new URL("../../tests/fixtures/mpl_token_metadata.so", import.meta.url));
const MINT_SPACE = 82n;

describe("metaplex() create+read over LiteSVM (executes the loaded program)", () => {
  let hasProgram = false;
  before(() => {
    hasProgram = existsSync(PROGRAM_SO);
  });

  test("creates a mint + metadata via the program and reads it back", async (t) => {
    if (!hasProgram) return t.skip("Token Metadata .so fixture not present");

    const { svm, connection } = connectLiteSvm();
    svm.addProgramFromFile(METADATA_PROGRAM_ID, PROGRAM_SO);

    const payer = await generateKeyPairSigner();
    const mint = await generateKeyPairSigner();
    svm.airdrop(payer.address, lamports(1_000_000_000n));

    const addressEncoder = getAddressEncoder();
    const [metadataPda] = await getProgramDerivedAddress({
      programAddress: METADATA_PROGRAM_ID,
      seeds: [
        getUtf8Encoder().encode("metadata"),
        addressEncoder.encode(METADATA_PROGRAM_ID),
        addressEncoder.encode(mint.address),
      ],
    });

    const mintRent = await connection.rpc.getMinimumBalanceForRentExemption(MINT_SPACE).send();

    const createMintAccount = getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: mintRent,
      space: MINT_SPACE,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    });
    const initializeMint = getInitializeMint2Instruction({
      mint: mint.address,
      decimals: 6,
      mintAuthority: payer.address,
      freezeAuthority: null,
    });
    const createMetadata = getCreateMetadataAccountV3Instruction({
      metadata: metadataPda,
      mint: mint.address,
      mintAuthority: payer,
      payer,
      updateAuthority: payer.address,
      data: {
        name: "LiteSVM Token",
        symbol: "LSVM",
        uri: "https://example.com/lsvm.json",
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null,
      },
      isMutable: true,
      collectionDetails: null,
    });

    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(payer, m),
      (m) =>
        setTransactionMessageLifetimeUsingBlockhash(
          { blockhash: svm.latestBlockhash(), lastValidBlockHeight: 10_000n },
          m,
        ),
      (m) => appendTransactionMessageInstructions([createMintAccount, initializeMint, createMetadata], m),
    );
    const signedTransaction = await signTransactionMessageWithSigners(message);

    const result = svm.sendTransaction(signedTransaction);
    if (result instanceof FailedTransactionMetadata) {
      assert.fail(`transaction failed: ${result.err()}\n${result.meta().logs().join("\n")}`);
    }

    // Read the metadata back through the plugin, over the LiteSVM-backed connection.
    const client = metaplex()(connection);
    const tokenMetadata = await client.getMetaplexMetadata(mint.address);

    assert.ok(tokenMetadata, "should read the metadata created on-chain");
    assert.strictEqual(tokenMetadata.name.replace(/\0+$/, "").trim(), "LiteSVM Token");
    assert.strictEqual(tokenMetadata.symbol.replace(/\0+$/, "").trim(), "LSVM");
    assert.strictEqual(tokenMetadata.uri.replace(/\0+$/, "").trim(), "https://example.com/lsvm.json");
  });
});
