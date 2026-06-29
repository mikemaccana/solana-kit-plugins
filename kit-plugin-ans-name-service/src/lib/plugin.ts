import { extendClient } from "@solana/kit";
import type { Address, TransactionSendingSigner, Commitment } from "@solana/kit";
import type { Connection } from "solana-kite";
import { ANSClient } from "./ans.js";
import type { ANSConfig } from "./types.js";

export interface ANSMethods {
  ans: ANSClient;
  getAddressForANSName: (nameOrAddress: string) => Promise<Address>;
  getANSNamesForAddress: (resolvedAddress: Address) => Promise<Array<string>>;
}

export type ConnectionWithANS = Connection & ANSMethods;

// Token account shape returned by solana-kite's getTokenAccounts.
type TokenAccount = Awaited<ReturnType<Connection["getTokenAccounts"]>>[number];

// Portfolio summary returned by the Jupiter pricing plugin (mirrors its PortfolioBreakdown).
interface PortfolioToken {
  mint: Address;
  symbol: string;
  balance: bigint;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
}

interface PortfolioBreakdown {
  tokens: Array<PortfolioToken>;
  totalValueUsd: number;
  tokenCount: number;
  tokensWithoutPrice: number;
  fetchedAt: number;
}

interface PortfolioWatchCallback {
  (error: Error | null, value: number | null): void;
}

type TransferTokensParams = {
  sender: TransactionSendingSigner;
  destination: Address | string;
  mintAddress: Address;
  amount: bigint;
  maximumClientSideRetries?: number;
  abortSignal?: AbortSignal | null;
  useTokenExtensions?: boolean;
};

// Optional methods that other plugins (e.g. transferSol from kite, portfolio
// methods from kit-plugin-jupiter-pricing) may have added to the connection.
interface OptionalEnhancedMethods {
  transferTokens: (params: TransferTokensParams) => Promise<string>;
  transferSol: (params: {
    sender: TransactionSendingSigner;
    destination: Address;
    lamports: bigint;
    maximumClientSideRetries?: number;
    abortSignal?: AbortSignal | null;
  }) => Promise<string>;
  getPortfolioValue: (address: Address) => Promise<number>;
  getPortfolioBreakdown: (address: Address) => Promise<PortfolioBreakdown>;
  getTopHoldings: (address: Address, limit: number) => Promise<Array<PortfolioToken>>;
  watchPortfolioValue: (
    address: Address,
    callback: PortfolioWatchCallback,
    intervalMs?: number,
  ) => () => void;
}

export const ans = (config: ANSConfig = {}) => {
  return <T extends Connection>(connection: T) => {
    const ansClient = new ANSClient(config.cacheTime, config.cluster);

    const getAddressForANSName = async (nameOrAddress: string): Promise<Address> => {
      return ansClient.getAddressForANSName(nameOrAddress);
    };

    const getANSNamesForAddress = async (resolvedAddress: Address): Promise<Array<string>> => {
      return ansClient.getANSNamesForAddress(resolvedAddress);
    };

    // Methods possibly added by other plugins are not on the base Connection type.
    const optional = connection as T & Partial<OptionalEnhancedMethods>;

    const enhancedGetLamportBalance = async (
      addressOrName: Address | string,
      commitment?: Commitment,
    ): Promise<bigint> => {
      const resolvedAddress = await ansClient.getAddressForANSName(String(addressOrName));
      return connection.getLamportBalance(resolvedAddress, commitment);
    };

    const enhancedGetTokenAccounts = async (
      addressOrName: Address | string,
      includeZeroBalances?: boolean,
    ): Promise<Array<TokenAccount>> => {
      const resolvedAddress = await ansClient.getAddressForANSName(String(addressOrName));
      return connection.getTokenAccounts(resolvedAddress, includeZeroBalances);
    };

    const originalTransferTokens = optional.transferTokens;
    const enhancedTransferTokens = originalTransferTokens
      ? async (params: TransferTokensParams): Promise<string> => {
          const resolvedDestination = await ansClient.getAddressForANSName(String(params.destination));
          return originalTransferTokens({
            ...params,
            destination: resolvedDestination,
          });
        }
      : undefined;

    const originalTransferSol = optional.transferSol;
    const enhancedTransferSol = originalTransferSol
      ? async (params: {
          sender: TransactionSendingSigner;
          destination: Address | string;
          lamports: bigint;
          maximumClientSideRetries?: number;
          abortSignal?: AbortSignal | null;
        }): Promise<string> => {
          const resolvedDestination = await ansClient.getAddressForANSName(String(params.destination));
          return originalTransferSol({
            ...params,
            destination: resolvedDestination,
          });
        }
      : undefined;

    const originalGetPortfolioValue = optional.getPortfolioValue;
    const enhancedGetPortfolioValue = originalGetPortfolioValue
      ? async (addressOrName: Address | string): Promise<number> => {
          const resolvedAddress = await ansClient.getAddressForANSName(String(addressOrName));
          return originalGetPortfolioValue(resolvedAddress);
        }
      : undefined;

    const originalGetPortfolioBreakdown = optional.getPortfolioBreakdown;
    const enhancedGetPortfolioBreakdown = originalGetPortfolioBreakdown
      ? async (addressOrName: Address | string): Promise<PortfolioBreakdown> => {
          const resolvedAddress = await ansClient.getAddressForANSName(String(addressOrName));
          return originalGetPortfolioBreakdown(resolvedAddress);
        }
      : undefined;

    const originalGetTopHoldings = optional.getTopHoldings;
    const enhancedGetTopHoldings = originalGetTopHoldings
      ? async (addressOrName: Address | string, limit: number): Promise<Array<PortfolioToken>> => {
          const resolvedAddress = await ansClient.getAddressForANSName(String(addressOrName));
          return originalGetTopHoldings(resolvedAddress, limit);
        }
      : undefined;

    const originalWatchPortfolioValue = optional.watchPortfolioValue;
    const enhancedWatchPortfolioValue = originalWatchPortfolioValue
      ? async (
          addressOrName: Address | string,
          callback: PortfolioWatchCallback,
          intervalMs?: number,
        ): Promise<() => void> => {
          const resolvedAddress = await ansClient.getAddressForANSName(String(addressOrName));
          return originalWatchPortfolioValue(resolvedAddress, callback, intervalMs);
        }
      : undefined;

    return extendClient(connection, {
      ans: ansClient,
      getAddressForANSName,
      getANSNamesForAddress,
      getLamportBalance: enhancedGetLamportBalance,
      getTokenAccounts: enhancedGetTokenAccounts,
      ...(enhancedTransferTokens && { transferTokens: enhancedTransferTokens }),
      ...(enhancedTransferSol && { transferSol: enhancedTransferSol }),
      ...(enhancedGetPortfolioValue && { getPortfolioValue: enhancedGetPortfolioValue }),
      ...(enhancedGetPortfolioBreakdown && { getPortfolioBreakdown: enhancedGetPortfolioBreakdown }),
      ...(enhancedGetTopHoldings && { getTopHoldings: enhancedGetTopHoldings }),
      ...(enhancedWatchPortfolioValue && { watchPortfolioValue: enhancedWatchPortfolioValue }),
    });
  };
};

