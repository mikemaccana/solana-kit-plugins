import { extendClient } from "@solana/kit";
import type { Address, TransactionSendingSigner } from "@solana/kit";
import type { Connection } from "solana-kite";
import { ANSClient } from "./ans.js";
import type { ANSConfig } from "./types.js";

export interface ANSMethods {
  ans: ANSClient;
  getAddressForANSName: (nameOrAddress: string) => Promise<Address>;
  getANSNamesForAddress: (resolvedAddress: Address) => Promise<Array<string>>;
}

export type ConnectionWithANS = Connection & ANSMethods;

export const ansNameService = (config: ANSConfig = {}) => {
  return <T extends Connection>(connection: T) => {
    const ansClient = new ANSClient(config.cacheTime, config.cluster);

    const getAddressForANSName = async (nameOrAddress: string): Promise<Address> => {
      return ansClient.getAddressForANSName(nameOrAddress);
    };

    const getANSNamesForAddress = async (resolvedAddress: Address): Promise<Array<string>> => {
      return ansClient.getANSNamesForAddress(resolvedAddress);
    };

    const enhancedGetLamportBalance = async (
      addressOrName: Address | string,
      commitment?: string,
    ): Promise<bigint> => {
      const resolvedAddress = await ansClient.getAddressForANSName(String(addressOrName));
      return (connection as any).getLamportBalance(resolvedAddress, commitment);
    };

    const enhancedGetTokenAccounts = async (
      addressOrName: Address | string,
      includeZeroBalances?: boolean,
    ): Promise<Array<any>> => {
      const resolvedAddress = await ansClient.getAddressForANSName(String(addressOrName));
      return (connection as any).getTokenAccounts(resolvedAddress, includeZeroBalances);
    };

    let enhancedTransferTokens = (connection as any).transferTokens;
    if (enhancedTransferTokens) {
      const originalTransferTokens = enhancedTransferTokens;
      enhancedTransferTokens = async (params: any): Promise<string> => {
        const resolvedDestination = await ansClient.getAddressForANSName(String(params.destination));
        return originalTransferTokens({
          ...params,
          destination: resolvedDestination,
        });
      };
    }

    let enhancedTransferSol = (connection as any).transferSol;
    if (enhancedTransferSol) {
      const originalTransferSol = enhancedTransferSol;
      enhancedTransferSol = async (params: {
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
      };
    }

    let enhancedGetPortfolioValue = (connection as any).getPortfolioValue;
    if (enhancedGetPortfolioValue) {
      const originalGetPortfolioValue = enhancedGetPortfolioValue;
      enhancedGetPortfolioValue = async (addressOrName: Address | string): Promise<number> => {
        const resolvedAddress = await ansClient.getAddressForANSName(String(addressOrName));
        return originalGetPortfolioValue(resolvedAddress);
      };
    }

    let enhancedGetPortfolioBreakdown = (connection as any).getPortfolioBreakdown;
    if (enhancedGetPortfolioBreakdown) {
      const originalGetPortfolioBreakdown = enhancedGetPortfolioBreakdown;
      enhancedGetPortfolioBreakdown = async (addressOrName: Address | string): Promise<any> => {
        const resolvedAddress = await ansClient.getAddressForANSName(String(addressOrName));
        return originalGetPortfolioBreakdown(resolvedAddress);
      };
    }

    let enhancedGetTopHoldings = (connection as any).getTopHoldings;
    if (enhancedGetTopHoldings) {
      const originalGetTopHoldings = enhancedGetTopHoldings;
      enhancedGetTopHoldings = async (addressOrName: Address | string, limit: number): Promise<Array<any>> => {
        const resolvedAddress = await ansClient.getAddressForANSName(String(addressOrName));
        return originalGetTopHoldings(resolvedAddress, limit);
      };
    }

    let enhancedWatchPortfolioValue = (connection as any).watchPortfolioValue;
    if (enhancedWatchPortfolioValue) {
      const originalWatchPortfolioValue = enhancedWatchPortfolioValue;
      enhancedWatchPortfolioValue = async (
        addressOrName: Address | string,
        callback: any,
        intervalMs?: number,
      ): Promise<() => void> => {
        const resolvedAddress = await ansClient.getAddressForANSName(String(addressOrName));
        return originalWatchPortfolioValue(resolvedAddress, callback, intervalMs);
      };
    }

    return extendClient(connection, {
      ans: ansClient,
      getAddressForANSName,
      getANSNamesForAddress,
      getLamportBalance: enhancedGetLamportBalance as any,
      getTokenAccounts: enhancedGetTokenAccounts as any,
      ...(enhancedTransferTokens && { transferTokens: enhancedTransferTokens }),
      ...(enhancedTransferSol && { transferSol: enhancedTransferSol }),
      ...(enhancedGetPortfolioValue && { getPortfolioValue: enhancedGetPortfolioValue }),
      ...(enhancedGetPortfolioBreakdown && { getPortfolioBreakdown: enhancedGetPortfolioBreakdown }),
      ...(enhancedGetTopHoldings && { getTopHoldings: enhancedGetTopHoldings }),
      ...(enhancedWatchPortfolioValue && { watchPortfolioValue: enhancedWatchPortfolioValue }),
    });
  };
};

/**
 * @deprecated Use {@link ansNameService} instead. Kept for backward compatibility.
 */
export const createKiteANSNameServicePlugin = ansNameService;
