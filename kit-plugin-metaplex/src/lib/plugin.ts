import { extendClient } from "@solana/kit";
import type { Address, TransactionSendingSigner, Commitment } from "@solana/kit";
import type { Connection } from "solana-kite";
import { MetaplexClient } from "./metaplex-client.js";
import type { MetaplexConfig, TokenMetadata, NFTMetadataJson } from "./types.js";

export interface MetaplexMethods {
  metaplex: MetaplexClient;

  /**
   * Gets token metadata, intelligently checking both Metaplex and Token Extensions sources.
   */
  getTokenMetadata: (mintAddress: Address, useCache?: boolean) => Promise<TokenMetadata | null>;

  /**
   * Gets only Metaplex metadata (does not fall back to Token Extensions).
   */
  getMetaplexMetadata: (mintAddress: Address) => Promise<TokenMetadata | null>;

  /**
   * Gets only Token Extensions metadata (does not fall back to Metaplex).
   */
  getTokenExtensionsMetadata: (mintAddress: Address) => Promise<TokenMetadata | null>;

  /**
   * Fetches the offchain JSON metadata from a URI.
   */
  fetchMetadataJson: (uri: string) => Promise<NFTMetadataJson>;

  /**
   * Gets complete metadata including onchain and offchain data.
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
   * Updates token metadata, intelligently handling both Metaplex and Token Extensions sources.
   * For Token Extensions, updates the metadata using the Token Extensions program.
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
 * Creates a Metaplex token metadata plugin for Solana Kit.
 *
 * This plugin intelligently handles both Metaplex Token Metadata and Token Extensions
 * metadata extension, checking which one exists and returning the appropriate metadata.
 *
 * @param config - Configuration options
 * @param config.cluster - Cluster to use (default: inherits from connection)
 * @param config.cacheTime - Cache duration in milliseconds (default: 3600000 = 1 hour)
 * @param config.preferMetaplex - Check Metaplex first before Token Extensions (default: true)
 * @returns A plugin function that extends connections with Metaplex functionality
 *
 * @example
 * ```typescript
 * import { createClient } from "@solana/kit";
 * import { kite } from "kit-plugin-kite";
 * import { metaplex } from "kit-plugin-metaplex";
 *
 * const client = createClient()
 *   .use(kite({ clusterNameOrURL: "mainnet" }))
 *   .use(metaplex());
 *
 * // Automatically checks both Metaplex and Token Extensions
 * const metadata = await client.getTokenMetadata(mintAddress);
 * console.log(`Source: ${metadata.source}`); // "metaplex" or "token-extensions"
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
 * // Get complete metadata including offchain data
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
 * // Get only Token Extensions metadata (no fallback)
 * const tokenExtensionsOnly = await client.getTokenExtensionsMetadata(mintAddress);
 * ```
 */
export const metaplex = (config: MetaplexConfig = {}) => {
  return <T extends Connection>(connection: T) => {
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

    const getTokenExtensionsMetadata = async (mintAddress: Address): Promise<TokenMetadata | null> => {
      return metaplexClient.getTokenExtensionsMetadata(mintAddress);
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

    return extendClient(connection, {
      metaplex: metaplexClient,
      getTokenMetadata,
      getMetaplexMetadata,
      getTokenExtensionsMetadata,
      fetchMetadataJson,
      getCompleteMetadata,
      getBatchTokenMetadata,
      validateMetadataUri,
      updateTokenMetadata,
    });
  };
};

