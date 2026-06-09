import { extendClient } from "@solana/kit";
import { type Connection } from "solana-kite";
import { ArciumClient, type ArciumPluginConfig } from "./arcium-client.js";

export { ArciumPluginConfig };

export interface ArciumMethods {
  arcium: ArciumClient;
}

export type ConnectionWithArcium = Connection & ArciumMethods;

/**
 * Solana Kit plugin that adds Arcium confidential-computing helpers to a client.
 *
 * Requires the kite() capability (apply `kite()` from `kit-plugin-kite` first), as the
 * Arcium client builds on the connection's RPC, PDA and transaction helpers.
 *
 * @example
 * ```typescript
 * import { createClient } from "@solana/kit";
 * import { kite } from "kit-plugin-kite";
 * import { arcium } from "kit-plugin-arcium";
 *
 * const client = await createClient()
 *   .use(kite({ clusterNameOrURL: "localnet" }))
 *   .use(arcium({ artifactsDir: "./artifacts" }));
 *
 * const mxeAccount = await client.arcium.getMXEAccountAddress(mxeProgramId);
 * ```
 */
export function arcium(config: ArciumPluginConfig = {}) {
  return async <T extends Connection>(connection: T) => {
    const arciumClient = await ArciumClient.create(connection, config);
    return extendClient(connection, { arcium: arciumClient });
  };
}

