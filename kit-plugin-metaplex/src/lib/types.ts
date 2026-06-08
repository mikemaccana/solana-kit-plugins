import type { Address } from "@solana/kit";
import type { MetadataSource } from "./constants.js";

export interface MetaplexConfig {
  cluster?: string;
  cacheTime?: number;
  preferMetaplex?: boolean;
}

export interface TokenMetadata {
  source: MetadataSource;
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints?: number;
  creators?: Array<Creator>;
  collection?: Collection;
  uses?: Uses;
  updateAuthority?: Address;
  mint: Address;
  isMutable?: boolean;
  primarySaleHappened?: boolean;
  additionalMetadata?: Map<string, string>;
}

export interface Creator {
  address: Address;
  verified: boolean;
  share: number;
}

export interface Collection {
  verified: boolean;
  key: Address;
}

export interface Uses {
  useMethod: "Burn" | "Multiple" | "Single";
  remaining: bigint;
  total: bigint;
}

export interface NFTMetadataJson {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  animationUrl?: string;
  externalUrl?: string;
  attributes?: Array<{
    traitType: string;
    value: string | number;
  }>;
  properties?: {
    files?: Array<{
      uri: string;
      type: string;
    }>;
    category?: string;
    creators?: Array<{
      address: string;
      share: number;
    }>;
  };
}

export interface MetadataCacheEntry {
  metadata: TokenMetadata;
  expiresAt: number;
}
