import { extendClient } from "@solana/kit";
import type { Connection } from "solana-kite";
import { SwitchboardClient } from "./switchboard-client.js";
import type { SwitchboardConfig, SwitchboardMethods } from "./types.js";

/**
 * Solana Kit plugin that adds read-only Switchboard On-Demand oracle helpers
 * (under `client.switchboard`) to a client.
 *
 * Requires the kite() capability (apply `kite()` from `kit-plugin-kite` first), as the
 * Switchboard client uses Kite's RPC to read on-chain pull feed accounts.
 *
 * This plugin is READ-ONLY: it decodes feed values from chain and never sends transactions.
 *
 * @example
 * ```typescript
 * import { createClient } from "@solana/kit";
 * import { kite } from "kit-plugin-kite";
 * import { switchboard } from "kit-plugin-switchboard";
 *
 * const client = createClient()
 *   .use(kite({ clusterNameOrURL: "mainnet" }))
 *   .use(switchboard());
 *
 * const feed = await client.switchboard.getFeedValue("...");
 * ```
 */
export function switchboard(config: SwitchboardConfig = {}) {
  return <T extends Connection>(connection: T) => {
    const client = new SwitchboardClient(connection, config);

    const switchboardMethods: SwitchboardMethods = {
      getFeedValue: client.getFeedValue.bind(client),
      getFeedValues: client.getFeedValues.bind(client),
    };

    return extendClient(connection, { switchboard: switchboardMethods });
  };
}
