import type { Address } from "@solana/kit";
import type { Connection } from "solana-kite";
import type { SwitchboardConfig, SwitchboardFeedValue } from "./types.js";
import {
  SWITCHBOARD_ON_DEMAND_PROGRAM_ID,
  PULL_FEED_DISCRIMINATOR,
  SWITCHBOARD_DECIMAL_SCALE,
  PULL_FEED_ACCOUNT_MIN_SIZE,
  OFFSET_LAST_UPDATE_TIMESTAMP,
  OFFSET_RESULT,
  RESULT_OFFSET_VALUE,
  RESULT_OFFSET_STD_DEV,
  RESULT_OFFSET_MEAN,
  RESULT_OFFSET_MIN_VALUE,
  RESULT_OFFSET_MAX_VALUE,
  RESULT_OFFSET_NUM_SAMPLES,
  RESULT_OFFSET_SLOT,
} from "./constants.js";

/** Reads a little-endian signed 128-bit integer from a DataView at the given byte offset. */
function getInt128LE(view: DataView, offset: number): bigint {
  const lo = view.getBigUint64(offset, true);
  const hi = view.getBigInt64(offset + 8, true);
  return (hi << 64n) | lo;
}

/**
 * Converts a Switchboard fixed-point i128 (scaled by 10^18) into a JavaScript number.
 * This may lose precision for very large magnitudes; callers that need exactness should
 * use the raw bigint together with SWITCHBOARD_DECIMAL_SCALE.
 */
function scaledToNumber(raw: bigint): number {
  // Divide as a Number after converting; for typical price magnitudes this is exact enough.
  return Number(raw) / Number(SWITCHBOARD_DECIMAL_SCALE);
}

/**
 * PURE decoder for a Switchboard On-Demand `PullFeedAccountData` account.
 *
 * Takes the raw account bytes (including the 8-byte anchor discriminator) and returns the
 * decoded aggregated result, or null if the bytes are too short or the discriminator does
 * not match. Contains NO network calls so it can be unit-tested against a captured fixture.
 *
 * Layout source: switchboard-xyz/solana-sdk src/on_demand/accounts/pull_feed.rs (CurrentResult).
 *
 * @param data Raw account data as returned by getAccountInfo (base64-decoded).
 * @param feedAddress The address the bytes were read from, echoed back in the result.
 */
export function parseSwitchboardFeedAccountData(
  data: Uint8Array,
  feedAddress: Address,
): SwitchboardFeedValue | null {
  if (data.length < PULL_FEED_ACCOUNT_MIN_SIZE) return null;

  // Verify the anchor discriminator so we don't misread an unrelated account.
  for (let i = 0; i < PULL_FEED_DISCRIMINATOR.length; i++) {
    if (data[i] !== PULL_FEED_DISCRIMINATOR[i]) return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const lastUpdatedAt = view.getBigInt64(OFFSET_LAST_UPDATE_TIMESTAMP, true);

  const valueRaw = getInt128LE(view, OFFSET_RESULT + RESULT_OFFSET_VALUE);
  const stdDevRaw = getInt128LE(view, OFFSET_RESULT + RESULT_OFFSET_STD_DEV);
  const meanRaw = getInt128LE(view, OFFSET_RESULT + RESULT_OFFSET_MEAN);
  const minValueRaw = getInt128LE(view, OFFSET_RESULT + RESULT_OFFSET_MIN_VALUE);
  const maxValueRaw = getInt128LE(view, OFFSET_RESULT + RESULT_OFFSET_MAX_VALUE);
  const numSamples = view.getUint8(OFFSET_RESULT + RESULT_OFFSET_NUM_SAMPLES);
  const slot = view.getBigUint64(OFFSET_RESULT + RESULT_OFFSET_SLOT, true);

  return {
    address: feedAddress,
    value: scaledToNumber(valueRaw),
    valueRaw,
    standardDeviation: scaledToNumber(stdDevRaw),
    mean: scaledToNumber(meanRaw),
    minValue: scaledToNumber(minValueRaw),
    maxValue: scaledToNumber(maxValueRaw),
    numSamples,
    slot,
    lastUpdatedAt,
  };
}

/**
 * Read-only client for Switchboard On-Demand price/feed values on Solana.
 *
 * Reads pull feed account data directly from chain via the connection's RPC and decodes
 * the aggregated `CurrentResult`. This client never sends transactions.
 */
export class SwitchboardClient {
  private connection: Connection;
  /** The configured program ID. Retained for reference/diagnostics; reads target a specific account. */
  readonly programId: Address;

  constructor(connection: Connection, config: SwitchboardConfig = {}) {
    this.connection = connection;
    this.programId = config.programId ?? SWITCHBOARD_ON_DEMAND_PROGRAM_ID;
  }

  async getFeedValue(feedAddress: Address): Promise<SwitchboardFeedValue | null> {
    try {
      const accountInfo = await this.connection.rpc
        .getAccountInfo(feedAddress, { encoding: "base64" })
        .send();
      if (!accountInfo.value) return null;

      const [encodedData] = accountInfo.value.data as readonly [string, string];
      const rawBytes = new Uint8Array(Buffer.from(encodedData, "base64"));
      return parseSwitchboardFeedAccountData(rawBytes, feedAddress);
    } catch {
      return null;
    }
  }

  async getFeedValues(feedAddresses: Array<Address>): Promise<Map<Address, SwitchboardFeedValue>> {
    const results = new Map<Address, SwitchboardFeedValue>();
    const values = await Promise.all(feedAddresses.map((feedAddress) => this.getFeedValue(feedAddress)));
    for (let i = 0; i < feedAddresses.length; i++) {
      const value = values[i];
      if (value) {
        results.set(feedAddresses[i]!, value);
      }
    }
    return results;
  }
}
