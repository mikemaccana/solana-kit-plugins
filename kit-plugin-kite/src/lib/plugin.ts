import { extendClient } from "@solana/kit";
import { connect, type Connection } from "solana-kite";

/**
 * Configuration for the {@link kite} plugin.
 */
export interface KitePluginConfig {
  /**
   * Cluster name (e.g. "mainnet", "devnet", "testnet", "localnet",
   * "quicknode-mainnet", "helius-devnet", ...) or an HTTP RPC URL.
   *
   * Defaults to "localnet".
   */
  clusterNameOrURL?: string;
  /**
   * WebSocket URL for subscriptions. Auto-derived from the cluster/HTTP URL
   * when omitted, but required when `clusterNameOrURL` is a custom HTTP URL.
   */
  webSocketURL?: string;
}

/**
 * A Kit client that has had the {@link kite} plugin applied. It exposes the
 * full Solana Kite {@link Connection} surface (wallets, token operations,
 * transaction helpers, PDA helpers, explorer links, balance watchers, ...).
 */
export type ClientWithKite = Connection;

/**
 * Solana Kit plugin that adds Solana Kite's high-level helpers to a Kit client.
 *
 * Kite runs on top of Kit and provides ergonomic helpers — `sendTransactionFromInstructions`,
 * token mint/transfer/burn, metadata, PDA derivation, balance watchers and more — that the
 * lower-level `@solana/kit` primitives leave to the caller. Exposing Kite as a Kit plugin lets
 * those helpers compose in a standard `createClient().use(...)` chain, and lets the
 * capability-specific plugins (Arcium, Pyth, Metaplex, TukTuk, ...) build on top of it.
 *
 * The plugin establishes the RPC and RPC-subscriptions transports from the supplied cluster
 * configuration, so it is typically the first plugin in the chain.
 *
 * @param config - Cluster/transport configuration. Defaults to localnet.
 * @returns A Kit `ClientPlugin` that extends the client with the Kite connection.
 *
 * @example
 * ```typescript
 * import { createClient } from "@solana/kit";
 * import { kite } from "kit-plugin-kite";
 * import { metaplex } from "kit-plugin-metaplex";
 *
 * const client = createClient()
 *   .use(kite({ clusterNameOrURL: "devnet" }))
 *   .use(metaplex());
 *
 * const balance = await client.getLamportBalance(someAddress);
 * const metadata = await client.getTokenMetadata(someMint);
 * ```
 */
export function kite(config: KitePluginConfig = {}) {
  return <T extends object>(client: T) => {
    const connection = connect(config.clusterNameOrURL, config.webSocketURL ?? null);
    return extendClient(client, connection);
  };
}
