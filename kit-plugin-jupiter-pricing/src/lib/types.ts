import type { Address } from "@solana/kit";

export interface JupiterPriceData {
  createdAt: string;
  liquidity: number;
  usdPrice: number;
  blockId: number;
  decimals: number;
  priceChange24h: number;
}

export type JupiterPriceResponse = Record<string, JupiterPriceData>;

export interface JupiterTokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: Array<string>;
  daily_volume?: number;
}

export interface TokenPriceInfo {
  mint: Address;
  symbol: string;
  priceUsd: number;
  fetchedAt: number;
}

export interface PortfolioToken {
  mint: Address;
  symbol: string;
  balance: bigint;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
}

export interface PortfolioBreakdown {
  tokens: Array<PortfolioToken>;
  totalValueUsd: number;
  tokenCount: number;
  tokensWithoutPrice: number;
  fetchedAt: number;
}

export interface PriceWatchCallback {
  (error: Error | null, price: number | null): void;
}

export interface PortfolioWatchCallback {
  (error: Error | null, value: number | null): void;
}

export interface JupiterPricingConfig {
  jupiterApiKey?: string;
  cacheTimeMs?: number;
  vsToken?: string;
}
