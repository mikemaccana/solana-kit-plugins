import type { Address, TransactionSendingSigner } from "@solana/kit";
import type { Connection } from "solana-kite";
import { SOL } from "solana-kite";
import { JupiterClient } from "./jupiter.js";
import { WRAPPED_SOL_MINT } from "./constants.js";
import type {
  KitePricingConfig,
  TokenPriceInfo,
  PortfolioBreakdown,
  PortfolioToken,
  PriceWatchCallback,
  PortfolioWatchCallback,
} from "./types.js";
import { formatUsdValue, tokenAmountToUiAmount, uiAmountToTokenAmount, ensureError } from "./utils.js";

type EnhancedTransferTokensParams = {
  sender: TransactionSendingSigner;
  destination: Address;
  token: Address | string;
  maximumClientSideRetries?: number;
  abortSignal?: AbortSignal | null;
  useTokenExtensions?: boolean;
} & (
  | { amount: bigint; usdValue?: never }
  | { usdValue: number; amount?: never }
);

export interface PricingMethods {
  jupiter: JupiterClient;
  getTokenPrice: (mint: Address) => Promise<TokenPriceInfo | null>;
  getTokenPrices: (mints: Array<Address>) => Promise<Map<string, TokenPriceInfo>>;
  getTokenValueInUsd: (mint: Address, amount: bigint, decimals: number) => Promise<number | null>;
  getPortfolioValue: (address: Address) => Promise<number>;
  getPortfolioBreakdown: (address: Address) => Promise<PortfolioBreakdown>;
  getTopHoldings: (address: Address, limit: number) => Promise<Array<PortfolioToken>>;
  convertBetweenTokens: (fromMint: Address, toMint: Address, amount: bigint, decimals: number) => Promise<bigint | null>;
  transferTokens: (params: EnhancedTransferTokensParams) => Promise<string>;
  formatUsdValue: (value: number) => string;
  watchPortfolioValue: (address: Address, callback: PortfolioWatchCallback, intervalMs?: number) => () => void;
  watchTokenPrice: (mint: Address, callback: PriceWatchCallback, intervalMs?: number) => () => void;
}

export type ConnectionWithPricing = Connection & PricingMethods;

export const createKitePricingPlugin = (config: KitePricingConfig = {}) => {
  return <T extends Connection>(connection: T): T & PricingMethods => {
    const jupiter = new JupiterClient(config.jupiterApiKey, config.cacheTimeMs, config.vsToken);

    const getTokenPrice = async (mint: Address): Promise<TokenPriceInfo | null> => {
      return jupiter.getTokenPrice(mint);
    };

    const getTokenPrices = async (mints: Array<Address>): Promise<Map<string, TokenPriceInfo>> => {
      return jupiter.getTokenPrices(mints);
    };

    const getTokenValueInUsd = async (
      mint: Address,
      amount: bigint,
      decimals: number,
    ): Promise<number | null> => {
      const priceInfo = await jupiter.getTokenPrice(mint);
      if (!priceInfo) {
        return null;
      }

      const uiAmount = tokenAmountToUiAmount(amount, decimals);
      return uiAmount * priceInfo.priceUsd;
    };

    const getPortfolioValue = async (address: Address): Promise<number> => {
      const breakdown = await getPortfolioBreakdown(address);
      return breakdown.totalValueUsd;
    };

    const getPortfolioBreakdown = async (address: Address): Promise<PortfolioBreakdown> => {
      const solBalance = await connection.getLamportBalance(address, "confirmed");

      const rawTokenAccounts = await connection.getTokenAccounts(address, true);

      const tokenAccountsWithBalance = rawTokenAccounts.map((accountInfo: any) => {
        const parsedInfo = accountInfo.account.data.parsed.info;
        return {
          mint: parsedInfo.mint,
          amount: BigInt(parsedInfo.tokenAmount.amount),
          decimals: parsedInfo.tokenAmount.decimals,
        };
      });

      const allMintAddresses = [WRAPPED_SOL_MINT, ...tokenAccountsWithBalance.map((account) => account.mint)];

      const priceMap = await jupiter.getTokenPrices(allMintAddresses);

      const tokens: Array<PortfolioToken> = [];
      let totalValueUsd = 0;
      let tokensWithoutPrice = 0;

      const solPriceInfo = priceMap.get(WRAPPED_SOL_MINT);
      if (solPriceInfo && solBalance > 0n) {
        const solValueUsd = (Number(solBalance) / Number(SOL)) * solPriceInfo.priceUsd;
        totalValueUsd += solValueUsd;
        tokens.push({
          mint: WRAPPED_SOL_MINT as Address,
          symbol: "SOL",
          balance: solBalance,
          decimals: 9,
          priceUsd: solPriceInfo.priceUsd,
          valueUsd: solValueUsd,
        });
      }

      for (const tokenAccount of tokenAccountsWithBalance) {
        const priceInfo = priceMap.get(tokenAccount.mint);

        if (!priceInfo) {
          tokensWithoutPrice++;
          continue;
        }

        const balanceInUiUnits = tokenAmountToUiAmount(tokenAccount.amount, tokenAccount.decimals);
        const valueUsd = balanceInUiUnits * priceInfo.priceUsd;
        totalValueUsd += valueUsd;

        tokens.push({
          mint: tokenAccount.mint as Address,
          symbol: priceInfo.symbol,
          balance: tokenAccount.amount,
          decimals: tokenAccount.decimals,
          priceUsd: priceInfo.priceUsd,
          valueUsd: valueUsd,
        });
      }

      tokens.sort((a, b) => b.valueUsd - a.valueUsd);

      return {
        tokens,
        totalValueUsd,
        tokenCount: tokens.length,
        tokensWithoutPrice,
        fetchedAt: Date.now(),
      };
    };

    const getTopHoldings = async (address: Address, limit: number): Promise<Array<PortfolioToken>> => {
      const breakdown = await getPortfolioBreakdown(address);
      return breakdown.tokens.slice(0, limit);
    };

    const convertBetweenTokens = async (
      fromMint: Address,
      toMint: Address,
      amount: bigint,
      decimals: number,
    ): Promise<bigint | null> => {
      const prices = await jupiter.getTokenPrices([fromMint, toMint]);

      const fromMintString = String(fromMint);
      const toMintString = String(toMint);

      const fromPrice = prices.get(fromMintString);
      const toPrice = prices.get(toMintString);

      if (!fromPrice || !toPrice) {
        return null;
      }

      const fromUiAmount = tokenAmountToUiAmount(amount, decimals);
      const valueInUsd = fromUiAmount * fromPrice.priceUsd;
      const toUiAmount = valueInUsd / toPrice.priceUsd;

      return uiAmountToTokenAmount(toUiAmount, decimals);
    };

    const originalTransferTokens = connection.transferTokens;

    const enhancedTransferTokens = async (params: EnhancedTransferTokensParams): Promise<string> => {
      const { sender, destination, token, maximumClientSideRetries, abortSignal, useTokenExtensions } = params;

      let mintAddress: string = String(token);

      if (typeof token === "string" && token.length <= 10) {
        const resolved = await jupiter.resolveTokenSymbol(token);
        if (!resolved) {
          throw new Error(
            `Could not resolve token symbol "${token}". Please use the full mint address or check the symbol is correct.`,
          );
        }
        mintAddress = resolved;
      }

      let amount: bigint;

      if ("usdValue" in params && params.usdValue !== undefined) {
        const priceInfo = await jupiter.getTokenPrice(mintAddress);
        if (!priceInfo) {
          throw new Error(`Could not fetch price for token ${token}`);
        }

        const mint = await connection.getMint(mintAddress as Address, "confirmed");
        if (!mint) {
          throw new Error(`Could not fetch mint info for ${token}`);
        }

        const tokenAmount = params.usdValue / priceInfo.priceUsd;
        amount = uiAmountToTokenAmount(tokenAmount, mint.data.decimals);
      } else {
        amount = params.amount;
      }

      return originalTransferTokens({
        sender,
        destination,
        mintAddress: mintAddress as Address,
        amount,
        maximumClientSideRetries,
        abortSignal,
        useTokenExtensions,
      });
    };

    const watchPortfolioValue = (
      address: Address,
      callback: PortfolioWatchCallback,
      intervalMs: number = 60000,
    ): (() => void) => {
      let intervalId: NodeJS.Timeout | null = null;

      const poll = async () => {
        try {
          const value = await getPortfolioValue(address);
          callback(null, value);
        } catch (thrownObject) {
          const error = ensureError(thrownObject);
          callback(error, null);
        }
      };

      poll();

      intervalId = setInterval(poll, intervalMs);

      return () => {
        if (intervalId !== null) {
          clearInterval(intervalId);
        }
      };
    };

    const watchTokenPrice = (
      mint: Address,
      callback: PriceWatchCallback,
      intervalMs: number = 60000,
    ): (() => void) => {
      let intervalId: NodeJS.Timeout | null = null;

      const poll = async () => {
        try {
          const priceInfo = await jupiter.getTokenPrice(mint);
          if (priceInfo) {
            callback(null, priceInfo.priceUsd);
          } else {
            callback(new Error(`Price not found for ${mint}`), null);
          }
        } catch (thrownObject) {
          const error = ensureError(thrownObject);
          callback(error, null);
        }
      };

      poll();

      intervalId = setInterval(poll, intervalMs);

      return () => {
        if (intervalId !== null) {
          clearInterval(intervalId);
        }
      };
    };

    return {
      ...connection,
      jupiter,
      getTokenPrice,
      getTokenPrices,
      getTokenValueInUsd,
      getPortfolioValue,
      getPortfolioBreakdown,
      getTopHoldings,
      convertBetweenTokens,
      transferTokens: enhancedTransferTokens,
      formatUsdValue,
      watchPortfolioValue,
      watchTokenPrice,
    };
  };
};
