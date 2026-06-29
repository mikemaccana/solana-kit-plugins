import type { Address, TransactionSendingSigner, Commitment } from "@solana/kit";
import type { Connection } from "solana-kite";
import type { TokenMetadata, NFTMetadataJson, MetadataCacheEntry } from "./types.js";
import { METADATA_PROGRAM_ID, MetadataSource } from "./constants.js";
import { deserializeMetaplexMetadata } from "./metadata-deserializer.js";
import { getUpdateMetadataAccountV2Instruction } from "../generated/mpl_token_metadata-client/instructions/updateMetadataAccountV2.js";
import type { DataV2Args } from "../generated/mpl_token_metadata-client/types/dataV2.js";

export class MetaplexClient {
  private connection: Connection;
  private cacheTime: number;
  private preferMetaplex: boolean;
  private metadataCache: Map<string, MetadataCacheEntry>;

  constructor(connection: Connection, cacheTime: number = 3600000, preferMetaplex: boolean = true) {
    this.connection = connection;
    this.cacheTime = cacheTime;
    this.preferMetaplex = preferMetaplex;
    this.metadataCache = new Map();
  }

  /**
   * Derives the Metaplex metadata account address for a given mint.
   * Seeds: ["metadata", metaplex_program_id, mint_address]
   */
  private async getMetaplexMetadataAddress(mintAddress: Address): Promise<Address> {
    const { pda } = await this.connection.getPDAAndBump(METADATA_PROGRAM_ID, [
      "metadata",
      METADATA_PROGRAM_ID,
      mintAddress,
    ]);
    return pda;
  }

  /**
   * Attempts to fetch Metaplex Token Metadata for a mint.
   */
  private async fetchMetaplexMetadata(mintAddress: Address): Promise<TokenMetadata | null> {
    try {
      const metadataAddress = await this.getMetaplexMetadataAddress(mintAddress);

      const accountInfo = await this.connection.rpc.getAccountInfo(metadataAddress, { encoding: "base64" }).send();

      if (!accountInfo.value || !accountInfo.value.data) {
        return null;
      }

      let accountData: Uint8Array;
      if (Array.isArray(accountInfo.value.data) && accountInfo.value.data.length === 2) {
        accountData = new Uint8Array(Buffer.from(accountInfo.value.data[0] as string, "base64"));
      } else if (typeof accountInfo.value.data === "string") {
        accountData = new Uint8Array(Buffer.from(accountInfo.value.data, "base64"));
      } else {
        accountData = new Uint8Array(accountInfo.value.data as unknown as ArrayLike<number>);
      }

      const metadata = deserializeMetaplexMetadata(accountData, mintAddress);
      return metadata;
    } catch (error) {
      return null;
    }
  }

  /**
   * Attempts to fetch Token Extensions metadata extension for a mint.
   */
  private async fetchTokenExtensionsMetadata(mintAddress: Address): Promise<TokenMetadata | null> {
    try {
      const metadata = await this.connection.getTokenMetadata(mintAddress);

      if (!metadata) {
        return null;
      }

      const additionalMetadata = metadata.additionalMetadata
        ? new Map(Object.entries(metadata.additionalMetadata))
        : undefined;

      return {
        source: MetadataSource.TOKEN_EXTENSIONS,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        mint: mintAddress,
        additionalMetadata,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Gets token metadata, checking both Metaplex and Token Extensions sources.
   * By default, checks Metaplex first (since it's more common for NFTs),
   * then falls back to Token Extensions if not found.
   */
  async getTokenMetadata(mintAddress: Address, useCache: boolean = true): Promise<TokenMetadata | null> {
    const cacheKey = `metadata:${mintAddress}`;

    if (useCache) {
      const cached = this.metadataCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.metadata;
      }
    }

    let metadata: TokenMetadata | null = null;

    if (this.preferMetaplex) {
      metadata = await this.fetchMetaplexMetadata(mintAddress);
      if (!metadata) {
        metadata = await this.fetchTokenExtensionsMetadata(mintAddress);
      }
    } else {
      metadata = await this.fetchTokenExtensionsMetadata(mintAddress);
      if (!metadata) {
        metadata = await this.fetchMetaplexMetadata(mintAddress);
      }
    }

    if (metadata) {
      this.metadataCache.set(cacheKey, {
        metadata,
        expiresAt: Date.now() + this.cacheTime,
      });
    }

    return metadata;
  }

  /**
   * Gets only Metaplex metadata (does not fall back to Token Extensions).
   */
  async getMetaplexMetadata(mintAddress: Address): Promise<TokenMetadata | null> {
    return this.fetchMetaplexMetadata(mintAddress);
  }

  /**
   * Gets only Token Extensions metadata (does not fall back to Metaplex).
   */
  async getTokenExtensionsMetadata(mintAddress: Address): Promise<TokenMetadata | null> {
    return this.fetchTokenExtensionsMetadata(mintAddress);
  }

  /**
   * Fetches and parses the JSON metadata from a token's URI.
   */
  async fetchMetadataJson(uri: string): Promise<NFTMetadataJson> {
    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      return json as NFTMetadataJson;
    } catch (error) {
      throw new Error(`Failed to fetch metadata JSON from ${uri}: ${(error as Error).message}`);
    }
  }

  /**
   * Gets complete metadata including onchain and offchain data.
   */
  async getCompleteMetadata(
    mintAddress: Address,
  ): Promise<{ onChain: TokenMetadata; offChain: NFTMetadataJson } | null> {
    const onChainMetadata = await this.getTokenMetadata(mintAddress);

    if (!onChainMetadata) {
      return null;
    }

    try {
      const offChainMetadata = await this.fetchMetadataJson(onChainMetadata.uri);

      return {
        onChain: onChainMetadata,
        offChain: offChainMetadata,
      };
    } catch (error) {
      throw new Error(`Failed to get complete metadata: ${(error as Error).message}`);
    }
  }

  /**
   * Gets token metadata for multiple mints in parallel.
   */
  async getBatchTokenMetadata(mintAddresses: Array<Address>): Promise<Map<Address, TokenMetadata | null>> {
    const results = new Map<Address, TokenMetadata | null>();

    const promises = mintAddresses.map(async (mintAddress) => {
      try {
        const metadata = await this.getTokenMetadata(mintAddress);
        results.set(mintAddress, metadata);
      } catch (error) {
        results.set(mintAddress, null);
      }
    });

    await Promise.all(promises);

    return results;
  }

  /**
   * Validates that a URI is accessible and returns valid JSON.
   */
  async validateMetadataUri(uri: string): Promise<boolean> {
    try {
      await this.fetchMetadataJson(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Updates token metadata, intelligently handling both Metaplex and Token Extensions sources.
   * For Token Extensions, delegates to the base updateTokenMetadata function.
   * For Metaplex, uses the Codama-generated UpdateMetadataAccountV2 instruction.
   *
   * NOTE: Metaplex updates replace all metadata fields. This method fetches existing metadata
   * and merges your updates with it. Fields not specified retain their existing values.
   */
  async updateTokenMetadata({
    mintAddress,
    updateAuthority,
    name,
    symbol,
    uri,
    additionalMetadata,
    commitment = "confirmed",
  }: {
    mintAddress: Address;
    updateAuthority: TransactionSendingSigner;
    name?: string;
    symbol?: string;
    uri?: string;
    additionalMetadata?: Record<string, string>;
    commitment?: Commitment;
  }): Promise<string> {
    // First, detect which metadata system this token uses
    const metadata = await this.getTokenMetadata(mintAddress, false);

    if (!metadata) {
      throw new Error(`No metadata found for mint: ${mintAddress}`);
    }

    if (metadata.source === MetadataSource.TOKEN_EXTENSIONS) {
      // Delegate to the base updateTokenMetadata for Token Extensions
      return await this.connection.updateTokenMetadata({
        mintAddress,
        updateAuthority,
        name,
        symbol,
        uri,
        additionalMetadata,
        commitment,
      });
    } else {
      // Metaplex Token Metadata updates using Codama-generated client
      // Metaplex updates replace all fields, so we need to fetch existing data and merge
      const existingMetadata = metadata;

      // Build the DataV2 structure with merged data
      const dataV2: DataV2Args = {
        name: name ?? existingMetadata.name,
        symbol: symbol ?? existingMetadata.symbol,
        uri: uri ?? existingMetadata.uri,
        sellerFeeBasisPoints: existingMetadata.sellerFeeBasisPoints ?? 0,
        creators: existingMetadata.creators ?? null,
        collection: existingMetadata.collection ?? null,
        uses: null,
      };

      // Get the metadata PDA address
      const metadataAddress = await this.getMetaplexMetadataAddress(mintAddress);

      // Create the update instruction
      const updateInstruction = getUpdateMetadataAccountV2Instruction({
        metadata: metadataAddress,
        updateAuthority,
        data: dataV2,
        updateAuthorityArg: null,
        primarySaleHappened: null,
        isMutable: null,
      });

      // Send the transaction
      const signature = await this.connection.sendTransactionFromInstructions({
        feePayer: updateAuthority,
        instructions: [updateInstruction],
        commitment,
      });

      // Clear cache for this mint since metadata changed
      this.metadataCache.delete(`metadata:${mintAddress}`);

      return signature;
    }
  }

  /**
   * Clears the metadata cache.
   */
  clearCache(): void {
    this.metadataCache.clear();
  }

  /**
   * Gets cached metadata if available.
   */
  getCachedMetadata(mintAddress: Address): TokenMetadata | null {
    const cached = this.metadataCache.get(`metadata:${mintAddress}`);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.metadata;
    }
    return null;
  }
}
