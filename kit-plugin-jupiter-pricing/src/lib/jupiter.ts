import type { Address } from "@solana/kit";
import {
  JUPITER_PRICE_API_V3,
  JUPITER_TOKEN_SEARCH_API,
  JUPITER_STRICT_TOKEN_LIST_API,
  DEFAULT_CACHE_TIME_MS,
  DEFAULT_VS_TOKEN,
} from "./constants.js";
import type { JupiterPriceResponse, JupiterTokenInfo, TokenPriceInfo } from "./types.js";
import { ensureError } from "./utils.js";

interface PriceCacheEntry {
  price: TokenPriceInfo;
  expiresAt: number;
}

export class JupiterClient {
  private apiKey?: string;
  private cacheTimeMs: number;
  private vsToken: string;
  private priceCache: Map<string, PriceCacheEntry>;
  private symbolCache: Map<string, string>;
  private symbolToMintCache: Map<string, string>;
  private tokenListCache: Array<JupiterTokenInfo> | null;
  private tokenListCacheExpiry: number;

  constructor(apiKey?: string, cacheTimeMs: number = DEFAULT_CACHE_TIME_MS, vsToken: string = DEFAULT_VS_TOKEN) {
    this.apiKey = apiKey;
    this.cacheTimeMs = cacheTimeMs;
    this.vsToken = vsToken;
    this.priceCache = new Map();
    this.symbolCache = new Map();
    this.symbolToMintCache = new Map();
    this.tokenListCache = null;
    this.tokenListCacheExpiry = 0;
  }

  private getHeaders(): Record<string, string> {
    if (this.apiKey) {
      return {
        "x-api-key": this.apiKey,
      };
    }
    return {};
  }

  private getCachedPrice(mint: string): TokenPriceInfo | null {
    const cached = this.priceCache.get(mint);
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.priceCache.delete(mint);
      return null;
    }

    return cached.price;
  }

  private setCachedPrice(mint: string, price: TokenPriceInfo): void {
    this.priceCache.set(mint, {
      price,
      expiresAt: Date.now() + this.cacheTimeMs,
    });
  }

  async getTokenSymbol(mint: Address | string): Promise<string> {
    const mintString = String(mint);

    const cached = this.symbolCache.get(mintString);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${JUPITER_TOKEN_SEARCH_API}?query=${mintString}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return mintString.substring(0, 8);
      }

      const data = (await response.json()) as Array<JupiterTokenInfo>;
      if (Array.isArray(data) && data.length > 0) {
        const symbol = data[0].symbol;
        this.symbolCache.set(mintString, symbol);
        return symbol;
      }

      return mintString.substring(0, 8);
    } catch (thrownObject) {
      const error = ensureError(thrownObject);
      console.warn(`Failed to fetch symbol for ${mintString}: ${error.message}`);
      return mintString.substring(0, 8);
    }
  }

  async getTokenPrice(mint: Address | string): Promise<TokenPriceInfo | null> {
    const mintString = String(mint);

    const cached = this.getCachedPrice(mintString);
    if (cached) {
      return cached;
    }

    const prices = await this.getTokenPrices([mint]);
    return prices.get(mintString) || null;
  }

  async getTokenPrices(mints: Array<Address | string>): Promise<Map<string, TokenPriceInfo>> {
    const result = new Map<string, TokenPriceInfo>();
    const mintsToFetch: Array<string> = [];

    for (const mint of mints) {
      const mintString = String(mint);
      const cached = this.getCachedPrice(mintString);
      if (cached) {
        result.set(mintString, cached);
      } else {
        mintsToFetch.push(mintString);
      }
    }

    if (mintsToFetch.length === 0) {
      return result;
    }

    try {
      const idsParam = mintsToFetch.join(",");
      const url = `${JUPITER_PRICE_API_V3}?ids=${idsParam}&vsToken=${this.vsToken}`;

      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.warn(`Failed to fetch prices from Jupiter: ${response.status}`);
        return result;
      }

      const jupiterResponse = (await response.json()) as JupiterPriceResponse;
      const fetchedAt = Date.now();

      for (const mint of mintsToFetch) {
        const priceData = jupiterResponse[mint];
        if (priceData && priceData.usdPrice) {
          const symbol = await this.getTokenSymbol(mint);
          const priceInfo: TokenPriceInfo = {
            mint: mint as Address,
            symbol,
            priceUsd: priceData.usdPrice,
            fetchedAt,
          };

          this.setCachedPrice(mint, priceInfo);
          result.set(mint, priceInfo);
        }
      }

      return result;
    } catch (thrownObject) {
      const error = ensureError(thrownObject);
      console.warn(`Error fetching prices from Jupiter: ${error.message}`);
      return result;
    }
  }

  async getStrictTokenList(): Promise<Array<JupiterTokenInfo>> {
    if (this.tokenListCache && Date.now() < this.tokenListCacheExpiry) {
      return this.tokenListCache;
    }

    try {
      const response = await fetch(JUPITER_STRICT_TOKEN_LIST_API, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.warn(`Failed to fetch token list from Jupiter: ${response.status}`);
        return [];
      }

      const tokens = (await response.json()) as Array<JupiterTokenInfo>;
      this.tokenListCache = tokens;
      this.tokenListCacheExpiry = Date.now() + this.cacheTimeMs * 10;

      for (const token of tokens) {
        this.symbolToMintCache.set(token.symbol.toUpperCase(), token.address);
      }

      return tokens;
    } catch (thrownObject) {
      const error = ensureError(thrownObject);
      console.warn(`Error fetching token list from Jupiter: ${error.message}`);
      return [];
    }
  }

  async resolveTokenSymbol(symbolOrMint: string): Promise<string | null> {
    const upperSymbol = symbolOrMint.toUpperCase();

    const cached = this.symbolToMintCache.get(upperSymbol);
    if (cached) {
      return cached;
    }

    if (symbolOrMint.length > 32) {
      return symbolOrMint;
    }

    await this.getStrictTokenList();

    const resolved = this.symbolToMintCache.get(upperSymbol);
    return resolved || null;
  }

  clearCache(): void {
    this.priceCache.clear();
    this.symbolCache.clear();
    this.symbolToMintCache.clear();
    this.tokenListCache = null;
    this.tokenListCacheExpiry = 0;
  }
}
