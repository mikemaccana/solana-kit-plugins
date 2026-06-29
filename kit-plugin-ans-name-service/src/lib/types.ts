import type { Address } from "@solana/kit";

export interface ANSConfig {
  cacheTime?: number;
  cluster?: string;
}

export interface ANSCacheEntry {
  address: Address;
  expiresAt: number;
}
