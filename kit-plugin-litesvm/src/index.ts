import { LiteSVM } from "litesvm";
import { createSolanaRpcFromTransport, getBase64Decoder, type Address } from "@solana/kit";
import { connect, type Connection } from "solana-kite";

// Re-export the LiteSVM essentials so consumers depend only on this package.
export { LiteSVM, FailedTransactionMetadata, TransactionMetadata } from "litesvm";

/**
 * A {@link Connection} (from solana-kite) backed by an in-process {@link LiteSVM}, plus the underlying
 * `svm` instance for test setup (loading programs, injecting accounts, airdrops, sending
 * transactions directly).
 */
export interface LiteSvmConnection {
  /** The in-process SVM. Use it to `addProgramFromFile`, `setAccount`, `airdrop`, etc. */
  svm: LiteSVM;
  /** A Connection whose reads are served by `svm`. Pass this to plugins under test. */
  connection: Connection;
}

const base64Decoder = getBase64Decoder();

function encodeAccount(account: { data: Uint8Array; executable: boolean; lamports: bigint; programAddress: Address }) {
  return {
    data: [base64Decoder.decode(account.data), "base64"] as const,
    executable: account.executable,
    lamports: account.lamports,
    owner: account.programAddress,
    rentEpoch: 0n,
    space: BigInt(account.data.length),
  };
}

/**
 * Builds a Solana RPC transport that answers the read methods the connection/plugins use from a LiteSVM
 * instance. Write methods are intentionally not implemented — set up state with the `svm` handle
 * directly (`setAccount`, `sendTransaction`, `airdrop`) and exercise the plugin's read paths
 * through the returned connection.
 */
function liteSvmTransport(svm: LiteSVM) {
  return async <T>(request: { payload: { method: string; params: ReadonlyArray<unknown> } }): Promise<T> => {
    const { method, params } = request.payload;
    const envelope = (result: unknown) => ({ jsonrpc: "2.0", id: 1, result }) as T;

    switch (method) {
      case "getAccountInfo": {
        const account = svm.getAccount(params[0] as Address);
        const value = !account || (account as { exists?: boolean }).exists === false ? null : encodeAccount(account as never);
        return envelope({ context: { slot: 0n }, value });
      }
      case "getMultipleAccounts": {
        const addresses = params[0] as Array<Address>;
        const value = addresses.map((address) => {
          const account = svm.getAccount(address);
          return !account || (account as { exists?: boolean }).exists === false ? null : encodeAccount(account as never);
        });
        return envelope({ context: { slot: 0n }, value });
      }
      case "getBalance":
        return envelope({ context: { slot: 0n }, value: BigInt(svm.getBalance(params[0] as Address) ?? 0n) });
      case "getLatestBlockhash":
        return envelope({ context: { slot: 0n }, value: { blockhash: svm.latestBlockhash(), lastValidBlockHeight: 10_000n } });
      case "getMinimumBalanceForRentExemption": {
        const space = BigInt((params[0] as number) ?? 0);
        const rent = (svm as unknown as { minimumBalanceForRentExemption?: (s: bigint) => bigint }).minimumBalanceForRentExemption;
        // Fallback to the standard rent formula if the binding doesn't expose it.
        const value = typeof rent === "function" ? rent.call(svm, space) : (890_880n + space * 6_960n);
        return envelope(value);
      }
      default:
        throw new Error(
          `kit-plugin-litesvm: RPC method "${method}" is not implemented by the LiteSVM transport. ` +
            `Set up state with the \`svm\` handle directly, or extend liteSvmTransport().`,
        );
    }
  };
}

/**
 * Creates a {@link Connection} (from solana-kite) backed by an in-process LiteSVM, for fast,
 * network-free integration tests of Kit plugins.
 *
 * @param svm - An existing LiteSVM instance (e.g. one you've already loaded programs into). A
 *   fresh instance is created if omitted.
 *
 * @example
 * ```typescript
 * import { connectLiteSvm } from "kit-plugin-litesvm";
 * import { metaplex } from "kit-plugin-metaplex";
 *
 * const { svm, connection } = connectLiteSvm();
 * svm.addProgramFromFile(METADATA_PROGRAM_ID, "fixtures/mpl_token_metadata.so");
 * svm.setAccount(metadataPda, { ...metadataAccount });
 *
 * const client = metaplex()(connection);
 * const tokenMetadata = await client.getMetaplexMetadata(mint);
 * ```
 */
export function connectLiteSvm(svm: LiteSVM = new LiteSVM()): LiteSvmConnection {
  const rpc = createSolanaRpcFromTransport(liteSvmTransport(svm) as never);
  // The connection only touches rpcSubscriptions when sending+confirming; reads don't need it.
  const connection = connect(rpc as never, {} as never);
  return { svm, connection };
}
