import { address, type Address } from "@solana/kit";

// Switchboard On-Demand (sb-on-demand) program IDs.
// Source: https://docs.switchboard.xyz/ (llms-full.txt) and
// https://docs.switchboard.xyz/tooling-and-resources/technical-resources-and-documentation/solana-accounts
export const SWITCHBOARD_ON_DEMAND_PROGRAM_ID: Address = address("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv");
export const SWITCHBOARD_ON_DEMAND_PROGRAM_ID_DEVNET: Address = address(
  "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2",
);

// Anchor 8-byte account discriminator for the `PullFeedAccountData` account.
// Source: switchboard-xyz/solana-sdk src/on_demand/accounts/pull_feed.rs
export const PULL_FEED_DISCRIMINATOR = new Uint8Array([196, 27, 108, 196, 10, 215, 219, 40]);

// All Switchboard On-Demand onchain values are scaled fixed-point i128 with 18 decimals of precision.
// Source: switchboard-xyz/solana-sdk `PRECISION` constant (10^18) used by Decimal/CurrentResult.
export const SWITCHBOARD_DECIMAL_PRECISION = 18;
export const SWITCHBOARD_DECIMAL_SCALE = 10n ** 18n;

// Byte offsets into the raw account data (including the 8-byte anchor discriminator).
//
// Layout of PullFeedAccountData (#[repr(C)], bytemuck::Pod), verified against
// switchboard-xyz/solana-sdk src/on_demand/accounts/pull_feed.rs:
//
//   8                  anchor discriminator
//   submissions        [OracleSubmission; 32]  (OracleSubmission = Pubkey 32 + u64 + u64 + i128 = 64 bytes) => 2048
//   authority          Pubkey (32)
//   queue              Pubkey (32)
//   feed_hash          [u8; 32]
//   initialized_at     i64 (8)
//   permissions        u64 (8)
//   max_variance       u64 (8)
//   min_responses      u32 (4)
//   name               [u8; 32]
//   padding1           [u8; 2]
//   historical_result_idx u8 (1)
//   min_sample_size    u8 (1)
//   last_update_timestamp i64 (8)
//   lut_slot           u64 (8)
//   _reserved1         [u8; 32]
//   result             CurrentResult  <-- the aggregated value we read
//   ...
//
// Offsets below are absolute (from the start of the account data, discriminator included).
export const OFFSET_SUBMISSIONS = 8;
export const ORACLE_SUBMISSION_SIZE = 64;
export const SUBMISSIONS_COUNT = 32;

export const OFFSET_AUTHORITY = 8 + ORACLE_SUBMISSION_SIZE * SUBMISSIONS_COUNT; // 2056
export const OFFSET_QUEUE = OFFSET_AUTHORITY + 32; // 2088
export const OFFSET_FEED_HASH = OFFSET_QUEUE + 32; // 2120
export const OFFSET_INITIALIZED_AT = OFFSET_FEED_HASH + 32; // 2152
export const OFFSET_NAME = 8 + 2048 + 32 + 32 + 32 + 8 + 8 + 8 + 4; // 2180
export const OFFSET_LAST_UPDATE_TIMESTAMP = OFFSET_NAME + 32 + 2 + 1 + 1; // 2216

// CurrentResult begins after lut_slot (8) + _reserved1 (32) following last_update_timestamp (8).
export const OFFSET_RESULT = OFFSET_LAST_UPDATE_TIMESTAMP + 8 + 8 + 32; // 2264

// CurrentResult field offsets (relative to OFFSET_RESULT):
//   value      i128 @ 0
//   std_dev    i128 @ 16
//   mean       i128 @ 32
//   range      i128 @ 48
//   min_value  i128 @ 64
//   max_value  i128 @ 80
//   num_samples    u8 @ 96
//   submission_idx u8 @ 97
//   padding1   [u8; 6] @ 98
//   slot       u64 @ 104
//   min_slot   u64 @ 112
//   max_slot   u64 @ 120
export const RESULT_OFFSET_VALUE = 0;
export const RESULT_OFFSET_STD_DEV = 16;
export const RESULT_OFFSET_MEAN = 32;
export const RESULT_OFFSET_RANGE = 48;
export const RESULT_OFFSET_MIN_VALUE = 64;
export const RESULT_OFFSET_MAX_VALUE = 80;
export const RESULT_OFFSET_NUM_SAMPLES = 96;
export const RESULT_OFFSET_SUBMISSION_IDX = 97;
export const RESULT_OFFSET_SLOT = 104;
export const RESULT_OFFSET_MIN_SLOT = 112;
export const RESULT_OFFSET_MAX_SLOT = 120;

// Minimum bytes needed to safely read through the CurrentResult.max_slot field.
export const PULL_FEED_ACCOUNT_MIN_SIZE = OFFSET_RESULT + RESULT_OFFSET_MAX_SLOT + 8; // 2392

// Well-known Switchboard On-Demand feed hashes (the SHA-256 of the job schema).
// NOTE: On Switchboard On-Demand, the onchain *feed account address* is created by whoever
// deploys the feed and is NOT a fixed protocol constant (unlike Pyth's push-oracle accounts).
// You must look up the feed account address for the pair you want in the Switchboard Explorer
// (https://explorer.switchboard.xyz) and pass it to getFeedValue().
//
// These feed *hashes* are stable identifiers for common pairs and are provided for reference.
// Source: Switchboard docs basic-price-feed tutorial.
export const SWITCHBOARD_FEED_HASHES = {
  BTC_USD: "4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812",
} as const;
