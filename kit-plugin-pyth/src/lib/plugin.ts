import type { Connection } from "solana-kite";
import { PythClient } from "./pyth-client.js";
import type { PythConfig, PythMethods, ConnectionWithPyth } from "./types.js";

export function createKitePythPlugin(config: PythConfig = {}) {
  return function pythPlugin(connection: Connection): ConnectionWithPyth {
    const client = new PythClient(connection, config);

    const pyth: PythMethods = {
      getPythPrice: client.getPythPrice.bind(client),
      getPythPrices: client.getPythPrices.bind(client),
      getPythOnchainPrice: client.getPythOnchainPrice.bind(client),
      isPythPriceStale: client.isPythPriceStale.bind(client),
      searchPythFeeds: client.searchPythFeeds.bind(client),
      watchPythPrice: client.watchPythPrice.bind(client),
      postPythPriceUpdate: client.postPythPriceUpdate.bind(client),
      postPythPriceUpdates: client.postPythPriceUpdates.bind(client),
      reclaimPythPriceUpdateRent: client.reclaimPythPriceUpdateRent.bind(client),
    };

    return { pyth };
  };
}
