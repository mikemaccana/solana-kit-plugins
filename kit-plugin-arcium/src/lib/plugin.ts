import { type Connection } from "solana-kite";
import { ArciumClient, type ArciumPluginConfig } from "./arcium-client.js";

export { ArciumPluginConfig };

export interface ArciumMethods {
  arcium: ArciumClient;
}

export type ConnectionWithArcium = Connection & ArciumMethods;

export const createKiteArciumPlugin = (config: ArciumPluginConfig = {}) => {
  return async <T extends Connection>(connection: T): Promise<T & ArciumMethods> => {
    const arciumClient = await ArciumClient.create(connection, config);
    return {
      ...connection,
      arcium: arciumClient,
    };
  };
};
