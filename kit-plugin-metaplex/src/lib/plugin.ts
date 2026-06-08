import type { Address, TransactionSendingSigner, Commitment } from "@solana/kit";
import type { Connection } from "solana-kite";
import { MetaplexClient } from "./metaplex-client.js";
import type { MetaplexConfig, TokenMetadata, NFTMetadataJson } from "./types.js";

export interface MetaplexMethods {
  metaplex: MetaplexClient;

  /**
   * Gets token metadata, intelligently checking both Metaplex and Token-2022 sources.
   */
  getTokenMetadata: (mintAddress: Address, useCache?: boolean) => Promise<TokenMetadata | null>;

  /**
   * Gets only Metaplex metadata (does not fall back to Token-2022).
   */
  getMetaplexMetadata: (mintAddress: Address) => Promise<TokenMetadata | null>;

  /**
   * Gets only Token-2022 metadata (does not fall back to Metaplex).
   */
  getToken2022Metadata: (mintAddress: Address) => Promise<TokenMetadata | null>;

  /**
   * Fetches the off-chain JSON metadata from a URI.
   */
  fetchMetadataJson: (uri: string) => Promise<NFTMetadataJson>;

  /**
   * Gets complete metadata including on-chain and off-chain data.
   */
  getCompleteMetadata: (
    mintAddress: Address,
  ) => Promise<{ onChain: TokenMetadata; offChain: NFTMetadataJson } | null>;

  /**
   * Gets token metadata for multiple mints in parallel.
   */
  getBatchTokenMetadata: (mintAddresses: Array<Address>) => Promise<Map<Address, TokenMetadata | null>>;

  /**
   * Validates that a metadata URI is accessible and valid.
   */
  validateMetadataUri: (uri: string) => Promise<boolean>;

  /**
   * Updates token metadata, intelligently handling both Metaplex and Token-2022 sources.
   * For Token-2022, updates the metadata using the Token-2022 program.
   * For Metaplex, updates using the Codama-generated Metaplex Token Metadata client.
   */
  updateTokenMetadata: (params: {
    mintAddress: Address;
    updateAuthority: TransactionSendingSigner;
    name?: string;
    symbol?: string;
    uri?: string;
    additionalMetadata?: Record<string, string>;
    commitment?: Commitment;
  }) => Promise<string>;
}

export type ConnectionWithMetaplex = Connection & MetaplexMethods;

/**
 * Creates a Metaplex token metadata plugin for Solana Kite.
 *
 * This plugin intelligently handles both Metaplex Token Metadata and Token-2022
 * metadata extension, checking which one exists and returning the appropriate metadata.
 *
 * @param config - Configuration options
 * @param config.cluster - Cluster to use (default: inherits from connection)
 * @param config.cacheTime - Cache duration in milliseconds (default: 3600000 = 1 hour)
 * @param config.preferMetaplex - Check Metaplex first before Token-2022 (default: true)
 * @returns A plugin function that extends connections with Metaplex functionality
 *
 * @example
 * ```typescript
 * import { connect } from "solana-kite";
 * import { createKiteMetaplexPlugin } from "solana-kite-metaplex";
 *
 * const client = connect("mainnet-beta").use(createKiteMetaplexPlugin());
 *
 * // Automatically checks both Metaplex and Token-2022
 * const metadata = await client.getTokenMetadata(mintAddress);
 * console.log(`Source: ${metadata.source}`); // "metaplex" or "token-2022"
 * console.log(`Token: ${metadata.name} (${metadata.symbol})`);
 *
 * // Metaplex-specific fields (only present if source is "metaplex")
 * if (metadata.creators) {
 *   console.log("Creators:", metadata.creators);
 * }
 * if (metadata.collection) {
 *   console.log("Collection:", metadata.collection.key);
 * }
 *
 * // Get complete metadata including off-chain data
 * const complete = await client.getCompleteMetadata(mintAddress);
 * if (complete) {
 *   console.log(`Name: ${complete.onChain.name}`);
 *   console.log(`Description: ${complete.offChain.description}`);
 *   console.log(`Image: ${complete.offChain.image}`);
 * }
 *
 * // Get metadata for multiple tokens
 * const metadataMap = await client.getBatchTokenMetadata([mint1, mint2, mint3]);
 * for (const [mint, metadata] of metadataMap) {
 *   if (metadata) {
 *     console.log(`${mint}: ${metadata.name} (source: ${metadata.source})`);
 *   }
 * }
 *
 * // Get only Metaplex metadata (no fallback)
 * const metaplexOnly = await client.getMetaplexMetadata(mintAddress);
 *
 * // Get only Token-2022 metadata (no fallback)
 * const token2022Only = await client.getToken2022Metadata(mintAddress);
 * ```
 */
export const createKiteMetaplexPlugin = (config: MetaplexConfig = {}) => {
  return <T extends Connection>(connection: T): T & MetaplexMethods => {
    const metaplexClient = new MetaplexClient(connection, config.cacheTime, config.preferMetaplex);

    const getTokenMetadata = async (
      mintAddress: Address,
      useCache: boolean = true,
    ): Promise<TokenMetadata | null> => {
      return metaplexClient.getTokenMetadata(mintAddress, useCache);
    };

    const getMetaplexMetadata = async (mintAddress: Address): Promise<TokenMetadata | null> => {
      return metaplexClient.getMetaplexMetadata(mintAddress);
    };

    const getToken2022Metadata = async (mintAddress: Address): Promise<TokenMetadata | null> => {
      return metaplexClient.getToken2022Metadata(mintAddress);
    };

    const fetchMetadataJson = async (uri: string): Promise<NFTMetadataJson> => {
      return metaplexClient.fetchMetadataJson(uri);
    };

    const getCompleteMetadata = async (
      mintAddress: Address,
    ): Promise<{ onChain: TokenMetadata; offChain: NFTMetadataJson } | null> => {
      return metaplexClient.getCompleteMetadata(mintAddress);
    };

    const getBatchTokenMetadata = async (
      mintAddresses: Array<Address>,
    ): Promise<Map<Address, TokenMetadata | null>> => {
      return metaplexClient.getBatchTokenMetadata(mintAddresses);
    };

    const validateMetadataUri = async (uri: string): Promise<boolean> => {
      return metaplexClient.validateMetadataUri(uri);
    };

    const updateTokenMetadata = async (params: {
      mintAddress: Address;
      updateAuthority: TransactionSendingSigner;
      name?: string;
      symbol?: string;
      uri?: string;
      additionalMetadata?: Record<string, string>;
      commitment?: Commitment;
    }): Promise<string> => {
      return metaplexClient.updateTokenMetadata(params);
    };

    return {
      ...connection,
      metaplex: metaplexClient,
      getTokenMetadata,
      getMetaplexMetadata,
      getToken2022Metadata,
      fetchMetadataJson,
      getCompleteMetadata,
      getBatchTokenMetadata,
      validateMetadataUri,
      updateTokenMetadata,
    };
  };
};
