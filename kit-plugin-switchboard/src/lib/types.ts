import type { Address } from "@solana/kit";
import type { Connection } from "solana-kite";

/**
 * The decoded aggregated result of a Switchboard On-Demand pull feed account.
 *
 * All `*Raw` fields are the onchain fixed-point i128 values scaled by 10^18.
 * The non-raw fields are those values converted to JavaScript numbers (which may
 * lose precision for very large magnitudes - use the raw bigints when exactness matters).
 */
export interface SwitchboardFeedValue {
  /** The feed account address that was read */
  address: Address;
  /** The aggregated result value as a floating-point number (rawValue / 10^18) */
  value: number;
  /** The aggregated result value as the raw onchain i128 (scaled by 10^18) */
  valueRaw: bigint;
  /** Standard deviation across oracle submissions, as a float */
  standardDeviation: number;
  /** Mean of oracle submissions, as a float */
  mean: number;
  /** Minimum submitted value, as a float */
  minValue: number;
  /** Maximum submitted value, as a float */
  maxValue: number;
  /** Number of oracle samples that contributed to this result */
  numSamples: number;
  /** Solana slot at which this result was produced */
  slot: bigint;
  /** Unix timestamp (seconds) of the feed's last update */
  lastUpdatedAt: bigint;
}

/** Configuration for the Switchboard plugin. */
export interface SwitchboardConfig {
  /**
   * Override the Switchboard On-Demand program ID. Defaults to the Solana
   * mainnet/devnet program ID (SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv).
   * Only relevant if Switchboard verification of program ownership is added later;
   * reads work regardless since they target a specific account address.
   */
  programId?: Address;
}

export interface SwitchboardMethods {
  /**
   * Read and decode a single Switchboard On-Demand pull feed account, returning
   * its aggregated value, or null if the account does not exist or cannot be decoded.
   */
  getFeedValue(feedAddress: Address): Promise<SwitchboardFeedValue | null>;
  /**
   * Read and decode multiple Switchboard On-Demand pull feed accounts at once.
   * Returns a Map keyed by feed address; addresses that could not be decoded are omitted.
   */
  getFeedValues(feedAddresses: Array<Address>): Promise<Map<Address, SwitchboardFeedValue>>;
}

export type ConnectionWithSwitchboard = Connection & {
  switchboard: SwitchboardMethods;
};
